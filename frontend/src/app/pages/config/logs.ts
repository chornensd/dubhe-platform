import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ApiService } from '../../core/api.service';
import { AuditLogDto, AuditLogQuery, CleanupLogsResultDto, Paged } from '../../core/api-types';
import { ConfirmService } from '../../core/confirm.service';
import { PagedList } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent } from '../../shared/data-table';
import { SchemaFormComponent } from '../../shared/schema-form';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';

type AuditLogRow = AuditLogDto & Record<string, unknown>;

/** 操作日志：审计追溯、条件导出与过期清理 */
@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzDatePickerModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    PageHeaderComponent,
    DataTableComponent,
    SchemaFormComponent,
    ModalComponent,
  ],
  template: `
    <app-page-header title="操作日志" subtitle="记录平台写操作审计信息，支持条件筛选、导出与定期清理">
      <button nz-button [disabled]="list.loading()" (click)="exportLogs()">
        <span nz-icon nzType="download"></span> 导出 Excel
      </button>
      @if (perm.can('config.param.manage')) {
        <button nz-button nzDanger (click)="openCleanup()">
          <span nz-icon nzType="delete"></span> 清理日志
        </button>
      }
      <button nz-button (click)="list.reload()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="card">
      <div class="filter-bar">
        <nz-select
          style="width: 160px"
          nzPlaceHolder="全部模块"
          nzAllowClear
          nzShowSearch
          [ngModel]="module()"
          (ngModelChange)="onModule($event)"
        >
          @for (item of moduleOptions; track item.value) {
            <nz-option [nzValue]="item.value" [nzLabel]="item.label" />
          }
        </nz-select>
        <input
          nz-input
          style="width: 220px"
          placeholder="用户 / 操作 / 详情关键字"
          [ngModel]="keyword()"
          (ngModelChange)="keyword.set($event)"
          (keyup.enter)="search()"
        />
        <nz-select style="width: 130px" nzPlaceHolder="全部结果" nzAllowClear [ngModel]="succeeded()" (ngModelChange)="onSucceeded($event)">
          <nz-option [nzValue]="true" nzLabel="成功" />
          <nz-option [nzValue]="false" nzLabel="失败" />
        </nz-select>
        <nz-date-picker
          nzShowTime
          nzFormat="yyyy-MM-dd HH:mm"
          nzPlaceHolder="开始时间"
          [ngModel]="from()"
          (ngModelChange)="from.set($event)"
        />
        <nz-date-picker
          nzShowTime
          nzFormat="yyyy-MM-dd HH:mm"
          nzPlaceHolder="结束时间"
          [ngModel]="to()"
          (ngModelChange)="to.set($event)"
        />
        <button nz-button nzType="primary" (click)="search()"><span nz-icon nzType="search"></span> 查询</button>
        <button nz-button (click)="reset()">重置</button>
        <span class="filter-bar__spacer"></span>
        <span class="text-secondary">共 {{ list.total() }} 条</span>
      </div>

      <app-data-table
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [pageNum]="list.pageNum"
        [pageSize]="list.pageSize"
        [loading]="list.loading()"
        emptyText="当前条件下暂无操作日志"
        scrollX="1280px"
        (pageChange)="list.page($event)"
      />
    </div>

    <app-modal [(open)]="cleanupOpen" title="清理操作日志" okText="确认清理" [okDanger]="true" [loading]="cleaning()" [width]="520" (ok)="submitCleanup()">
      <app-schema-form [fields]="cleanupFields" [(model)]="cleanupModel" />
      <div class="text-danger">清理将永久删除保留期之前的日志记录，且不可恢复，请谨慎操作。</div>
    </app-modal>
  `,
})
export class LogsPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  readonly perm = inject(PermissionService);

  readonly module = signal<string | null>(null);
  readonly keyword = signal('');
  readonly succeeded = signal<boolean | null>(null);
  readonly from = signal<Date | null>(null);
  readonly to = signal<Date | null>(null);

  readonly cleaning = signal(false);
  readonly cleanupOpen = signal(false);
  cleanupModel: Record<string, unknown> = { retentionDays: 180 };

  readonly cleanupFields = [
    {
      key: 'retentionDays',
      label: '保留天数',
      type: 'number' as const,
      required: true,
      span: 24,
      min: 1,
      max: 3650,
      help: '将删除该天数之前的日志，默认 180 天（约 6 个月）',
    },
  ];

  readonly moduleOptions = [
    { value: 'auth', label: '账号认证' },
    { value: 'users', label: '用户资料' },
    { value: 'admin', label: '系统管理' },
    { value: 'orders', label: '订单' },
    { value: 'settlements', label: '结算' },
    { value: 'invoices', label: '发票' },
    { value: 'resource', label: '低空资源' },
    { value: 'airspace', label: '空域合规' },
    { value: 'reports', label: '统计报表' },
    { value: 'support', label: '应急与客服' },
    { value: 'agent', label: '智能体' },
    { value: 'notifications', label: '消息通知' },
  ];

  readonly list = new PagedList<AuditLogRow>((query) =>
    this.api.get<Paged<AuditLogRow>>('/admin/config/logs', { ...query, ...this.filterQuery() }),
  );

  readonly columns: DataColumn<AuditLogRow>[] = [
    { key: 'username', title: '用户', width: '120px', pipe: (row) => row.username ?? '-' },
    { key: 'module', title: '模块', width: '110px', pipe: (row) => this.moduleText(row.module) },
    { key: 'action', title: '操作', width: '240px' },
    { key: 'detail', title: '详情', ellipsis: true, pipe: (row) => row.detail ?? '-' },
    { key: 'ip', title: 'IP', width: '130px', pipe: (row) => row.ip ?? '-' },
    { key: 'succeeded', title: '结果', width: '80px', type: 'status', map: { true: '成功', false: '失败' } },
    { key: 'durationMs', title: '耗时(ms)', width: '90px', align: 'right' },
    { key: 'createdAt', title: '时间', width: '160px', type: 'datetime' },
  ];

  ngOnInit(): void {
    this.list.reload();
  }

  search(): void {
    this.list.filter({});
  }

  reset(): void {
    this.module.set(null);
    this.keyword.set('');
    this.succeeded.set(null);
    this.from.set(null);
    this.to.set(null);
    this.list.filter({});
  }

  onModule(value: string | null): void {
    this.module.set(value);
    this.list.filter({});
  }

  onSucceeded(value: boolean | null): void {
    this.succeeded.set(value);
    this.list.filter({});
  }

  exportLogs(): void {
    this.message.info('导出当前筛选条件下最多 1 万行日志，文件生成中');
    this.api.downloadPost('/admin/config/logs/export', this.filterQuery(), 'audit-logs.xlsx').subscribe({
      next: () => this.message.success('日志导出已开始下载'),
      error: () => undefined,
    });
  }

  openCleanup(): void {
    this.cleanupModel = { retentionDays: 180 };
    this.cleanupOpen.set(true);
  }

  submitCleanup(): void {
    const retentionDays = Number(this.cleanupModel['retentionDays'] ?? 180);
    this.confirm
      .open({
        title: '清理操作日志',
        content: `确认删除 ${retentionDays} 天之前的全部操作日志？该操作不可恢复。`,
        okText: '确认清理',
        danger: true,
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.cleaning.set(true);
        this.api.post<CleanupLogsResultDto>('/admin/config/logs/cleanup', { retentionDays }).subscribe({
          next: (result) => {
            this.cleaning.set(false);
            this.cleanupOpen.set(false);
            this.message.success(`已清理 ${result?.deleted ?? 0} 条日志`);
            this.list.reload();
          },
          error: () => this.cleaning.set(false),
        });
      });
  }

  private filterQuery(): AuditLogQuery {
    return {
      module: this.module() || undefined,
      keyword: this.keyword().trim() || undefined,
      succeeded: this.succeeded() === null ? undefined : this.succeeded()!,
      from: this.from() ? this.toIso(this.from()!) : undefined,
      to: this.to() ? this.toIso(this.to()!) : undefined,
    };
  }

  private moduleText(code: string): string {
    const found = this.moduleOptions.find((item) => item.value === code);
    return found?.label ?? code ?? '-';
  }

  private toIso(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  }
}

