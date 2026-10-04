import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ApiService } from '../../core/api.service';
import {
  CreateServiceAreaRequest,
  Paged,
  ServiceAreaDto,
  UserListItemDto,
} from '../../core/api-types';
import { AuthService } from '../../core/auth.service';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent } from '../../shared/data-table';
import { LatLng, MapCanvasComponent, MapMarker, MapZone } from '../../shared/map-canvas';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { SearchSelectComponent, SelectOption } from '../../shared/search-select';

type AreaRow = ServiceAreaDto & Record<string, unknown>;

@Component({
  selector: 'app-service-areas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    DataTableComponent,
    MapCanvasComponent,
    ModalComponent,
    PageHeaderComponent,
    SchemaFormComponent,
    SearchSelectComponent,
  ],
  template: `
    <app-page-header title="服务区域" subtitle="商家服务范围（电子围栏）配置与地图预览">
      @if (perm.can('resource.service-area.manage')) {
        <button nz-button nzType="primary" (click)="openCreate()">
          <span nz-icon nzType="plus"></span> 新建服务区域
        </button>
      }
      <button nz-button (click)="load()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="grid grid--sidebar">
      <div class="card">
        <div class="filter-bar">
          @if (canPickMerchant()) {
            <app-search-select
              style="width: 280px"
              [options]="merchantOptions()"
              [loading]="merchantLoading()"
              placeholder="按商家筛选服务区域"
              [ngModel]="merchantId()"
              (ngModelChange)="onMerchant($event)"
              (search)="loadMerchants($event)"
            />
          }
          <span class="filter-bar__spacer"></span>
          <span class="text-secondary">共 {{ rows().length }} 个服务区域</span>
        </div>

        <app-data-table
          [columns]="columns"
          [rows]="rows()"
          [total]="rows().length"
          [pageNum]="1"
          [pageSize]="100"
          [loading]="loading()"
          scrollX="1080px"
        />
      </div>

      <div class="card">
        <div class="card__title">
          服务区域地图
          <button nz-button nzSize="small" [nzType]="pickMode() ? 'primary' : 'default'" (click)="togglePick()">
            <span nz-icon nzType="aim"></span> {{ pickMode() ? '取消拾取' : '地图拾取中心点' }}
          </button>
        </div>
        <app-map-canvas
          [height]="360"
          [zones]="zones()"
          [markers]="markers()"
          [pickable]="pickMode()"
          (pick)="onPick($event)"
        />
        @if (pickMode()) {
          <div class="text-secondary mt-8">拾取模式已开启：点击地图任意位置即可获取新区域中心点。</div>
        }
        @if (picked(); as point) {
          <div class="mt-8">
            <span class="text-secondary">
              已拾取中心点：纬度 {{ point.lat.toFixed(4) }}，经度 {{ point.lng.toFixed(4) }}
            </span>
            @if (perm.can('resource.service-area.manage')) {
              <button nz-button nzType="link" nzSize="small" (click)="openCreate()">以此为中心新建区域</button>
            }
          </div>
        }
      </div>
    </div>

    <app-modal
      [(open)]="createOpen"
      title="新建服务区域"
      okText="提交"
      [loading]="saving()"
      [width]="680"
      (ok)="submit()"
    >
      <app-schema-form [fields]="createFields()" [(model)]="model" />
    </app-modal>
  `,
})
export class ServiceAreaPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  private readonly auth = inject(AuthService);
  readonly perm = inject(PermissionService);

  readonly rows = signal<AreaRow[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly createOpen = signal(false);
  readonly pickMode = signal(false);
  readonly picked = signal<LatLng | null>(null);
  readonly merchantId = signal<string | null>(null);

  readonly merchantOptions = signal<SelectOption[]>([]);
  readonly merchantLoading = signal(false);

  model: Record<string, unknown> = {};

  private ownMerchantId: string | null = null;

  readonly columns: DataColumn<AreaRow>[] = [
    { key: 'name', title: '区域名称', width: '180px' },
    { key: 'merchantId', title: '运营商家', width: '220px', ellipsis: true },
    {
      key: 'center',
      title: '中心坐标',
      width: '180px',
      pipe: (row) => `${row.centerLat.toFixed(4)}, ${row.centerLng.toFixed(4)}`,
    },
    { key: 'radiusKm', title: '半径(km)', width: '100px', align: 'right' },
    {
      key: 'isActive',
      title: '启用状态',
      width: '110px',
      type: 'status',
      map: { true: '启用', false: '已停用' },
      tone: (row) => (row.isActive ? 'success' : 'default'),
    },
    { key: 'createdAt', title: '创建时间', width: '150px', type: 'datetime' },
  ];

  readonly canPickMerchant = computed(() => this.perm.can('account.user.manage'));

  readonly zones = computed<MapZone[]>(() =>
    this.rows().map((row) => ({
      lat: row.centerLat,
      lng: row.centerLng,
      radiusKm: row.radiusKm,
      type: 'Fence',
      name: row.name,
      code: row.id,
      active: row.isActive,
    })),
  );

  readonly markers = computed<MapMarker[]>(() => {
    const point = this.picked();
    return point ? [{ lat: point.lat, lng: point.lng, label: '新区域中心', tone: 'red', pulse: true }] : [];
  });

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
      { key: 'name', label: '区域名称', type: 'text', required: true, span: 12, maxLength: 64, placeholder: '如 滨江服务区' },
      { key: 'radiusKm', label: '半径(km)', type: 'number', required: true, span: 12, min: 0.1, max: 200, step: 0.1 },
      { key: 'centerLat', label: '中心纬度', type: 'number', required: true, span: 12, min: -90, max: 90, step: 0.0001 },
      { key: 'centerLng', label: '中心经度', type: 'number', required: true, span: 12, min: -180, max: 180, step: 0.0001 },
    );
    return fields;
  });

  constructor() {
    const me = this.auth.user();
    this.ownMerchantId = me && (me.userType === 'Merchant' || me.userType === 'MerchantStaff') ? me.id : null;
    if (this.canPickMerchant()) this.loadMerchants('');
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .get<ServiceAreaDto[] | Paged<ServiceAreaDto>>('/resource/service-areas', {
        merchantId: this.merchantId() ?? undefined,
      })
      .subscribe({
        next: (res) => {
          this.rows.set(this.asItems(res));
          this.loading.set(false);
        },
        error: () => {
          this.rows.set([]);
          this.loading.set(false);
        },
      });
  }

  onMerchant(value: string | number | null): void {
    this.merchantId.set(value ? String(value) : null);
    this.load();
  }

  openCreate(): void {
    const point = this.picked();
    this.model = {
      merchantId: this.merchantId() ?? this.ownMerchantId,
      name: '',
      radiusKm: 5,
      centerLat: point?.lat ?? 30.2741,
      centerLng: point?.lng ?? 120.1551,
    };
    this.createOpen.set(true);
  }

  submit(): void {
    const body: CreateServiceAreaRequest = {
      merchantId: (this.model['merchantId'] as string | null) ?? null,
      name: String(this.model['name'] ?? '').trim(),
      centerLat: Number(this.model['centerLat'] ?? 0),
      centerLng: Number(this.model['centerLng'] ?? 0),
      radiusKm: Number(this.model['radiusKm'] ?? 0),
    };
    if (!body.name) {
      this.message.warning('请填写区域名称');
      return;
    }
    if (this.canPickMerchant() && !body.merchantId) {
      this.message.warning('请选择运营商家');
      return;
    }
    this.saving.set(true);
    this.api.post<ServiceAreaDto>('/resource/service-areas', body).subscribe({
      next: () => {
        this.saving.set(false);
        this.createOpen.set(false);
        this.pickMode.set(false);
        this.picked.set(null);
        this.message.success('服务区域已创建');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  togglePick(): void {
    this.pickMode.update((value) => !value);
  }

  onPick(point: LatLng): void {
    const picked = { lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) };
    this.picked.set(picked);
    this.pickMode.set(false);
    if (this.createOpen()) {
      this.model = { ...this.model, centerLat: picked.lat, centerLng: picked.lng };
    }
    this.message.success(`已拾取中心点：${picked.lat}, ${picked.lng}`);
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

  private asItems(res: ServiceAreaDto[] | Paged<ServiceAreaDto> | null | undefined): AreaRow[] {
    if (!res) return [];
    return (Array.isArray(res) ? res : (res.items ?? [])) as AreaRow[];
  }
}

