import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ApiService } from '../../core/api.service';
import {
  DroneDto,
  FlightPlanDto,
  OrderListItemDto,
  Paged,
  PenaltyDto,
  PenaltyTypeNameText,
  PenaltyTypeText,
  ReportViolationRequest,
  UserListItemDto,
  ViolationDto,
  ViolationStatusNameText,
  ViolationTypeNameText,
  ViolationTypeText,
} from '../../core/api-types';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { PagedList, dictOptions } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent, formatDateTime } from '../../shared/data-table';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { SearchSelectComponent, SelectOption } from '../../shared/search-select';

type ViolationRow = ViolationDto & Record<string, unknown>;

const VIOLATION_STATUS_TEXT: Record<number, string> = { 1: '未处理', 2: '处理中', 3: '已解决' };

/** 违规处理：违规记录查询、处理、解决与处罚下发 */
@Component({
  selector: 'app-violations',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzSelectModule,
    PageHeaderComponent,
    DataTableComponent,
    ModalComponent,
    SchemaFormComponent,
    SearchSelectComponent,
  ],
  template: `
    <app-page-header title="违规处理" subtitle="低空飞行违规记录查询、处理流转与处罚下发">
      @if (perm.can('airspace.violation.manage')) {
        <button nz-button nzType="primary" (click)="openReport()"><span nz-icon nzType="plus"></span> 上报违规</button>
      }
      <button nz-button (click)="list.reload()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="card">
      <div class="filter-bar">
        <nz-select style="width: 150px" nzPlaceHolder="全部类型" nzAllowClear [nzOptions]="typeOptions" [ngModel]="typeFilter()" (ngModelChange)="onType($event)"></nz-select>
        <nz-select style="width: 150px" nzPlaceHolder="全部状态" nzAllowClear [nzOptions]="statusOptions" [ngModel]="statusFilter()" (ngModelChange)="onStatus($event)"></nz-select>
        @if (canPickMerchant()) {
          <app-search-select
            style="width: 260px"
            placeholder="输入商家名称搜索"
            [options]="merchantOptions()"
            [ngModel]="merchantId()"
            (ngModelChange)="onMerchant($event)"
            (search)="loadMerchants($event)"
          />
        }
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
        scrollX="1400px"
        (pageChange)="list.page($event)"
        (rowClick)="openDetail($event)"
      >
        <ng-template #actions let-row>
          <button nz-button nzType="link" nzSize="small" (click)="openDetail(row)">详情</button>
          @if (perm.can('airspace.violation.manage')) {
            @if (row.status !== 'Resolved') {
              <button nz-button nzType="link" nzSize="small" (click)="handle(row)">处理</button>
              <button nz-button nzType="link" nzSize="small" (click)="resolve(row)">解决</button>
            }
            <button nz-button nzType="link" nzSize="small" nzDanger (click)="openPenalty(row)">处罚</button>
          }
        </ng-template>
      </app-data-table>
    </div>

    <app-modal [(open)]="detailOpen" title="违规详情" okText="关闭" [width]="720" (ok)="detailOpen.set(false)">
      @if (detail()) {
        <div class="detail-lines">
          @for (item of detailItems(); track item.label) {
            <div><span>{{ item.label }}</span><b>{{ item.value }}</b></div>
          }
        </div>
        <div class="card__title mt-16">处罚记录</div>
        @if (penaltyLines().length) {
          <ul class="penalty-list">
            @for (line of penaltyLines(); track $index) {
              <li>{{ line }}</li>
            }
          </ul>
        } @else {
          <div class="text-secondary">暂无处罚记录</div>
        }
      }
    </app-modal>

    <app-modal [(open)]="penaltyOpen" title="下发处罚" okText="确认下发" [okDanger]="true" [loading]="saving()" [width]="620" (ok)="submitPenalty()">
      <app-schema-form [fields]="penaltyFields()" [(model)]="penaltyModel" />
    </app-modal>

    <app-modal [(open)]="reportOpen" title="上报违规" okText="提交上报" [loading]="saving()" [width]="820" (ok)="submitReport()">
      <app-schema-form [fields]="reportFields()" [(model)]="reportModel" />
    </app-modal>
  `,
  styles: [
    `
      .penalty-list {
        margin: 0;
        padding-left: 18px;
      }
      .penalty-list li {
        line-height: 1.9;
      }
      .detail-lines div {
        display: flex;
        gap: 12px;
        font-size: 13px;
        padding: 4px 0;
        border-bottom: 1px dashed #f0f3f8;
      }
      .detail-lines span {
        color: #6b7688;
        flex: 0 0 80px;
        text-align: right;
      }
      .detail-lines b {
        font-weight: 500;
        word-break: break-all;
      }
    `,
  ],
})
export class ViolationPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  readonly perm = inject(PermissionService);

  readonly typeFilter = signal<number | null>(null);
  readonly statusFilter = signal<number | null>(null);
  readonly merchantId = signal<string | null>(null);

  readonly saving = signal(false);
  readonly detailOpen = signal(false);
  readonly penaltyOpen = signal(false);
  readonly reportOpen = signal(false);
  readonly detail = signal<ViolationRow | null>(null);
  readonly penaltyTarget = signal<ViolationRow | null>(null);
  readonly penaltyModel = signal<Record<string, unknown>>({});
  readonly reportModel = signal<Record<string, unknown>>({});

  readonly merchantOptions = signal<SelectOption[]>([]);
  readonly merchantNames = signal<Record<string, string>>({});
  readonly drones = signal<DroneDto[]>([]);
  readonly droneNames = signal<Record<string, string>>({});
  readonly orders = signal<OrderListItemDto[]>([]);
  readonly plans = signal<FlightPlanDto[]>([]);

  readonly typeOptions = dictOptions(ViolationTypeText);

  readonly statusOptions = dictOptions(VIOLATION_STATUS_TEXT);

  readonly detailItems = computed<{ label: string; value: string }[]>(() => {
    const row = this.detail();
    if (!row) return [];
    return [
      { label: '违规类型', value: this.typeText(row.type) },
      { label: '状态', value: this.statusText(row.status) },
      { label: '商家', value: this.merchantName(row.merchantId) },
      { label: '无人机', value: this.droneText(row.droneId) },
      { label: '位置', value: this.positionText(row) },
      { label: '高度', value: row.altitudeM != null ? `${row.altitudeM} m` : '-' },
      { label: '发生时间', value: this.fmt(row.occurredAt) },
      { label: '处理结果', value: row.resolution || '未解决' },
      { label: '违规描述', value: row.description },
    ];
  });

  readonly penaltyLines = computed<string[]>(() => {
    const row = this.detail();
    if (!row?.penalties?.length) return [];
    return row.penalties.map((penalty) => {
      const amount = penalty.type === 'Fine' && penalty.fineAmount != null ? `，罚款 ¥${penalty.fineAmount}` : '';
      const days = penalty.type === 'Suspend' && penalty.suspendDays != null ? `，暂停 ${penalty.suspendDays} 天` : '';
      return `${this.penaltyTypeText(penalty.type)}${amount}${days} · 依据：${penalty.reason} · ${this.fmt(penalty.issuedAt)}`;
    });
  });

  readonly penaltyFields = computed<FormField[]>(() => [
    { key: 'type', label: '处罚类型', type: 'select', required: true, span: 24, options: dictOptions(PenaltyTypeText) },
    { key: 'fineAmount', label: '罚款金额(元)', type: 'number', required: true, span: 24, min: 0.01, step: 100, showWhen: (m) => Number(m['type']) === 2 },
    { key: 'suspendDays', label: '暂停天数', type: 'number', required: true, span: 24, min: 1, max: 7, step: 1, showWhen: (m) => Number(m['type']) === 3 },
    { key: 'reason', label: '处罚依据', type: 'textarea', required: true, span: 24, maxLength: 200, rows: 3 },
  ]);

  readonly reportFields = computed<FormField[]>(() => {
    const fields: FormField[] = [];
    if (this.canPickMerchant()) {
      fields.push({ key: 'merchantId', label: '所属商家', type: 'search-select', required: true, span: 24, placeholder: '输入商家名称/手机号搜索', options: this.merchantOptions(), search: (kw: string) => this.loadMerchants(kw) });
    } else if (!this.isMerchantUser()) {
      fields.push({ key: 'merchantId', label: '所属商家', type: 'text', required: true, span: 24, placeholder: '输入商家 ID（可复制违规记录中的商家标识）' });
    }
    fields.push(
      { key: 'type', label: '违规类型', type: 'select', required: true, span: 24, options: dictOptions(ViolationTypeText) },
      { key: 'description', label: '违规描述', type: 'textarea', required: true, span: 24, maxLength: 200, rows: 3 },
      { key: 'droneId', label: '关联无人机', type: 'select', span: 24, placeholder: '可选', options: this.drones().map((d) => ({ value: d.id, label: `${d.serialNo} · ${d.model}` })) },
      { key: 'orderId', label: '关联订单', type: 'select', span: 24, placeholder: '可选', options: this.orders().map((o) => ({ value: o.id, label: o.orderNo })) },
      { key: 'flightPlanId', label: '关联飞行计划', type: 'select', span: 24, placeholder: '可选', options: this.plans().map((p) => ({ value: p.id, label: `${p.planNo ?? '（草稿）'} · ${p.purpose}` })) },
      { key: 'lat', label: '纬度', type: 'number', min: -90, max: 90, step: 0.0001 },
      { key: 'lng', label: '经度', type: 'number', min: -180, max: 180, step: 0.0001 },
      { key: 'altitudeM', label: '高度(m)', type: 'number', min: 0, step: 5 },
      { key: 'occurredAt', label: '发生时间', type: 'datetime' },
    );
    return fields;
  });

  readonly list = new PagedList<ViolationRow>((query) =>
    this.api.get<Paged<ViolationRow>>('/airspace/violations', {
      ...query,
      type: this.typeFilter() ?? undefined,
      status: this.statusFilter() ?? undefined,
      merchantId: this.merchantId() ?? undefined,
    }),
  );

  readonly columns: DataColumn<ViolationRow>[] = [
    { key: 'type', title: '类型', width: '110px', type: 'status', map: ViolationTypeNameText },
    { key: 'description', title: '描述', ellipsis: true },
    {
      key: 'merchantId',
      title: '商家 / 无人机',
      width: '190px',
      pipe: (row) => `${this.merchantName(row.merchantId)} / ${this.droneText(row.droneId)}`,
    },
    { key: 'position', title: '位置', width: '170px', pipe: (row) => this.positionText(row) },
    { key: 'altitudeM', title: '高度(m)', width: '90px', align: 'right' },
    { key: 'occurredAt', title: '发生时间', width: '150px', type: 'datetime' },
    { key: 'status', title: '状态', width: '100px', type: 'status', map: ViolationStatusNameText },
  ];

  constructor() {
    const me = this.auth.user();
    if (me?.userType === 'Merchant') {
      this.merchantNames.set({ [me.id]: me.companyName ?? me.displayName });
    }
  }

  ngOnInit(): void {
    this.list.reload();
    if (this.canPickMerchant()) this.loadMerchants('');
  }

  canPickMerchant(): boolean {
    return this.perm.can('account.user.manage');
  }

  private isMerchantUser(): boolean {
    const type = this.auth.user()?.userType;
    return type === 'Merchant' || type === 'MerchantStaff';
  }

  typeText(type: string): string {
    return ViolationTypeNameText[type] ?? type;
  }

  statusText(status: string): string {
    return ViolationStatusNameText[status] ?? status;
  }

  penaltyTypeText(type: string): string {
    return PenaltyTypeNameText[type] ?? type;
  }

  merchantName(id: string): string {
    return this.merchantNames()[id] ?? id.slice(0, 8);
  }

  droneText(droneId?: string | null): string {
    if (!droneId) return '未关联';
    return this.droneNames()[droneId] ?? droneId.slice(0, 8);
  }

  positionText(row: ViolationRow): string {
    if (row.lat == null || row.lng == null) return '-';
    return `${row.lat.toFixed(5)}, ${row.lng.toFixed(5)}`;
  }

  fmt(value: unknown): string {
    return formatDateTime(value);
  }

  onType(value: number | null): void {
    this.typeFilter.set(value);
    this.list.filter({});
  }

  onStatus(value: number | null): void {
    this.statusFilter.set(value);
    this.list.filter({});
  }

  onMerchant(value: string | number | null): void {
    this.merchantId.set(value ? String(value) : null);
    this.list.filter({});
  }

  openDetail(row: ViolationRow): void {
    this.detail.set(row);
    this.detailOpen.set(true);
  }

  handle(row: ViolationRow): void {
    this.confirm.prompt({ title: '处理违规', placeholder: '处理说明（选填）', required: false }).subscribe((remark) => {
      if (remark === null) return;
      this.api.post<ViolationDto>(`/airspace/violations/${row.id}/handle`, { remark: remark || null }).subscribe({
        next: () => {
          this.message.success('已标记为处理中');
          this.list.reload();
        },
      });
    });
  }

  resolve(row: ViolationRow): void {
    this.confirm
      .prompt({ title: '解决违规', placeholder: '请填写处理结果（将记录到违规档案）' })
      .subscribe((resolution) => {
        if (!resolution) return;
        this.api.post<ViolationDto>(`/airspace/violations/${row.id}/resolve`, { resolution }).subscribe({
          next: () => {
            this.message.success('违规已解决');
            this.list.reload();
          },
        });
      });
  }

  openPenalty(row: ViolationRow): void {
    this.penaltyTarget.set(row);
    this.penaltyModel.set({ type: 1, fineAmount: null, suspendDays: null, reason: '' });
    this.penaltyOpen.set(true);
  }

  submitPenalty(): void {
    const row = this.penaltyTarget();
    if (!row) return;
    const model = this.penaltyModel();
    const type = Number(model['type']);
    const reason = String(model['reason'] ?? '').trim();
    if (!type || !reason) {
      this.message.warning('请选择处罚类型并填写处罚依据');
      return;
    }
    if (type === 2 && !(Number(model['fineAmount']) > 0)) {
      this.message.warning('罚款金额必须大于 0');
      return;
    }
    if (type === 3) {
      const days = Number(model['suspendDays']);
      if (!(days >= 1 && days <= 7)) {
        this.message.warning('暂停服务天数需在 1-7 天之间');
        return;
      }
    }
    this.saving.set(true);
    this.api
      .post<PenaltyDto>(`/airspace/violations/${row.id}/penalties`, {
        type,
        fineAmount: type === 2 ? Number(model['fineAmount']) : null,
        suspendDays: type === 3 ? Number(model['suspendDays']) : null,
        reason,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.penaltyOpen.set(false);
          this.message.success('处罚已下发并通知商家');
          this.list.reload();
        },
        error: () => this.saving.set(false),
      });
  }

  openReport(): void {
    this.reportModel.set({
      merchantId: null,
      type: 1,
      description: '',
      droneId: null,
      orderId: null,
      flightPlanId: null,
      lat: 30.2741,
      lng: 120.1551,
      altitudeM: 100,
      occurredAt: this.toIso(new Date()),
    });
    this.loadOptions();
    this.reportOpen.set(true);
  }

  submitReport(): void {
    const me = this.auth.user();
    const model = this.reportModel();
    const typedMerchantId = (model['merchantId'] as string | null) ?? null;
    const merchantId = typedMerchantId || (this.canPickMerchant() ? '' : me?.id ?? '');
    if (!merchantId) {
      this.message.warning('请选择所属商家');
      return;
    }
    const type = Number(model['type']);
    const description = String(model['description'] ?? '').trim();
    if (!type || !description) {
      this.message.warning('请选择违规类型并填写违规描述');
      return;
    }
    const body: ReportViolationRequest = {
      merchantId,
      droneId: (model['droneId'] as string | null) || null,
      orderId: (model['orderId'] as string | null) || null,
      flightPlanId: (model['flightPlanId'] as string | null) || null,
      type,
      description,
      lat: this.toNumOrNull(model['lat']),
      lng: this.toNumOrNull(model['lng']),
      altitudeM: this.toNumOrNull(model['altitudeM']),
      occurredAt: (model['occurredAt'] as string | null) || null,
    };
    this.saving.set(true);
    this.api.post<ViolationDto>('/airspace/violations', body).subscribe({
      next: () => {
        this.saving.set(false);
        this.reportOpen.set(false);
        this.message.success('违规已上报');
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  loadMerchants(keyword: string): void {
    if (!this.canPickMerchant()) return;
    this.api
      .get<Paged<UserListItemDto>>('/admin/users', {
        pageNum: 1,
        pageSize: 30,
        roleCode: 'Merchant',
        status: 1,
        keyword: keyword || undefined,
      })
      .subscribe({
        next: (page) => {
          const items = page.items ?? [];
          this.merchantOptions.set(items.map((u) => ({ value: u.id, label: `${u.displayName}（${u.phone}）` })));
          this.merchantNames.update((map) => {
            const next = { ...map };
            for (const item of items) next[item.id] = item.displayName;
            return next;
          });
        },
        error: () => undefined,
      });
  }

  private loadOptions(): void {
    if (this.perm.can('resource.drone.read') && !this.drones().length) {
      this.api.get<Paged<DroneDto>>('/resource/drones', { pageNum: 1, pageSize: 200 }).subscribe({
        next: (page) => {
          const items = page.items ?? [];
          this.drones.set(items);
          const map: Record<string, string> = {};
          for (const drone of items) map[drone.id] = drone.serialNo;
          this.droneNames.update((prev) => ({ ...prev, ...map }));
        },
        error: () => undefined,
      });
    }
    if (this.perm.can('order.read') && !this.orders().length) {
      this.api.get<Paged<OrderListItemDto>>('/orders', { pageNum: 1, pageSize: 200 }).subscribe({
        next: (page) => this.orders.set((page.items ?? []).filter((o) => o.status !== 'Cancelled')),
        error: () => undefined,
      });
    }
    if (this.perm.can('airspace.read') && !this.plans().length) {
      this.api.get<Paged<FlightPlanDto>>('/airspace/flight-plans', { pageNum: 1, pageSize: 100 }).subscribe({
        next: (page) => this.plans.set(page.items ?? []),
        error: () => undefined,
      });
    }
  }

  private toNumOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private toIso(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  }
}

