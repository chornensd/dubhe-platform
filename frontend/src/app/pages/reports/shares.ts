import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../core/api.service';
import {
  CreateReportShareRequest,
  OrderPaymentStatusNameText,
  OrderStatusNameText,
  Paged,
  ReportFieldDefDto,
  ReportFilterDto,
  ReportRunRequest,
  ReportRunResultDto,
  ReportShareDto,
  UserListItemDto,
} from '../../core/api-types';
import { ConfirmService } from '../../core/confirm.service';
import { dictOptions, PagedList, QueryParams } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent } from '../../shared/data-table';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { SelectOption } from '../../shared/search-select';

type ShareRow = ReportShareDto & Record<string, unknown>;
type ReportRow = Record<string, unknown>;
type ColumnType = DataColumn<ReportRow>['type'];

@Component({
  selector: 'app-shares',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzDrawerModule,
    NzEmptyModule,
    NzIconModule,
    NzSpinModule,
    NzTabsModule,
    PageHeaderComponent,
    DataTableComponent,
    ModalComponent,
    SchemaFormComponent,
  ],
  template: `
    <app-page-header title="报表分享" subtitle="将报表字段与筛选条件分享给其他用户，并跟踪访问与撤回状态">
      @if (perm.can('report.share')) {
        <button nz-button nzType="primary" (click)="openShare()">
          <span nz-icon nzType="send"></span> 新建分享
        </button>
      }
      <button nz-button [nzLoading]="tabIndex() === 0 ? mine.loading() : received.loading()" (click)="refreshActive()">
        <span nz-icon nzType="reload"></span> 刷新
      </button>
    </app-page-header>

    <div class="card">
      <nz-tabs [nzSelectedIndex]="tabIndex()" (nzSelectedIndexChange)="onTab($event)">
        <nz-tab nzTitle="我发起的">
          <app-data-table
            [columns]="mineColumns"
            [rows]="mine.rows()"
            [total]="mine.total()"
            [pageNum]="mine.pageNum"
            [pageSize]="mine.pageSize"
            [loading]="mine.loading()"
            scrollX="1080px"
            emptyText="暂无发起的分享，可点击右上角「新建分享」"
            (pageChange)="mine.page($event)"
          >
            <ng-template #actions let-row>
              @if (!row.isRevoked) {
                <button nz-button nzType="link" nzSize="small" nzDanger (click)="revoke(row)">撤回</button>
              } @else {
                <span class="text-secondary">已撤回</span>
              }
            </ng-template>
          </app-data-table>
        </nz-tab>
        <nz-tab nzTitle="分享给我的">
          <app-data-table
            [columns]="receivedColumns"
            [rows]="received.rows()"
            [total]="received.total()"
            [pageNum]="received.pageNum"
            [pageSize]="received.pageSize"
            [loading]="received.loading()"
            scrollX="1080px"
            emptyText="暂无接收到的分享"
            (pageChange)="received.page($event)"
          >
            <ng-template #actions let-row>
              <button nz-button nzType="link" nzSize="small" (click)="view(row)">查看</button>
            </ng-template>
          </app-data-table>
        </nz-tab>
      </nz-tabs>
    </div>

    <app-modal
      [(open)]="shareOpen"
      title="新建报表分享"
      okText="创建分享"
      [loading]="saving()"
      [width]="720"
      (ok)="submitShare()"
    >
      <app-schema-form [fields]="shareFields()" [(model)]="shareModel" />
    </app-modal>

    <nz-drawer [nzVisible]="drawerOpen()" [nzWidth]="920" [nzTitle]="resultTitle()" (nzOnClose)="drawerOpen.set(false)">
      <ng-container *nzDrawerContent>
        <div class="filter-bar">
          @if (canExportCurrent()) {
            <button nz-button (click)="exportCurrent()">
              <span nz-icon nzType="download"></span> 导出 Excel
            </button>
          }
          <span class="filter-bar__spacer"></span>
          @if (result(); as r) {
            <span class="text-secondary">共 {{ r.total }} 行 · 合计金额 ¥ {{ r.totalAmount | number: '1.2-2' }}</span>
          }
        </div>
        @if (resultLoading()) {
          <div class="page-loading"><nz-spin nzSimple /></div>
        } @else if (result(); as r) {
          <app-data-table
            [columns]="resultColumns()"
            [rows]="r.rows"
            [total]="r.rows.length"
            [pageNum]="1"
            [pageSize]="r.rows.length || 10"
            emptyText="当前条件下没有数据"
          />
        } @else {
          <div class="card"><nz-empty nzNotFoundContent="未能获取分享的报表数据" /></div>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class ReportSharePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  readonly perm = inject(PermissionService);

  readonly tabIndex = signal(0);
  readonly fieldDefs = signal<ReportFieldDefDto[]>([]);
  readonly userOptions = signal<SelectOption[]>([]);
  readonly userLoading = signal(false);
  readonly recipientNames = signal<Record<string, string>>({});
  readonly shareOpen = signal(false);
  readonly saving = signal(false);
  readonly drawerOpen = signal(false);
  readonly resultLoading = signal(false);
  readonly resultTitle = signal('');
  readonly result = signal<ReportRunResultDto | null>(null);
  readonly currentShare = signal<ShareRow | null>(null);

  readonly statusOptions = dictOptions(OrderStatusNameText);

  shareModel: Record<string, unknown> = {};

  readonly canSearchUsers = computed(() => this.perm.can('account.user.manage'));

  readonly canExportCurrent = computed(() => {
    const share = this.currentShare();
    return !!share && share.canExport && !share.isRevoked && this.perm.can('report.export');
  });

  readonly mine = new PagedList<ShareRow>((query) => this.loadPage('/reports/shares', query));
  readonly received = new PagedList<ShareRow>((query) => this.loadPage('/reports/shares/received', query));

  readonly mineColumns: DataColumn<ShareRow>[] = [
    { key: 'title', title: '分享标题', ellipsis: true },
    {
      key: 'recipientUserId',
      title: '接收人',
      width: '180px',
      pipe: (row) => this.recipientNames()[row.recipientUserId] ?? row.recipientUserId,
    },
    { key: 'businessType', title: '业务类型', width: '110px', pipe: (row) => this.businessText(row.businessType) },
    { key: 'expireAt', title: '有效期至', width: '150px', type: 'datetime' },
    { key: 'canExport', title: '可导出', width: '90px', type: 'boolean' },
    { key: 'accessCount', title: '访问次数', width: '100px', align: 'right' },
    {
      key: 'state',
      title: '状态',
      width: '100px',
      type: 'status',
      pipe: (row) => this.stateText(row),
      tone: (row) => this.stateTone(row),
    },
    { key: 'createdAt', title: '分享时间', width: '150px', type: 'datetime' },
  ];

  readonly receivedColumns: DataColumn<ShareRow>[] = [
    { key: 'title', title: '分享标题', ellipsis: true },
    {
      key: 'ownerUserId',
      title: '分享人',
      width: '180px',
      pipe: (row) => this.recipientNames()[row.ownerUserId] ?? row.ownerUserId,
    },
    { key: 'businessType', title: '业务类型', width: '110px', pipe: (row) => this.businessText(row.businessType) },
    { key: 'expireAt', title: '有效期至', width: '150px', type: 'datetime' },
    { key: 'canExport', title: '可导出', width: '90px', type: 'boolean' },
    { key: 'accessCount', title: '访问次数', width: '100px', align: 'right' },
    { key: 'lastAccessedAt', title: '最近访问', width: '150px', type: 'datetime' },
  ];

  readonly shareFields = computed<FormField[]>(() => {
    const recipient: FormField = this.canSearchUsers()
      ? {
          key: 'recipientUserId',
          label: '接收人',
          type: 'search-select',
          required: true,
          span: 24,
          placeholder: '输入姓名 / 手机号搜索',
          options: this.userOptions(),
          search: (keyword) => this.loadUsers(keyword),
          loading: this.userLoading(),
        }
      : {
          key: 'recipientUserId',
          label: '接收人用户 ID',
          type: 'text',
          required: true,
          span: 24,
          placeholder: '填写接收人用户 GUID',
          help: '当前账号无用户检索权限，请手动填写接收人 GUID',
        };
    return [
      recipient,
      { key: 'title', label: '分享标题', type: 'text', required: true, span: 24, maxLength: 60 },
      { key: 'fields', label: '包含字段', type: 'multiselect', required: true, span: 24, options: this.fieldOptions() },
      { key: 'filters.from', label: '开始时间', type: 'datetime', span: 12 },
      { key: 'filters.to', label: '结束时间', type: 'datetime', span: 12 },
      {
        key: 'filters.status',
        label: '订单状态',
        type: 'select',
        span: 12,
        options: this.statusOptions,
        placeholder: '全部状态',
      },
      { key: 'expireDays', label: '有效期（天）', type: 'number', required: true, min: 1, max: 90, span: 12 },
      { key: 'canExport', label: '允许接收人导出', type: 'switch', span: 24 },
    ];
  });

  readonly fieldOptions = computed(() => this.fieldDefs().map((field) => ({ label: field.name, value: field.key })));

  readonly resultColumns = computed<DataColumn<ReportRow>[]>(() =>
    (this.result()?.columns ?? []).map((column) => {
      const type = this.columnType(column.key, column.type);
      return {
        key: column.key,
        title: column.name,
        type,
        align: type === 'money' ? 'right' : 'left',
        map: this.statusMap(column.key, type),
      };
    }),
  );

  ngOnInit(): void {
    this.mine.reload();
    this.received.reload();
    this.loadFields();
    if (this.canSearchUsers()) this.loadUsers('');
  }

  onTab(index: number): void {
    this.tabIndex.set(index);
  }

  refreshActive(): void {
    if (this.tabIndex() === 0) this.mine.reload();
    else this.received.reload();
  }

  openShare(): void {
    if (!this.perm.can('report.share')) {
      this.message.warning('当前账号无报表分享权限');
      return;
    }
    this.shareModel = {
      recipientUserId: '',
      title: '',
      fields: this.fieldDefs().map((field) => field.key),
      filters: { from: null, to: null, status: null },
      expireDays: 7,
      canExport: false,
    };
    this.shareOpen.set(true);
  }

  submitShare(): void {
    const model = this.shareModel;
    const filters = (model['filters'] ?? {}) as ReportFilterDto;
    const body: CreateReportShareRequest = {
      recipientUserId: String(model['recipientUserId'] ?? '').trim(),
      title: String(model['title'] ?? '').trim(),
      businessType: 'order',
      fields: (model['fields'] as string[]) ?? [],
      filters: { from: filters.from ?? null, to: filters.to ?? null, status: filters.status ?? null },
      expireDays: Number(model['expireDays'] ?? 7),
      canExport: !!model['canExport'],
    };
    if (!body.recipientUserId || !body.title || !body.fields.length) {
      this.message.warning('请补全接收人、分享标题与字段');
      return;
    }
    this.saving.set(true);
    this.api.post<ReportShareDto>('/reports/shares', body).subscribe({
      next: () => {
        this.saving.set(false);
        this.shareOpen.set(false);
        this.message.success('分享已创建');
        this.mine.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  revoke(row: ShareRow): void {
    this.confirm
      .open({ title: '撤回分享', content: `确认撤回「${row.title}」？撤回后接收人将无法继续查看。`, danger: true })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.post<void>(`/reports/shares/${row.id}/revoke`).subscribe({
          next: () => {
            this.message.success('分享已撤回');
            this.mine.reload();
          },
          error: () => undefined,
        });
      });
  }

  view(row: ShareRow): void {
    this.currentShare.set(row);
    this.resultTitle.set(`查看分享：${row.title}`);
    this.result.set(null);
    this.resultLoading.set(true);
    this.drawerOpen.set(true);
    this.api.post<ReportRunResultDto | ReportShareDto | null>(`/reports/shares/${row.id}/access`).subscribe({
      next: (res) => {
        if (res && 'columns' in res && Array.isArray(res.columns)) {
          this.result.set(res);
          this.resultLoading.set(false);
        } else {
          this.runShare(row);
        }
        this.received.reload();
      },
      error: () => {
        this.runShare(row);
        this.received.reload();
      },
    });
  }

  exportCurrent(): void {
    const share = this.currentShare();
    if (!share) return;
    const body: ReportRunRequest = {
      businessType: share.businessType,
      fields: [...(share.fields ?? [])],
      filters: share.filters ?? {},
    };
    this.api.downloadPost('/reports/export', body, 'report.xlsx').subscribe({
      next: () => this.message.success('导出文件已开始下载'),
      error: () => undefined,
    });
  }

  private runShare(row: ShareRow): void {
    const body: ReportRunRequest = {
      businessType: row.businessType,
      fields: [...(row.fields ?? [])],
      filters: row.filters ?? {},
    };
    this.api.post<ReportRunResultDto>('/reports/run', body).subscribe({
      next: (result) => {
        this.result.set(result);
        this.resultLoading.set(false);
      },
      error: () => this.resultLoading.set(false),
    });
  }

  private loadPage(path: string, query: QueryParams): Observable<Paged<ShareRow>> {
    return this.api.get<Paged<ShareRow> | ShareRow[]>(path, query).pipe(map((res) => this.normalize(res)));
  }

  private normalize(res: Paged<ShareRow> | ShareRow[]): Paged<ShareRow> {
    if (Array.isArray(res)) {
      return { items: res, total: res.length, pageNum: 1, pageSize: Math.max(res.length, 20) };
    }
    return res;
  }

  private loadFields(): void {
    this.api.get<ReportFieldDefDto[]>('/reports/fields', { businessType: 'order' }).subscribe({
      next: (fields) => this.fieldDefs.set(fields ?? []),
      error: () => undefined,
    });
  }

  private loadUsers(keyword: string): void {
    if (!this.canSearchUsers()) return;
    this.userLoading.set(true);
    this.api
      .get<Paged<UserListItemDto>>('/admin/users', { pageNum: 1, pageSize: 30, keyword: keyword || undefined })
      .subscribe({
        next: (page) => {
          const items = page.items ?? [];
          this.userOptions.set(
            items.map((user) => ({ value: user.id, label: `${user.displayName}（${user.phone}）` })),
          );
          this.recipientNames.update((names) => {
            const next = { ...names };
            for (const user of items) next[user.id] = user.displayName;
            return next;
          });
          this.userLoading.set(false);
        },
        error: () => this.userLoading.set(false),
      });
  }

  private businessText(type: string): string {
    return type === 'order' ? '订单' : type;
  }

  private expired(row: ShareRow): boolean {
    return !!row.expireAt && new Date(row.expireAt).getTime() < Date.now();
  }

  private stateText(row: ShareRow): string {
    if (row.isRevoked) return '已撤回';
    if (this.expired(row)) return '已过期';
    return '有效';
  }

  private stateTone(row: ShareRow): string {
    if (row.isRevoked) return 'error';
    if (this.expired(row)) return 'default';
    return 'success';
  }

  private columnType(key: string, type: string): ColumnType {
    const value = (type ?? '').toLowerCase();
    if (['money', 'amount', 'decimal', 'currency'].includes(value)) return 'money';
    if (['datetime', 'timestamp'].includes(value)) return 'datetime';
    if (value === 'date') return 'date';
    if (['percent', 'percentage'].includes(value)) return 'percent';
    if (['boolean', 'bool'].includes(value)) return 'boolean';
    if (['status', 'enum'].includes(value) || /status|method/.test(key.toLowerCase())) return 'status';
    return 'text';
  }

  private statusMap(key: string, type: ColumnType): Record<string, string> | undefined {
    if (type !== 'status') return undefined;
    if (/payment/i.test(key)) return OrderPaymentStatusNameText;
    return OrderStatusNameText;
  }
}
