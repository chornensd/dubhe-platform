import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { ApiService } from '../../core/api.service';
import { BackupRecordDto, BackupStatusNameText, CreateBackupRequest, RestoreResultDto } from '../../core/api-types';
import { ConfirmService } from '../../core/confirm.service';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent } from '../../shared/data-table';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';

type BackupRow = BackupRecordDto & Record<string, unknown>;

/** 备份与恢复：系统配置 / 知识库 / 帮助中心快照管理 */
@Component({
  selector: 'app-backups',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzEmptyModule,
    NzIconModule,
    NzSpinModule,
    PageHeaderComponent,
    DataTableComponent,
    SchemaFormComponent,
    ModalComponent,
  ],
  template: `
    <app-page-header title="备份与恢复" subtitle="对配置、知识库与帮助中心数据生成快照，必要时可一键回滚">
      @if (perm.can('config.backup.manage')) {
        <button nz-button nzType="primary" (click)="openCreate()">
          <span nz-icon nzType="plus"></span> 新建备份
        </button>
      }
      <button nz-button (click)="load()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="card notice">
      <span nz-icon nzType="info-circle" class="notice__icon"></span>
      <div>
        <div class="notice__title">备份范围说明</div>
        <div class="notice__text">
          此处备份的是平台业务数据（配置参数、知识库文档、帮助中心文章）。业务数据库的物理备份依赖 PostgreSQL 原生策略（pg_dump / WAL 归档），
          请由数据库运维统一配置定期全量与增量备份。
        </div>
      </div>
    </div>

    <div class="card">
      @if (loading()) {
        <div class="page-loading"><nz-spin nzTip="备份记录加载中" /></div>
      } @else {
        <app-data-table
          [columns]="columns"
          [rows]="rows()"
          [total]="rows().length"
          [pageNum]="1"
          [pageSize]="pageSize()"
          [loading]="false"
          emptyText="暂无备份记录，请点击「新建备份」"
          scrollX="1200px"
        >
          <ng-template #actions let-row>
            @if (row.status === 'Succeeded' && perm.can('config.backup.manage')) {
              <button nz-button nzType="link" nzSize="small" [nzLoading]="restoringId() === row.id" (click)="restore(row)">
                恢复
              </button>
            }
            @if (row.error) {
              <span class="text-danger" [title]="row.error">失败原因</span>
            }
          </ng-template>
        </app-data-table>
      }
    </div>

    <app-modal [(open)]="createOpen" title="新建备份" okText="开始备份" [loading]="saving()" [width]="560" (ok)="submitCreate()">
      <app-schema-form [fields]="createFields" [(model)]="createModel" />
    </app-modal>

    <app-modal [(open)]="restoreOpen" title="恢复结果" okText="关闭" [width]="560" (ok)="restoreOpen.set(false)">
      @if (restoreResult(); as result) {
        <div class="text-secondary mb-16">恢复完成，以下数据已按备份快照回滚：</div>
        <div class="grid grid--3">
          <div class="result-item">
            <div class="result-item__value">{{ result.configCount }}</div>
            <div class="result-item__label">配置参数</div>
          </div>
          <div class="result-item">
            <div class="result-item__value">{{ result.knowledgeDocCount }}</div>
            <div class="result-item__label">知识库文档</div>
          </div>
          <div class="result-item">
            <div class="result-item__value">{{ result.helpArticleCount }}</div>
            <div class="result-item__label">帮助中心文章</div>
          </div>
        </div>
        <div class="text-secondary mt-16">恢复时间：{{ result.restoredAt | date: 'yyyy-MM-dd HH:mm:ss' }}</div>
      }
    </app-modal>
  `,
  styles: [
    `
      .notice {
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }
      .notice__icon {
        color: #1677ff;
        font-size: 18px;
        margin-top: 2px;
      }
      .notice__title {
        font-weight: 600;
        margin-bottom: 4px;
      }
      .notice__text {
        font-size: 13px;
        color: #6b7688;
        line-height: 1.7;
      }
      .result-item {
        text-align: center;
        padding: 12px 0;
        background: #f7f9fc;
        border-radius: 8px;
      }
      .result-item__value {
        font-size: 22px;
        font-weight: 600;
        color: #1677ff;
      }
      .result-item__label {
        font-size: 12px;
        color: #6b7688;
        margin-top: 4px;
      }
    `,
  ],
})
export class BackupPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  readonly perm = inject(PermissionService);

  readonly rows = signal<BackupRow[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly restoringId = signal<string | null>(null);
  readonly createOpen = signal(false);
  readonly restoreOpen = signal(false);
  readonly restoreResult = signal<RestoreResultDto | null>(null);

  createModel: Record<string, unknown> = { scope: 'all' };

  readonly createFields: FormField[] = [
    {
      key: 'scope',
      label: '备份范围',
      type: 'select',
      required: true,
      span: 24,
      options: [
        { value: 'all', label: '全部（配置 + 知识库 + 帮助中心）' },
        { value: 'config', label: '仅系统配置参数' },
        { value: 'knowledge', label: '仅知识库文档' },
        { value: 'help', label: '仅帮助中心文章' },
      ],
    },
  ];

  readonly columns: DataColumn<BackupRow>[] = [
    { key: 'fileName', title: '文件名', ellipsis: true },
    { key: 'scope', title: '范围', width: '180px', pipe: (row) => this.scopeText(row.scope) },
    { key: 'sizeBytes', title: '大小', width: '100px', align: 'right', pipe: (row) => this.formatSize(row.sizeBytes) },
    { key: 'status', title: '状态', width: '90px', type: 'status', map: BackupStatusNameText },
    { key: 'createdBy', title: '创建人', width: '110px', pipe: (row) => (row.createdBy ? row.createdBy.slice(0, 8) : '-') },
    { key: 'createdAt', title: '创建时间', width: '160px', type: 'datetime' },
    { key: 'restoredAt', title: '恢复时间', width: '160px', type: 'datetime' },
  ];

  ngOnInit(): void {
    this.load();
  }

  pageSize(): number {
    return Math.max(10, this.rows().length);
  }

  load(): void {
    this.loading.set(true);
    this.api.get<BackupRecordDto[]>('/admin/config/backups').subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.rows.set((rows ?? []) as BackupRow[]);
      },
      error: () => {
        this.loading.set(false);
        this.rows.set([]);
      },
    });
  }

  openCreate(): void {
    this.createModel = { scope: 'all' };
    this.createOpen.set(true);
  }

  submitCreate(): void {
    const scope = String(this.createModel['scope'] ?? 'all');
    this.saving.set(true);
    this.api.post<BackupRecordDto>('/admin/config/backups', { scope } as CreateBackupRequest).subscribe({
      next: () => {
        this.saving.set(false);
        this.createOpen.set(false);
        this.message.success('备份已完成');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  restore(row: BackupRow): void {
    this.confirm
      .open({
        title: '恢复备份',
        content: `确认使用「${row.fileName}」恢复数据？该操作将覆盖配置/知识库/帮助中心数据，且不可撤销。`,
        okText: '确认恢复',
        danger: true,
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.restoringId.set(row.id);
        this.api.post<RestoreResultDto>(`/admin/config/backups/${row.id}/restore`).subscribe({
          next: (result) => {
            this.restoringId.set(null);
            this.restoreResult.set(result);
            this.restoreOpen.set(true);
            this.message.success('数据已按备份恢复');
            this.load();
          },
          error: () => this.restoringId.set(null),
        });
      });
  }

  private scopeText(scope: string): string {
    if (!scope) return '-';
    const parts = scope
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter((part) => !!part);
    if (parts.length >= 3) return '全部数据';
    const map: Record<string, string> = { config: '系统配置', knowledge: '知识库', help: '帮助中心' };
    return parts.map((part) => map[part] ?? part).join('、');
  }

  private formatSize(bytes: number): string {
    const size = Number(bytes) || 0;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  }
}
