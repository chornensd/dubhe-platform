import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ApiService } from '../../core/api.service';
import {
  CreateReservationRequest,
  CreateStationRequest,
  Paged,
  ReservationDto,
  ReservationPurpose,
  ReservationPurposeNameText,
  ReservationStatusNameText,
  StationDto,
  StationStatus,
  StationStatusNameText,
  StationType,
  StationTypeNameText,
  UpdateStationRequest,
  UserListItemDto,
} from '../../core/api-types';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { PagedList } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent } from '../../shared/data-table';
import { MapCanvasComponent, MapMarker } from '../../shared/map-canvas';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { SelectOption } from '../../shared/search-select';

type StationRow = StationDto & Record<string, unknown>;
type ReservationRow = ReservationDto & Record<string, unknown>;

const StationStatusValue: Record<string, number> = { Offline: 0, Idle: 1, InUse: 2, Maintenance: 3 };

@Component({
  selector: 'app-station-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzDatePickerModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    DataTableComponent,
    MapCanvasComponent,
    ModalComponent,
    PageHeaderComponent,
    SchemaFormComponent,
  ],
  template: `
    <app-page-header title="起降场站" subtitle="起降场站与换电站台账、预约管理与空间分布">
      @if (perm.can('resource.station.read')) {
        <button nz-button nzType="primary" (click)="openCreate()">
          <span nz-icon nzType="plus"></span> 新建场站
        </button>
      }
      <button nz-button (click)="list.reload()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="grid grid--sidebar">
      <div>
        <div class="card">
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
              style="width: 220px"
              placeholder="名称 / 地址"
              [ngModel]="keyword()"
              (ngModelChange)="keyword.set($event)"
              (keyup.enter)="search()"
            />
            <button nz-button nzType="primary" (click)="search()"><span nz-icon nzType="search"></span> 查询</button>
            <button nz-button (click)="reset()">重置</button>
            <span class="filter-bar__spacer"></span>
            <span class="text-secondary">共 {{ list.total() }} 个场站</span>
          </div>

          <app-data-table
            [columns]="columns"
            [rows]="list.rows()"
            [total]="list.total()"
            [pageNum]="list.pageNum"
            [pageSize]="list.pageSize"
            [loading]="list.loading()"
            scrollX="1280px"
            (pageChange)="list.page($event)"
            (rowClick)="select($event)"
          >
            <ng-template #actions let-row>
              <button nz-button nzType="link" nzSize="small" (click)="openEdit(row)">编辑</button>
              <button nz-button nzType="link" nzSize="small" (click)="openReserve(row)">预约</button>
              <button nz-button nzType="link" nzSize="small" (click)="openReservations(row)">查看预约</button>
            </ng-template>
          </app-data-table>
        </div>
      </div>

      <div>
        <div class="card">
          <div class="card__title">
            场站分布
            <span class="card__subtitle">{{ selected() ? selected()!.name : '点击列表行可高亮场站' }}</span>
          </div>
          <app-map-canvas [height]="320" [markers]="markers()" />
          <div class="text-secondary mt-8">红色脉冲标记为当前选中场站，蓝点为当前页其他场站。</div>
        </div>
      </div>
    </div>

    <app-modal [(open)]="createOpen" title="新建场站" okText="提交登记" [loading]="saving()" [width]="680" (ok)="submitCreate()">
      <app-schema-form [fields]="createFields()" [(model)]="createModel" />
    </app-modal>

    <app-modal [(open)]="editOpen" title="编辑场站" okText="保存" [loading]="saving()" [width]="680" (ok)="submitEdit()">
      <app-schema-form [fields]="editFields" [(model)]="editModel" />
    </app-modal>

    <app-modal [(open)]="reserveOpen" title="场站预约" okText="提交预约" [loading]="saving()" [width]="680" (ok)="submitReserve()">
      @if (reserving(); as station) {
        <div class="text-secondary mb-8">预约场站：{{ station.name }}（{{ station.address }}）</div>
      }
      <app-schema-form [fields]="reserveFields" [(model)]="reserveModel" />
    </app-modal>

    <app-modal [(open)]="reservationsOpen" title="场站预约记录" okText="关闭" [width]="960" (ok)="reservationsOpen.set(false)">
      @if (reservationStation(); as station) {
        <div class="filter-bar">
          <span class="filter-bar__label">预约时间范围</span>
          <nz-range-picker
            nzShowTime
            nzFormat="yyyy-MM-dd HH:mm"
            [ngModel]="reservationRange()"
            (ngModelChange)="reservationRange.set($event)"
          />
          <button nz-button nzType="primary" (click)="loadReservations()">
            <span nz-icon nzType="search"></span> 查询
          </button>
          <span class="filter-bar__spacer"></span>
          <span class="text-secondary">{{ station.name }} · 共 {{ reservations().length }} 条</span>
        </div>
      }
      <app-data-table
        [columns]="reservationColumns"
        [rows]="reservations()"
        [total]="reservations().length"
        [pageNum]="1"
        [pageSize]="100"
        [loading]="reservationsLoading()"
        scrollX="900px"
      >
        <ng-template #actions let-row>
          @if (row.status === 'Reserved') {
            <button nz-button nzType="link" nzSize="small" nzDanger (click)="cancelReservation(row)">取消预约</button>
          } @else {
            <span class="text-secondary">-</span>
          }
        </ng-template>
      </app-data-table>
    </app-modal>
  `,
})
export class StationListPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  readonly perm = inject(PermissionService);

  readonly keyword = signal('');
  readonly type = signal<number | null>(null);
  readonly status = signal<number | null>(null);
  readonly saving = signal(false);
  readonly selectedId = signal<string | null>(null);

  readonly createOpen = signal(false);
  readonly editOpen = signal(false);
  readonly reserveOpen = signal(false);
  readonly reservationsOpen = signal(false);

  readonly reserving = signal<StationRow | null>(null);
  readonly reservationStation = signal<StationRow | null>(null);
  readonly reservations = signal<ReservationRow[]>([]);
  readonly reservationsLoading = signal(false);
  readonly reservationRange = signal<Date[] | null>(null);

  readonly merchantOptions = signal<SelectOption[]>([]);
  readonly merchantLoading = signal(false);

  createModel: Record<string, unknown> = {};
  editModel: Record<string, unknown> = {};
  reserveModel: Record<string, unknown> = {};

  private ownMerchantId: string | null = null;
  private editing?: StationRow;

  readonly list = new PagedList<StationRow>((query) =>
    this.api.get<Paged<StationRow>>('/resource/stations', {
      ...query,
      keyword: this.keyword() || undefined,
      type: this.type() ?? undefined,
      status: this.status() ?? undefined,
    }),
  );

  readonly columns: DataColumn<StationRow>[] = [
    { key: 'name', title: '名称', width: '150px' },
    { key: 'type', title: '类型', width: '100px', type: 'status', map: StationTypeNameText },
    { key: 'address', title: '地址', ellipsis: true },
    { key: 'capacity', title: '容量', width: '80px', align: 'right' },
    { key: 'chargerCount', title: '充电桩', width: '90px', align: 'right' },
    { key: 'status', title: '状态', width: '100px', type: 'status', map: StationStatusNameText },
    {
      key: 'location',
      title: '坐标',
      width: '170px',
      pipe: (row) => `${row.lat.toFixed(4)}, ${row.lng.toFixed(4)}`,
    },
    { key: 'createdAt', title: '创建时间', width: '150px', type: 'datetime' },
  ];

  readonly reservationColumns: DataColumn<ReservationRow>[] = [
    { key: 'startAt', title: '开始时间', width: '150px', type: 'datetime' },
    { key: 'endAt', title: '结束时间', width: '150px', type: 'datetime' },
    { key: 'purpose', title: '用途', width: '100px', type: 'status', map: ReservationPurposeNameText },
    { key: 'status', title: '状态', width: '100px', type: 'status', map: ReservationStatusNameText },
    { key: 'orderId', title: '关联订单', width: '160px', pipe: (row) => row.orderId ?? '-', ellipsis: true },
    { key: 'remark', title: '备注', ellipsis: true },
    { key: 'createdAt', title: '创建时间', width: '150px', type: 'datetime' },
  ];

  readonly typeOptions = [
    { value: StationType.TakeoffLanding, label: '起降场站' },
    { value: StationType.Charging, label: '换电站' },
  ];

  readonly statusOptions = [
    { value: StationStatus.Offline, label: '离线' },
    { value: StationStatus.Idle, label: '空闲' },
    { value: StationStatus.InUse, label: '使用中' },
    { value: StationStatus.Maintenance, label: '维护中' },
  ];

  readonly editFields: FormField[] = [
    { key: 'name', label: '名称', type: 'text', required: true, span: 12, maxLength: 64 },
    {
      key: 'status',
      label: '状态',
      type: 'select',
      required: true,
      span: 12,
      options: [
        { value: StationStatus.Offline, label: '离线' },
        { value: StationStatus.Idle, label: '空闲' },
        { value: StationStatus.InUse, label: '使用中' },
        { value: StationStatus.Maintenance, label: '维护中' },
      ],
    },
    { key: 'address', label: '地址', type: 'text', required: true, span: 24, maxLength: 200 },
    { key: 'lat', label: '纬度', type: 'number', required: true, span: 12, min: -90, max: 90, step: 0.0001 },
    { key: 'lng', label: '经度', type: 'number', required: true, span: 12, min: -180, max: 180, step: 0.0001 },
    { key: 'capacity', label: '容量', type: 'number', required: true, span: 12, min: 1, max: 200, step: 1 },
    { key: 'chargerCount', label: '充电桩数量', type: 'number', required: true, span: 12, min: 0, max: 200, step: 1 },
    { key: 'remark', label: '备注', type: 'textarea', span: 24, maxLength: 200 },
  ];

  readonly reserveFields: FormField[] = [
    { key: 'startAt', label: '开始时间', type: 'datetime', required: true, span: 12 },
    { key: 'endAt', label: '结束时间', type: 'datetime', required: true, span: 12 },
    {
      key: 'purpose',
      label: '预约用途',
      type: 'select',
      required: true,
      span: 12,
      options: [
        { value: ReservationPurpose.Order, label: '执行订单' },
        { value: ReservationPurpose.Maintenance, label: '维保' },
        { value: ReservationPurpose.Charging, label: '充电' },
        { value: ReservationPurpose.Other, label: '其他' },
      ],
    },
    { key: 'orderId', label: '关联订单', type: 'text', span: 12, placeholder: '执行订单时填写订单 ID（可选）' },
    { key: 'remark', label: '备注', type: 'textarea', span: 24, maxLength: 200 },
  ];

  readonly canPickMerchant = computed(() => this.perm.can('account.user.manage'));

  readonly createFields = computed<FormField[]>(() => {
    const fields: FormField[] = [];
    if (this.canPickMerchant()) {
      fields.push({
        key: 'merchantId',
        label: '运营商家',
        type: 'search-select',
        required: true,
        span: 24,
        placeholder: '输入商家名称 / 手机号搜索',
        options: this.merchantOptions(),
        loading: this.merchantLoading(),
        search: (keyword: string) => this.loadMerchants(keyword),
      });
    }
    fields.push(
      { key: 'name', label: '名称', type: 'text', required: true, span: 12, maxLength: 64, placeholder: '如 滨江起降场站' },
      {
        key: 'type',
        label: '场站类型',
        type: 'select',
        required: true,
        span: 12,
        options: [
          { value: StationType.TakeoffLanding, label: '起降场站' },
          { value: StationType.Charging, label: '换电站' },
        ],
      },
      { key: 'address', label: '地址', type: 'text', required: true, span: 24, maxLength: 200 },
      { key: 'lat', label: '纬度', type: 'number', required: true, span: 12, min: -90, max: 90, step: 0.0001 },
      { key: 'lng', label: '经度', type: 'number', required: true, span: 12, min: -180, max: 180, step: 0.0001 },
      { key: 'capacity', label: '容量', type: 'number', required: true, span: 12, min: 1, max: 200, step: 1 },
      { key: 'chargerCount', label: '充电桩数量', type: 'number', required: true, span: 12, min: 0, max: 200, step: 1 },
      { key: 'remark', label: '备注', type: 'textarea', span: 24, maxLength: 200 },
    );
    return fields;
  });

  readonly selected = computed(() => this.list.rows().find((row) => row.id === this.selectedId()) ?? null);

  readonly markers = computed<MapMarker[]>(() =>
    this.list.rows().map((row) => ({
      lat: row.lat,
      lng: row.lng,
      label: row.name,
      tone: row.id === this.selectedId() ? 'red' : 'blue',
      pulse: row.id === this.selectedId(),
    })),
  );

  constructor() {
    const me = this.auth.user();
    this.ownMerchantId = me && (me.userType === 'Merchant' || me.userType === 'MerchantStaff') ? me.id : null;
    if (this.canPickMerchant()) this.loadMerchants('');
  }

  ngOnInit(): void {
    this.list.reload();
  }

  search(): void {
    this.list.filter({});
  }

  reset(): void {
    this.keyword.set('');
    this.type.set(null);
    this.status.set(null);
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

  select(row: StationRow): void {
    this.selectedId.set(row.id);
  }

  openCreate(): void {
    this.createModel = {
      merchantId: this.ownMerchantId,
      name: '',
      type: StationType.TakeoffLanding,
      address: '',
      lat: 30.2741,
      lng: 120.1551,
      capacity: 4,
      chargerCount: 2,
      remark: '',
    };
    this.createOpen.set(true);
  }

  submitCreate(): void {
    const body: CreateStationRequest = {
      merchantId: (this.createModel['merchantId'] as string | null) ?? null,
      name: String(this.createModel['name'] ?? '').trim(),
      type: Number(this.createModel['type'] ?? StationType.TakeoffLanding),
      address: String(this.createModel['address'] ?? '').trim(),
      lat: Number(this.createModel['lat'] ?? 0),
      lng: Number(this.createModel['lng'] ?? 0),
      capacity: Number(this.createModel['capacity'] ?? 1),
      chargerCount: Number(this.createModel['chargerCount'] ?? 0),
      remark: (this.createModel['remark'] as string) || null,
    };
    if (!body.name || !body.address) {
      this.message.warning('请填写场站名称与地址');
      return;
    }
    if (this.canPickMerchant() && !body.merchantId) {
      this.message.warning('请选择运营商家');
      return;
    }
    this.saving.set(true);
    this.api.post<StationDto>('/resource/stations', body).subscribe({
      next: () => {
        this.saving.set(false);
        this.createOpen.set(false);
        this.message.success('场站已创建');
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  openEdit(row: StationRow): void {
    this.editing = row;
    this.editModel = {
      name: row.name,
      status: StationStatusValue[row.status] ?? StationStatus.Idle,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      capacity: row.capacity,
      chargerCount: row.chargerCount,
      remark: row.remark ?? '',
    };
    this.editOpen.set(true);
  }

  submitEdit(): void {
    if (!this.editing) return;
    const body: UpdateStationRequest = {
      name: String(this.editModel['name'] ?? '').trim(),
      address: String(this.editModel['address'] ?? '').trim(),
      lat: Number(this.editModel['lat'] ?? 0),
      lng: Number(this.editModel['lng'] ?? 0),
      capacity: Number(this.editModel['capacity'] ?? 1),
      chargerCount: Number(this.editModel['chargerCount'] ?? 0),
      status: Number(this.editModel['status'] ?? StationStatus.Idle),
      remark: (this.editModel['remark'] as string) || null,
    };
    this.saving.set(true);
    this.api.put<StationDto>(`/resource/stations/${this.editing.id}`, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.editOpen.set(false);
        this.message.success('场站信息已更新');
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  openReserve(row: StationRow): void {
    this.reserving.set(row);
    this.reserveModel = {
      startAt: null,
      endAt: null,
      purpose: ReservationPurpose.Order,
      orderId: '',
      remark: '',
    };
    this.reserveOpen.set(true);
  }

  submitReserve(): void {
    const station = this.reserving();
    if (!station) return;
    const startAt = this.reserveModel['startAt'] as string | null;
    const endAt = this.reserveModel['endAt'] as string | null;
    if (!startAt || !endAt) {
      this.message.warning('请选择预约起止时间');
      return;
    }
    const body: CreateReservationRequest = {
      startAt,
      endAt,
      purpose: Number(this.reserveModel['purpose'] ?? ReservationPurpose.Order),
      orderId: (this.reserveModel['orderId'] as string) || null,
      remark: (this.reserveModel['remark'] as string) || null,
    };
    this.saving.set(true);
    this.api.post<ReservationDto>(`/resource/stations/${station.id}/reservations`, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.reserveOpen.set(false);
        this.message.success('预约已提交');
      },
      error: () => this.saving.set(false),
    });
  }

  openReservations(row: StationRow): void {
    this.reservationStation.set(row);
    if (!this.reservationRange()) {
      const now = Date.now();
      this.reservationRange.set([new Date(now - 7 * 86400000), new Date(now + 30 * 86400000)]);
    }
    this.reservationsOpen.set(true);
    this.loadReservations();
  }

  loadReservations(): void {
    const station = this.reservationStation();
    if (!station) return;
    const range = this.reservationRange();
    this.reservationsLoading.set(true);
    this.api
      .get<ReservationDto[] | Paged<ReservationDto>>(`/resource/stations/${station.id}/reservations`, {
        from: range?.[0] ? this.toIso(range[0]) : undefined,
        to: range?.[1] ? this.toIso(range[1]) : undefined,
      })
      .subscribe({
        next: (res) => {
          this.reservations.set(this.asItems(res));
          this.reservationsLoading.set(false);
        },
        error: () => {
          this.reservations.set([]);
          this.reservationsLoading.set(false);
        },
      });
  }

  cancelReservation(row: ReservationRow): void {
    this.confirm
      .open({
        title: '取消预约',
        content: `确认取消 ${this.toText(row.startAt)} 的预约？取消后该时段将重新释放。`,
        danger: true,
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.post<void>(`/resource/reservations/${row.id}/cancel`).subscribe({
          next: () => {
            this.message.success('预约已取消');
            this.loadReservations();
          },
        });
      });
  }

  loadMerchants(keyword: string): void {
    if (!this.canPickMerchant()) return;
    this.merchantLoading.set(true);
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
          this.merchantOptions.set(
            (page.items ?? []).map((u) => ({ value: u.id, label: `${u.displayName}（${u.phone}）` })),
          );
          this.merchantLoading.set(false);
        },
        error: () => this.merchantLoading.set(false),
      });
  }

  private asItems(res: ReservationDto[] | Paged<ReservationDto> | null | undefined): ReservationRow[] {
    if (!res) return [];
    return (Array.isArray(res) ? res : (res.items ?? [])) as ReservationRow[];
  }

  private toText(value: string | null | undefined): string {
    if (!value) return '该时段';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private toIso(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  }
}
