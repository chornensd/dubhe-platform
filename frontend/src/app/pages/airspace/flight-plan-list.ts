import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import {
  AirspaceConflictDto,
  AirspaceZoneTypeNameText,
  CrewDto,
  CreateFlightPlanRequest,
  DroneDto,
  FlightPlanDto,
  FlightPlanStatusNameText,
  FlightPlanWaypointDto,
  OrderListItemDto,
  Paged,
  UserListItemDto,
} from '../../core/api-types';
import { AuthService } from '../../core/auth.service';
import { PagedList } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent, formatDateTime } from '../../shared/data-table';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { SearchSelectComponent, SelectOption } from '../../shared/search-select';

type PlanRow = FlightPlanDto & Record<string, unknown>;

/** 飞行计划列表：筛选、申报与提交审批 */
@Component({
  selector: 'app-flight-plan-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    PageHeaderComponent,
    DataTableComponent,
    ModalComponent,
    SchemaFormComponent,
    SearchSelectComponent,
  ],
  template: `
    <app-page-header title="飞行计划" subtitle="飞行计划申报、空域校验与审批流转">
      @if (perm.can('airspace.plan.submit')) {
        <button nz-button nzType="primary" (click)="openCreate()"><span nz-icon nzType="plus"></span> 新建计划</button>
      }
      <button nz-button (click)="list.reload()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="card">
      <div class="filter-bar">
        <nz-select style="width: 150px" nzPlaceHolder="全部状态" nzAllowClear [ngModel]="statusFilter()" (ngModelChange)="onStatus($event)">
          @for (item of statusOptions; track item.value) {
            <nz-option [nzValue]="item.value" [nzLabel]="item.label" />
          }
        </nz-select>
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
        <input
          nz-input
          style="width: 240px"
          placeholder="计划号 / 飞行用途"
          [ngModel]="keyword()"
          (ngModelChange)="keyword.set($event)"
          (keyup.enter)="search()"
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
        scrollX="1480px"
        (pageChange)="list.page($event)"
        (rowClick)="open($event)"
      >
        <ng-template #actions let-row>
          <button nz-button nzType="link" nzSize="small" (click)="open(row)">详情</button>
          @if ((row.status === 'Draft' || row.status === 'Rejected') && perm.can('airspace.plan.submit')) {
            <button nz-button nzType="link" nzSize="small" (click)="submitPlan(row)">提交申报</button>
          }
        </ng-template>
      </app-data-table>
    </div>

    <app-modal
      [(open)]="createOpen"
      title="新建飞行计划"
      okText="创建草稿"
      [loading]="saving()"
      [width]="820"
      (ok)="submitCreate()"
    >
      <app-schema-form [fields]="createFields()" [(model)]="createModel" />
    </app-modal>

    <app-modal [(open)]="conflictsOpen" title="空域冲突提示" okText="知道了" [width]="640" (ok)="conflictsOpen.set(false)">
      <nz-alert
        nzType="error"
        nzShowIcon
        [nzMessage]="'检测到 ' + conflicts().length + ' 处空域冲突，计划需调整后方可获批'"
        [nzDescription]="conflictTpl"
      />
      <ng-template #conflictTpl>
        <ul class="conflict-list">
          @for (item of conflicts(); track item.code) {
            <li>{{ item.name }}（{{ conflictTypeText(item.type) }}）：{{ item.reason }}</li>
          }
        </ul>
      </ng-template>
    </app-modal>
  `,
  styles: [
    `
      .conflict-list {
        margin: 6px 0 0;
        padding-left: 18px;
      }
      .conflict-list li {
        line-height: 1.8;
      }
    `,
  ],
})
export class FlightPlanListPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly auth = inject(AuthService);
  readonly perm = inject(PermissionService);

  readonly statusFilter = signal<number | null>(null);
  readonly keyword = signal('');
  readonly merchantId = signal<string | null>(null);

  readonly saving = signal(false);
  readonly createOpen = signal(false);
  readonly conflictsOpen = signal(false);
  readonly conflicts = signal<AirspaceConflictDto[]>([]);
  readonly createModel = signal<Record<string, unknown>>({});

  readonly drones = signal<DroneDto[]>([]);
  readonly crew = signal<CrewDto[]>([]);
  readonly orders = signal<OrderListItemDto[]>([]);
  readonly merchantOptions = signal<SelectOption[]>([]);
  readonly merchantNames = signal<Record<string, string>>({});

  readonly statusOptions = [
    { value: 1, label: '草稿' },
    { value: 2, label: '待审批' },
    { value: 3, label: '已批准' },
    { value: 4, label: '已驳回' },
    { value: 5, label: '已取消' },
    { value: 6, label: '已完成' },
  ];

  readonly list = new PagedList<PlanRow>((query) =>
    this.api.get<Paged<PlanRow>>('/airspace/flight-plans', {
      ...query,
      status: this.statusFilter() ?? undefined,
      keyword: this.keyword() || undefined,
      merchantId: this.merchantId() ?? undefined,
    }),
  );

  readonly columns: DataColumn<PlanRow>[] = [
    { key: 'planNo', title: '计划号', width: '170px', pipe: (row) => row.planNo ?? '—' },
    { key: 'status', title: '状态', width: '100px', type: 'status', map: FlightPlanStatusNameText },
    { key: 'merchantId', title: '商家', width: '140px', pipe: (row) => this.merchantNames()[row.merchantId] ?? row.merchantId.slice(0, 8) },
    { key: 'droneSerialNo', title: '飞行器编号', width: '150px', pipe: (row) => row.droneSerialNo ?? row.droneId.slice(0, 8) },
    { key: 'pilotName', title: '机长', width: '100px', pipe: (row) => row.pilotName ?? '-' },
    { key: 'purpose', title: '用途', ellipsis: true },
    {
      key: 'period',
      title: '计划时段',
      width: '270px',
      pipe: (row) => `${formatDateTime(row.startAt)} ~ ${formatDateTime(row.endAt)}`,
    },
    { key: 'maxAltitudeM', title: '最大高度(m)', width: '110px', align: 'right' },
    { key: 'createdAt', title: '创建时间', width: '150px', type: 'datetime' },
  ];

  readonly createFields = computed<FormField[]>(() => {
    const fields: FormField[] = [];
    if (this.canPickMerchant()) {
      fields.push({
        key: 'merchantId',
        label: '运营商家',
        type: 'search-select',
        required: true,
        span: 24,
        placeholder: '输入商家名称/手机号搜索',
        options: this.merchantOptions(),
        search: (keyword: string) => this.loadMerchants(keyword),
      });
    }
    fields.push(
      {
        key: 'orderId',
        label: '关联订单',
        type: 'select',
        span: 24,
        placeholder: '可选，仅展示未取消订单',
        options: this.orders().map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.itemName}` })),
      },
      {
        key: 'droneId',
        label: '执行飞行器',
        type: 'select',
        required: true,
        span: 24,
        placeholder: '选择执行飞行器',
        options: this.drones().map((d) => ({ value: d.id, label: `${d.serialNo} · ${d.model} · 电量${d.batteryPercent}%` })),
      },
      {
        key: 'pilotCrewId',
        label: '执行机长',
        type: 'select',
        span: 24,
        placeholder: '可选，选择机长',
        options: this.crew().map((c) => ({ value: c.id, label: `${c.name}（${c.phone}）` })),
      },
      { key: 'purpose', label: '飞行用途', type: 'text', required: true, span: 24, maxLength: 100, placeholder: '如：订单配送航线' },
      { key: 'startAt', label: '开始时间', type: 'datetime', required: true },
      { key: 'endAt', label: '结束时间', type: 'datetime', required: true },
      { key: 'maxAltitudeM', label: '最大高度(m)', type: 'number', required: true, min: 10, max: 1000, step: 10 },
      { key: 'waypoints', label: '飞行航线', type: 'waypoints', span: 24, help: '至少 2 个航点，按飞行顺序填写（可参考地图坐标系）' },
    );
    return fields;
  });

  constructor() {
    const me = this.auth.user();
    if (me && me.userType === 'Merchant') {
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

  search(): void {
    this.list.filter({});
  }

  reset(): void {
    this.statusFilter.set(null);
    this.keyword.set('');
    this.merchantId.set(null);
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

  open(row: PlanRow): void {
    void this.router.navigate(['/airspace/flight-plans', row.id]);
  }

  openCreate(): void {
    const start = new Date(Date.now() + 30 * 60000);
    const end = new Date(Date.now() + 90 * 60000);
    this.createModel.set({
      merchantId: null,
      orderId: null,
      droneId: null,
      pilotCrewId: null,
      purpose: '',
      startAt: this.toIso(start),
      endAt: this.toIso(end),
      maxAltitudeM: 120,
      waypoints: [
        { lat: 30.2741, lng: 120.1551 },
        { lat: 30.2841, lng: 120.1651 },
      ],
    });
    this.loadOptions();
    this.createOpen.set(true);
  }

  submitCreate(): void {
    const m = this.createModel();
    const merchantId = (m['merchantId'] as string | null) || null;
    if (this.canPickMerchant() && !merchantId) {
      this.message.warning('请选择运营商家');
      return;
    }
    const droneId = (m['droneId'] as string | null) || null;
    if (!droneId) {
      this.message.warning('请选择执行飞行器');
      return;
    }
    const purpose = String(m['purpose'] ?? '').trim();
    if (!purpose) {
      this.message.warning('请填写飞行用途');
      return;
    }
    const startAt = (m['startAt'] as string | null) || null;
    const endAt = (m['endAt'] as string | null) || null;
    if (!startAt || !endAt) {
      this.message.warning('请选择飞行时段');
      return;
    }
    const waypoints = Array.isArray(m['waypoints']) ? (m['waypoints'] as FlightPlanWaypointDto[]) : [];
    if (waypoints.length < 2) {
      this.message.warning('航线至少需要 2 个航点');
      return;
    }
    const body: CreateFlightPlanRequest = {
      merchantId,
      orderId: (m['orderId'] as string | null) || null,
      droneId,
      pilotCrewId: (m['pilotCrewId'] as string | null) || null,
      purpose,
      startAt,
      endAt,
      maxAltitudeM: Number(m['maxAltitudeM']),
      waypoints,
    };
    this.saving.set(true);
    this.api.post<FlightPlanDto>('/airspace/flight-plans', body).subscribe({
      next: (plan) => {
        this.saving.set(false);
        this.createOpen.set(false);
        this.message.success('飞行计划已创建（草稿），可在列表提交申报');
        if (plan.conflicts?.length) {
          this.conflicts.set(plan.conflicts);
          this.conflictsOpen.set(true);
        }
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  submitPlan(row: PlanRow): void {
    this.api.post<FlightPlanDto>(`/airspace/flight-plans/${row.id}/submit`).subscribe({
      next: (plan) => {
        this.message.success('已提交审批');
        if (plan.conflicts?.length) {
          this.conflicts.set(plan.conflicts);
          this.conflictsOpen.set(true);
        }
        this.list.reload();
      },
    });
  }

  conflictTypeText(type: string): string {
    if (type === 'PlanConflict') return '计划冲突';
    return AirspaceZoneTypeNameText[type] ?? type;
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
        next: (page) => this.drones.set(page.items ?? []),
        error: () => undefined,
      });
    }
    if (this.perm.can('resource.crew.manage') && !this.crew().length) {
      this.api.get<Paged<CrewDto>>('/resource/crew', { pageNum: 1, pageSize: 200, role: 1 }).subscribe({
        next: (page) => this.crew.set(page.items ?? []),
        error: () => undefined,
      });
    }
    if (this.perm.can('order.read') && !this.orders().length) {
      this.api.get<Paged<OrderListItemDto>>('/orders', { pageNum: 1, pageSize: 200 }).subscribe({
        next: (page) => this.orders.set((page.items ?? []).filter((o) => o.status !== 'Cancelled')),
        error: () => undefined,
      });
    }
  }

  private toIso(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  }
}


