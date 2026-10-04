import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ApiService } from '../../core/api.service';
import {
  CreateTicketRequest,
  OrderListItemDto,
  Paged,
  ServiceTicketDto,
  TicketStatsDto,
  TicketStatus,
  TicketStatusNameText,
  TicketType,
  TicketTypeNameText,
  UserListItemDto,
} from '../../core/api-types';
import { PagedList, nameMap } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent } from '../../shared/data-table';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { StatCardComponent } from '../../shared/stat-card';

type TicketRow = ServiceTicketDto & Record<string, unknown>;

/** M6 客服工单列表：统计卡 + 类型/状态/关键字筛选 + 提交工单 */
@Component({
  selector: 'app-tickets',
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
    <app-page-header title="客服工单" subtitle="投诉、咨询与建议的受理、指派与满意度跟踪">
      @if (perm.can('support.ticket.apply')) {
        <button nz-button nzType="primary" (click)="openCreate()">
          <span nz-icon nzType="plus"></span> 提交工单
        </button>
      }
      @if (perm.can('support.ticket.manage')) {
        <button nz-button (click)="goto('/support/canned')"><span nz-icon nzType="message"></span> 常用语</button>
      }
      <button nz-button (click)="reload()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    @if (perm.can('support.ticket.manage')) {
      <div class="grid grid--6">
        <app-stat-card label="工单总数" [value]="stats()?.total ?? 0" unit="单" />
        <app-stat-card label="待处理" [value]="stats()?.pending ?? 0" unit="单" [alert]="(stats()?.pending ?? 0) > 0" />
        <app-stat-card label="处理中" [value]="stats()?.processing ?? 0" unit="单" />
        <app-stat-card label="已完成" [value]="stats()?.completed ?? 0" unit="单" />
        <app-stat-card label="已关闭" [value]="stats()?.closed ?? 0" unit="单" />
        <app-stat-card
          label="平均处理时长"
          [value]="stats()?.averageHandlingHours ?? 0"
          unit="小时"
          [digits]="1"
          [footer]="ratingHint()"
        />
      </div>
    } @else {
      <div class="grid grid--6">
        <app-stat-card label="我的工单" [value]="list.total()" unit="单" hint="含投诉 / 咨询 / 建议" />
      </div>
    }

    <div class="card mt-16">
      <div class="filter-bar">
        <nz-select
          style="width: 140px"
          nzPlaceHolder="全部类型"
          nzAllowClear
          [ngModel]="type()"
          (ngModelChange)="onType($event)"
        >
          @for (item of typeOptions; track item.value) {
            <nz-option [nzValue]="item.value" [nzLabel]="item.label" />
          }
        </nz-select>
        <nz-select
          style="width: 140px"
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
          placeholder="工单号 / 标题 / 内容"
          [ngModel]="keyword()"
          (ngModelChange)="keyword.set($event)"
          (keyup.enter)="search()"
        />
        <button nz-button nzType="primary" (click)="search()"><span nz-icon nzType="search"></span> 查询</button>
        <button nz-button (click)="reset()">重置</button>
        <span class="filter-bar__spacer"></span>
        <span class="text-secondary">共 {{ list.total() }} 单</span>
      </div>

      <app-data-table
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [pageNum]="list.pageNum"
        [pageSize]="list.pageSize"
        [loading]="list.loading()"
        emptyText="暂无工单记录"
        scrollX="1400px"
        (pageChange)="list.page($event)"
        (rowClick)="open($event)"
      >
        <ng-template #actions let-row>
          <button nz-button nzType="link" nzSize="small" (click)="open(row)">详情</button>
        </ng-template>
      </app-data-table>
    </div>

    <app-modal
      [(open)]="createOpen"
      title="提交客服工单"
      okText="提交工单"
      [loading]="saving()"
      [width]="680"
      (ok)="submitCreate()"
    >
      <app-schema-form [fields]="createFields()" [(model)]="createModel" />
    </app-modal>
  `,
})
export class TicketListPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  readonly perm = inject(PermissionService);

  readonly type = signal<number | null>(null);
  readonly status = signal<number | null>(null);
  readonly keyword = signal('');
  readonly saving = signal(false);
  readonly createOpen = signal(false);
  readonly stats = signal<TicketStatsDto | null>(null);

  private readonly userMap = signal<Record<string, string>>({});
  private readonly orderOptions = signal<{ value: string; label: string }[]>([]);

  createModel: Record<string, unknown> = {};

  readonly list = new PagedList<TicketRow>((query) =>
    this.api.get<Paged<TicketRow>>('/support/tickets', {
      ...query,
      type: this.type() ?? undefined,
      status: this.status() ?? undefined,
      keyword: this.keyword() || undefined,
    }),
  );

  readonly columns: DataColumn<TicketRow>[] = [
    { key: 'ticketNo', title: '工单号', width: '180px' },
    { key: 'type', title: '类型', width: '90px', type: 'status', map: TicketTypeNameText },
    { key: 'title', title: '标题', ellipsis: true },
    { key: 'status', title: '状态', width: '100px', type: 'status', map: TicketStatusNameText },
    { key: 'submitterUserId', title: '提交人', width: '130px', pipe: (row) => this.userLabel(row.submitterUserId) },
    { key: 'merchantId', title: '商家', width: '130px', pipe: (row) => this.shortId(row.merchantId) },
    { key: 'assigneeUserId', title: '指派给', width: '130px', pipe: (row) => (row.assigneeUserId ? this.userLabel(row.assigneeUserId) : '未指派') },
    { key: 'createdAt', title: '创建时间', width: '150px', type: 'datetime' },
    {
      key: 'satisfactionRating',
      title: '满意度',
      width: '100px',
      type: 'tag',
      pipe: (row) => (row.satisfactionRating ? `${row.satisfactionRating} 分` : '未评价'),
    },
  ];

  readonly typeOptions = [
    { value: TicketType.Complaint, label: '投诉' },
    { value: TicketType.Consult, label: '咨询' },
    { value: TicketType.Advice, label: '建议' },
  ];

  readonly statusOptions = [
    { value: TicketStatus.Pending, label: '待处理' },
    { value: TicketStatus.Processing, label: '处理中' },
    { value: TicketStatus.Completed, label: '已完成' },
    { value: TicketStatus.Closed, label: '已关闭' },
  ];

  readonly createFields = computed<FormField[]>(() => {
    const fields: FormField[] = [
      { key: 'type', label: '工单类型', type: 'select', required: true, span: 12, options: this.typeOptions },
      { key: 'title', label: '工单标题', type: 'text', required: true, span: 12, maxLength: 100, placeholder: '简要描述问题' },
      { key: 'content', label: '问题描述', type: 'textarea', required: true, span: 24, rows: 4, maxLength: 1000, placeholder: '详细描述问题、时间与涉及订单' },
    ];
    if (this.perm.can('order.read')) {
      fields.push({ key: 'orderId', label: '关联订单', type: 'select', span: 12, placeholder: '选择关联订单（可选）', options: this.orderOptions() });
    }
    fields.push({ key: 'attachmentsText', label: '附件链接', type: 'textarea', span: 24, rows: 2, placeholder: '每行一个附件链接（可选）' });
    return fields;
  });

  ngOnInit(): void {
    this.list.reload();
    this.loadStats();
    this.loadUserMap();
  }

  reload(): void {
    this.list.reload();
    this.loadStats();
  }

  search(): void {
    this.list.filter({});
  }

  reset(): void {
    this.type.set(null);
    this.status.set(null);
    this.keyword.set('');
    this.list.filter({});
  }

  onType(value: number | null): void {
    this.type.set(value);
    this.list.filter({});
  }

  onStatus(value: number | null): void {
    this.status.set(value);
    this.list.filter({});
  }

  goto(url: string): void {
    void this.router.navigateByUrl(url);
  }

  open(row: TicketRow): void {
    void this.router.navigate(['/support/tickets', row.id]);
  }

  ratingHint(): string {
    const value = this.stats();
    if (!value) return '';
    return `平均满意度 ${value.averageRating ?? 0} 分 · 已评价 ${value.ratedCount ?? 0} 单`;
  }

  openCreate(): void {
    if (!this.perm.can('support.ticket.apply')) return;
    this.createModel = { type: TicketType.Consult, attachmentsText: '' };
    this.loadOrders();
    this.createOpen.set(true);
  }

  submitCreate(): void {
    const title = String(this.createModel['title'] ?? '').trim();
    const content = String(this.createModel['content'] ?? '').trim();
    if (!title || !content) {
      this.message.warning('请填写工单标题与问题描述');
      return;
    }
    const attachments = String(this.createModel['attachmentsText'] ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const body: CreateTicketRequest = {
      type: Number(this.createModel['type'] ?? TicketType.Consult),
      title,
      content,
      attachments: attachments.length ? attachments : null,
      orderId: (this.createModel['orderId'] as string) || null,
    };
    this.saving.set(true);
    this.api.post<ServiceTicketDto>('/support/tickets', body).subscribe({
      next: () => {
        this.saving.set(false);
        this.createOpen.set(false);
        this.message.success('工单已提交，请留意处理进度');
        this.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  private loadStats(): void {
    if (!this.perm.can('support.ticket.manage')) return;
    this.api.get<TicketStatsDto>('/support/tickets/stats').subscribe({
      next: (data) => this.stats.set(data),
      error: () => this.stats.set(null),
    });
  }

  private loadOrders(): void {
    if (!this.perm.can('order.read')) return;
    this.api.get<Paged<OrderListItemDto>>('/orders', { pageNum: 1, pageSize: 50 }).subscribe({
      next: (page) =>
        this.orderOptions.set(
          (page.items ?? []).map((order) => ({ value: order.id, label: `${order.orderNo} · ${order.itemName}` })),
        ),
      error: () => this.orderOptions.set([]),
    });
  }

  private loadUserMap(): void {
    if (!this.perm.can('account.user.manage')) return;
    this.api.get<Paged<UserListItemDto>>('/admin/users', { pageNum: 1, pageSize: 200 }).subscribe({
      next: (page) =>
        this.userMap.set(nameMap(page.items ?? [], (user) => user.id, (user) => user.displayName || user.username)),
      error: () => undefined,
    });
  }

  private userLabel(userId: string): string {
    if (!userId) return '-';
    return this.userMap()[userId] ?? this.shortId(userId);
  }

  private shortId(value: string | null | undefined): string {
    if (!value) return '-';
    return value.length > 8 ? `${value.slice(0, 8)}…` : value;
  }
}

