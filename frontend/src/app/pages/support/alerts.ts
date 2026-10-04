import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import {
  CreateEmergencyAlertRequest,
  EmergencyAlertDto,
  EmergencyAlertLevel,
  EmergencyAlertStatus,
  EmergencyLevelNameText,
  EmergencyStatusNameText,
  Paged,
} from '../../core/api-types';
import { PagedList } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent } from '../../shared/data-table';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { StatCardComponent } from '../../shared/stat-card';

type AlertRow = EmergencyAlertDto & Record<string, unknown>;

/** M6 应急告警列表：按级别/状态/关键字检索，支持上报新告警 */
@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    DataTableComponent,
    ModalComponent,
    PageHeaderComponent,
    SchemaFormComponent,
    StatCardComponent,
  ],
  template: `
    <app-page-header title="应急告警" subtitle="突发事件上报、处置下发与关闭归档跟踪">
      @if (perm.can('support.alert.handle')) {
        <button nz-button nzType="primary" (click)="openCreate()">
          <span nz-icon nzType="alert"></span> 上报告警
        </button>
      }
      <button nz-button (click)="reload()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="grid grid--4">
      <app-stat-card label="未处理" [value]="openCount()" unit="条" [alert]="openCount() > 0" hint="待下发处置" />
      <app-stat-card label="处理中" [value]="handlingCount()" unit="条" />
      <app-stat-card label="已解决" [value]="resolvedCount()" unit="条" />
      <app-stat-card label="已关闭" [value]="closedCount()" unit="条" />
    </div>

    <div class="card mt-16">
      <div class="filter-bar">
        <nz-select
          style="width: 150px"
          nzPlaceHolder="全部级别"
          nzAllowClear
          [ngModel]="level()"
          (ngModelChange)="onLevel($event)"
        >
          @for (item of levelOptions; track item.value) {
            <nz-option [nzValue]="item.value" [nzLabel]="item.label" />
          }
        </nz-select>
        <nz-select
          style="width: 150px"
          nzPlaceHolder="全部状态"
          nzAllowClear
          [ngModel]="status()"
          (ngModelChange)="onStatus($event)"
        >
          @for (item of statusOptions; track item.value) {
            <nz-option [nzValue]="item.value" [nzLabel]="item.label" />
          }
        </nz-select>
        <input
          nz-input
          style="width: 240px"
          placeholder="标题 / 内容关键字"
          [ngModel]="keyword()"
          (ngModelChange)="keyword.set($event)"
          (keyup.enter)="search()"
        />
        <button nz-button nzType="primary" (click)="search()"><span nz-icon nzType="search"></span> 查询</button>
        <button nz-button (click)="reset()">重置</button>
        <span class="filter-bar__spacer"></span>
        <span class="text-secondary">共 {{ list.total() }} 条告警</span>
      </div>

      <app-data-table
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [pageNum]="list.pageNum"
        [pageSize]="list.pageSize"
        [loading]="list.loading()"
        emptyText="暂无告警记录，可在右上角上报新告警"
        scrollX="1180px"
        (pageChange)="list.page($event)"
        (rowClick)="open($event)"
      >
        <ng-template #actions let-row>
          <button nz-button nzType="link" nzSize="small" (click)="open(row)">处置详情</button>
        </ng-template>
      </app-data-table>
    </div>

    <app-modal
      [(open)]="createOpen"
      title="上报应急告警"
      okText="提交上报"
      [loading]="saving()"
      [width]="680"
      (ok)="submitCreate()"
    >
      <app-schema-form [fields]="createFields" [(model)]="createModel" />
    </app-modal>
  `,
})
export class AlertListPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  readonly perm = inject(PermissionService);

  readonly level = signal<number | null>(null);
  readonly status = signal<number | null>(null);
  readonly keyword = signal('');
  readonly saving = signal(false);
  readonly createOpen = signal(false);

  readonly openCount = signal(0);
  readonly handlingCount = signal(0);
  readonly resolvedCount = signal(0);
  readonly closedCount = signal(0);

  createModel: Record<string, unknown> = {};

  readonly list = new PagedList<AlertRow>((query) =>
    this.api.get<Paged<AlertRow>>('/support/emergency-alerts', {
      ...query,
      level: this.level() ?? undefined,
      status: this.status() ?? undefined,
      keyword: this.keyword() || undefined,
    }),
  );

  readonly columns: DataColumn<AlertRow>[] = [
    { key: 'title', title: '标题', ellipsis: true },
    {
      key: 'level',
      title: '级别',
      width: '90px',
      type: 'status',
      map: EmergencyLevelNameText,
      tone: (row) => this.levelTone(String(row.level)),
    },
    { key: 'status', title: '状态', width: '100px', type: 'status', map: EmergencyStatusNameText },
    { key: 'source', title: '来源', width: '120px', pipe: (row) => this.sourceText(row.source) },
    { key: 'reportedAt', title: '上报时间', width: '150px', type: 'datetime' },
    {
      key: 'handlerCount',
      title: '处理人数',
      width: '100px',
      align: 'center',
      pipe: (row) => (row.handlers?.length ?? 0),
    },
    { key: 'deadlineAt', title: '截止时间', width: '150px', type: 'datetime' },
  ];

  readonly levelOptions = [
    { value: EmergencyAlertLevel.Normal, label: '一般' },
    { value: EmergencyAlertLevel.Serious, label: '严重' },
    { value: EmergencyAlertLevel.Critical, label: '紧急' },
  ];

  readonly statusOptions = [
    { value: EmergencyAlertStatus.Open, label: '未处理' },
    { value: EmergencyAlertStatus.Handling, label: '处理中' },
    { value: EmergencyAlertStatus.Resolved, label: '已解决' },
    { value: EmergencyAlertStatus.Closed, label: '已关闭' },
  ];

  readonly createFields: FormField[] = [
    { key: 'title', label: '告警标题', type: 'text', required: true, span: 24, maxLength: 100, placeholder: '一句话描述突发事件' },
    { key: 'content', label: '告警内容', type: 'textarea', required: true, span: 24, rows: 4, maxLength: 500, placeholder: '事件经过、涉及区域、现场情况等' },
    { key: 'level', label: '告警级别', type: 'select', required: true, span: 12, options: this.levelOptions },
    { key: 'source', label: '告警来源', type: 'text', span: 12, maxLength: 40, placeholder: '如：人工 / 机载告警' },
    { key: 'relatedId', label: '关联业务 ID', type: 'text', span: 12, placeholder: '订单 / 飞行计划 ID（可选）' },
    { key: 'merchantId', label: '关联商家 ID', type: 'text', span: 12, placeholder: '商家 ID（可选）' },
  ];

  ngOnInit(): void {
    this.list.reload();
    this.loadStats();
  }

  reload(): void {
    this.list.reload();
    this.loadStats();
  }

  search(): void {
    this.list.filter({});
  }

  reset(): void {
    this.level.set(null);
    this.status.set(null);
    this.keyword.set('');
    this.list.filter({});
  }

  onLevel(value: number | null): void {
    this.level.set(value);
    this.list.filter({});
  }

  onStatus(value: number | null): void {
    this.status.set(value);
    this.list.filter({});
  }

  open(row: AlertRow): void {
    void this.router.navigate(['/support/alerts', row.id]);
  }

  openCreate(): void {
    if (!this.perm.can('support.alert.handle')) return;
    this.createModel = { level: EmergencyAlertLevel.Normal, source: '人工' };
    this.createOpen.set(true);
  }

  submitCreate(): void {
    const title = String(this.createModel['title'] ?? '').trim();
    const content = String(this.createModel['content'] ?? '').trim();
    if (!title || !content) {
      this.message.warning('请填写告警标题与内容');
      return;
    }
    const body: CreateEmergencyAlertRequest = {
      title,
      content,
      level: Number(this.createModel['level'] ?? EmergencyAlertLevel.Normal),
      source: this.text(this.createModel['source']),
      relatedId: this.text(this.createModel['relatedId']),
      merchantId: this.text(this.createModel['merchantId']),
    };
    this.saving.set(true);
    this.api.post<EmergencyAlertDto>('/support/emergency-alerts', body).subscribe({
      next: () => {
        this.saving.set(false);
        this.createOpen.set(false);
        this.message.success('应急告警已上报');
        this.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  private loadStats(): void {
    if (!this.perm.can('support.alert.handle')) return;
    forkJoin({
      open: this.api.get<Paged<AlertRow>>('/support/emergency-alerts', { pageNum: 1, pageSize: 1, status: EmergencyAlertStatus.Open }),
      handling: this.api.get<Paged<AlertRow>>('/support/emergency-alerts', { pageNum: 1, pageSize: 1, status: EmergencyAlertStatus.Handling }),
      resolved: this.api.get<Paged<AlertRow>>('/support/emergency-alerts', { pageNum: 1, pageSize: 1, status: EmergencyAlertStatus.Resolved }),
      closed: this.api.get<Paged<AlertRow>>('/support/emergency-alerts', { pageNum: 1, pageSize: 1, status: EmergencyAlertStatus.Closed }),
    }).subscribe({
      next: (result) => {
        this.openCount.set(result.open.total ?? 0);
        this.handlingCount.set(result.handling.total ?? 0);
        this.resolvedCount.set(result.resolved.total ?? 0);
        this.closedCount.set(result.closed.total ?? 0);
      },
      error: () => undefined,
    });
  }

  private levelTone(level: string): string {
    if (level === 'Critical') return 'error';
    if (level === 'Serious') return 'warning';
    return 'default';
  }

  /** 告警来源本地化（后端为自由文本，常见值映射为中文） */
  sourceText(source: string): string {
    const dict: Record<string, string> = { Manual: '人工上报', Device: '机载告警', System: '系统触发', Drone: '飞行器上报' };
    return dict[source] ?? source ?? '-';
  }

  private text(value: unknown): string | null {
    const raw = String(value ?? '').trim();
    return raw ? raw : null;
  }
}

