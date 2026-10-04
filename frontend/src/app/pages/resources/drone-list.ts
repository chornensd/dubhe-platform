import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import {
  CreateDroneRequest,
  DroneDto,
  DroneStatus,
  DroneStatusNameText,
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
import { SelectOption } from '../../shared/search-select';
import { StatCardComponent } from '../../shared/stat-card';
import { StatusTagComponent } from '../../shared/status-tag';

type DroneRow = DroneDto & Record<string, unknown>;

@Component({
  selector: 'app-drone-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    DataTableComponent,
    PageHeaderComponent,
    ModalComponent,
    SchemaFormComponent,
    StatCardComponent,
    StatusTagComponent,
  ],
  template: `
    <app-page-header title="飞行器台账" subtitle="飞行器基础信息、状态、电量与健康度全量台账">
      @if (perm.can('resource.drone.manage')) {
        <button nz-button nzType="primary" (click)="openCreate()">
          <span nz-icon nzType="plus"></span> 新增飞行器
        </button>
      }
      <button nz-button (click)="refresh()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="grid grid--4">
      <app-stat-card label="飞行器总数" [value]="stats().total" unit="架" />
      <app-stat-card label="闲置待命" [value]="stats().idle" unit="架" />
      <app-stat-card label="飞行中" [value]="stats().inFlight" unit="架" />
      <app-stat-card label="维保中" [value]="stats().maintenance" unit="架" [alert]="stats().maintenance > 0" />
    </div>

    <div class="card mt-16">
      <div class="filter-bar">
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
          placeholder="编号 / 型号"
          [ngModel]="keyword()"
          (ngModelChange)="keyword.set($event)"
          (keyup.enter)="search()"
        />
        <button nz-button nzType="primary" (click)="search()"><span nz-icon nzType="search"></span> 查询</button>
        <button nz-button (click)="reset()">重置</button>
        <span class="filter-bar__spacer"></span>
        <span class="text-secondary">共 {{ list.total() }} 架</span>
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
        (rowClick)="openDetail($event)"
      >
        <ng-template #actions let-row>
          <button nz-button nzType="link" nzSize="small" (click)="openDetail(row)">查看详情</button>
        </ng-template>
      </app-data-table>
    </div>

    <app-modal
      [(open)]="createOpen"
      title="新增飞行器"
      okText="提交登记"
      [loading]="saving()"
      [width]="680"
      (ok)="submitCreate()"
    >
      <app-schema-form [fields]="createFields()" [(model)]="model" />
    </app-modal>

    <app-modal [(open)]="detailOpen" title="飞行器详情" okText="关闭" [width]="720" (ok)="detailOpen.set(false)">
      @if (current(); as d) {
        <div class="desc-grid">
          <div class="desc-item"><span class="desc-item__label">飞行器编号</span><span class="desc-item__value mono">{{ d.serialNo }}</span></div>
          <div class="desc-item"><span class="desc-item__label">型号</span><span class="desc-item__value">{{ d.model }}</span></div>
          <div class="desc-item"><span class="desc-item__label">状态</span><span class="desc-item__value"><app-status-tag [value]="d.status" [map]="DroneStatusNameText" /></span></div>
          <div class="desc-item"><span class="desc-item__label">运营商家</span><span class="desc-item__value mono">{{ d.merchantId }}</span></div>
          <div class="desc-item"><span class="desc-item__label">最大载重</span><span class="desc-item__value">{{ d.maxPayloadKg }} kg</span></div>
          <div class="desc-item"><span class="desc-item__label">续航时长</span><span class="desc-item__value">{{ d.enduranceMinutes }} 分钟</span></div>
          <div class="desc-item">
            <span class="desc-item__label">当前电量</span>
            <span class="desc-item__value" [class.text-danger]="d.batteryPercent < 30">{{ d.batteryPercent }}%{{ d.batteryPercent < 30 ? '（电量偏低）' : '' }}</span>
          </div>
          <div class="desc-item"><span class="desc-item__label">累计飞行</span><span class="desc-item__value">{{ d.cumulativeFlightMinutes }} 分钟</span></div>
          <div class="desc-item"><span class="desc-item__label">健康评分</span><span class="desc-item__value">{{ d.healthScore }} 分</span></div>
          <div class="desc-item"><span class="desc-item__label">最近维保</span><span class="desc-item__value">{{ d.lastMaintainedAt ? formatDateTime(d.lastMaintainedAt) : '暂无维保记录' }}</span></div>
          <div class="desc-item"><span class="desc-item__label">登记时间</span><span class="desc-item__value">{{ formatDateTime(d.createdAt) }}</span></div>
          <div class="desc-item"><span class="desc-item__label">飞行器 ID</span><span class="desc-item__value mono">{{ d.id }}</span></div>
        </div>
      }
    </app-modal>
  `,
})
export class DroneListPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  private readonly auth = inject(AuthService);
  readonly perm = inject(PermissionService);

  readonly DroneStatusNameText = DroneStatusNameText;
  readonly formatDateTime = formatDateTime;

  readonly keyword = signal('');
  readonly status = signal<number | null>(null);
  readonly saving = signal(false);
  readonly createOpen = signal(false);
  readonly detailOpen = signal(false);
  readonly current = signal<DroneDto | null>(null);
  readonly stats = signal({ total: 0, idle: 0, inFlight: 0, maintenance: 0 });

  readonly merchantOptions = signal<SelectOption[]>([]);
  readonly merchantLoading = signal(false);

  model: Record<string, unknown> = {};

  private ownMerchantId: string | null = null;

  readonly list = new PagedList<DroneRow>((query) =>
    this.api.get<Paged<DroneRow>>('/resource/drones', {
      ...query,
      keyword: this.keyword() || undefined,
      status: this.status() ?? undefined,
    }),
  );

  readonly columns: DataColumn<DroneRow>[] = [
    { key: 'serialNo', title: '编号', width: '150px' },
    { key: 'model', title: '型号', width: '140px', ellipsis: true },
    { key: 'status', title: '状态', width: '100px', type: 'status', map: DroneStatusNameText },
    { key: 'maxPayloadKg', title: '载重(kg)', width: '100px', align: 'right' },
    { key: 'enduranceMinutes', title: '续航(分钟)', width: '110px', align: 'right' },
    {
      key: 'batteryPercent',
      title: '电量',
      width: '90px',
      type: 'status',
      pipe: (row) => `${row.batteryPercent}%`,
      tone: (row) => (row.batteryPercent < 30 ? 'error' : 'default'),
    },
    { key: 'cumulativeFlightMinutes', title: '累计飞行(分钟)', width: '140px', align: 'right' },
    { key: 'healthScore', title: '健康分', width: '90px', align: 'right' },
    { key: 'lastMaintainedAt', title: '最近维保', width: '150px', type: 'datetime' },
    { key: 'createdAt', title: '创建时间', width: '150px', type: 'datetime' },
  ];

  readonly statusOptions = [
    { value: DroneStatus.Offline, label: '离线' },
    { value: DroneStatus.Idle, label: '闲置' },
    { value: DroneStatus.InFlight, label: '飞行中' },
    { value: DroneStatus.Maintenance, label: '维保中' },
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
      { key: 'serialNo', label: '飞行器编号', type: 'text', required: true, span: 12, maxLength: 64, placeholder: '如 UAV-0001' },
      { key: 'model', label: '型号', type: 'text', required: true, span: 12, maxLength: 64, placeholder: '如 DJK-M350' },
      { key: 'maxPayloadKg', label: '最大载重(kg)', type: 'number', required: true, span: 12, min: 0.1, max: 500, step: 0.1 },
      { key: 'enduranceMinutes', label: '续航(分钟)', type: 'number', required: true, span: 12, min: 1, max: 1440, step: 1 },
      { key: 'batteryPercent', label: '初始电量(%)', type: 'number', required: true, span: 12, min: 0, max: 100, step: 1 },
    );
    return fields;
  });

  constructor() {
    const me = this.auth.user();
    this.ownMerchantId = me && (me.userType === 'Merchant' || me.userType === 'MerchantStaff') ? me.id : null;
    if (this.canPickMerchant()) this.loadMerchants('');
  }

  ngOnInit(): void {
    this.list.reload();
    this.loadStats();
  }

  refresh(): void {
    this.list.reload();
    this.loadStats();
  }

  search(): void {
    this.list.filter({});
  }

  reset(): void {
    this.keyword.set('');
    this.status.set(null);
    this.list.filter({});
  }

  onStatus(value: number | null): void {
    this.status.set(value);
    this.list.filter({});
  }

  openCreate(): void {
    this.model = {
      merchantId: this.ownMerchantId,
      serialNo: '',
      model: '',
      maxPayloadKg: 5,
      enduranceMinutes: 30,
      batteryPercent: 100,
    };
    this.createOpen.set(true);
  }

  submitCreate(): void {
    const body: CreateDroneRequest = {
      merchantId: (this.model['merchantId'] as string | null) ?? null,
      serialNo: String(this.model['serialNo'] ?? '').trim(),
      model: String(this.model['model'] ?? '').trim(),
      maxPayloadKg: Number(this.model['maxPayloadKg'] ?? 0),
      enduranceMinutes: Number(this.model['enduranceMinutes'] ?? 0),
      batteryPercent: Number(this.model['batteryPercent'] ?? 0),
    };
    if (!body.serialNo || !body.model) {
      this.message.warning('请填写飞行器编号与型号');
      return;
    }
    if (this.canPickMerchant() && !body.merchantId) {
      this.message.warning('请选择运营商家');
      return;
    }
    this.saving.set(true);
    this.api.post<DroneDto>('/resource/drones', body).subscribe({
      next: () => {
        this.saving.set(false);
        this.createOpen.set(false);
        this.message.success('飞行器已登记');
        this.refresh();
      },
      error: () => this.saving.set(false),
    });
  }

  openDetail(row: DroneRow): void {
    this.current.set(row);
    this.detailOpen.set(true);
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

  loadStats(): void {
    const base = { pageNum: 1, pageSize: 1 };
    forkJoin({
      total: this.api.get<Paged<DroneDto>>('/resource/drones', base),
      idle: this.api.get<Paged<DroneDto>>('/resource/drones', { ...base, status: DroneStatus.Idle }),
      inFlight: this.api.get<Paged<DroneDto>>('/resource/drones', { ...base, status: DroneStatus.InFlight }),
      maintenance: this.api.get<Paged<DroneDto>>('/resource/drones', { ...base, status: DroneStatus.Maintenance }),
    }).subscribe({
      next: (res) =>
        this.stats.set({
          total: res.total.total ?? 0,
          idle: res.idle.total ?? 0,
          inFlight: res.inFlight.total ?? 0,
          maintenance: res.maintenance.total ?? 0,
        }),
      error: () => undefined,
    });
  }
}


