import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { ApiService } from '../../core/api.service';
import {
  AirspaceZoneDto,
  AirspaceZoneSourceNameText,
  AirspaceZoneTypeNameText,
  CreateAirspaceZoneRequest,
  Paged,
} from '../../core/api-types';
import { ConfirmService } from '../../core/confirm.service';
import { PagedList } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { formatDateTime } from '../../shared/data-table';
import { LatLng, MapCanvasComponent, MapMarker, MapZone } from '../../shared/map-canvas';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { StatusTagComponent } from '../../shared/status-tag';

type ZoneRow = AirspaceZoneDto & Record<string, unknown>;

const ZONE_TYPE_VALUE: Record<string, number> = { NoFly: 1, Restricted: 2, TemporaryControl: 3 };
const ZONE_TYPE_NAME: Record<number, string> = { 1: 'NoFly', 2: 'Restricted', 3: 'TemporaryControl' };
const DEFAULT_CENTER: LatLng = { lat: 30.2741, lng: 120.1551 };

/** 空域与围栏：平台空域 / 商家电子围栏的地图分布与台账维护 */
@Component({
  selector: 'app-zones',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzIconModule,
    NzSelectModule,
    NzSpinModule,
    PageHeaderComponent,
    ModalComponent,
    SchemaFormComponent,
    MapCanvasComponent,
    StatusTagComponent,
  ],
  template: `
    <app-page-header title="空域与围栏" subtitle="平台空域与商家电子围栏统一管理，地图直观查看空间分布与生效状态">
      @if (perm.can('airspace.zone.manage')) {
        <button nz-button (click)="mockSync()"><span nz-icon nzType="sync"></span> 模拟空管同步</button>
      }
      @if (canCreate()) {
        <button nz-button nzType="primary" (click)="openCreate()">
          <span nz-icon nzType="plus"></span> {{ tab() === 'fence' ? '新增商家围栏' : '新增平台空域' }}
        </button>
      }
      <button nz-button (click)="list.reload()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="zone-layout">
      <div class="card">
        <div class="card__title">
          空域分布地图
          <span class="zone-layout__filters">
            <nz-select
              style="width: 150px"
              nzPlaceHolder="全部类型"
              nzAllowClear
              [ngModel]="typeFilter()"
              (ngModelChange)="onType($event)"
            >
              <nz-option [nzValue]="1" nzLabel="禁飞区" />
              <nz-option [nzValue]="2" nzLabel="限飞区" />
              <nz-option [nzValue]="3" nzLabel="临时管制区" />
            </nz-select>
            <label nz-checkbox [ngModel]="activeOnly()" (ngModelChange)="onActiveOnly($event)">仅生效</label>
          </span>
        </div>
        <app-map-canvas [zones]="mapZones()" [height]="560" />
        <div class="text-secondary mt-8">支持滚轮缩放与拖拽平移；虚线圆圈为已停用空域，红色为禁飞区、黄色为限飞区、紫色为临时管制区、蓝色为商家围栏。</div>
      </div>

      <div class="card">
        <div class="card__title">
          空域清单
          <span class="text-secondary card__subtitle">共 {{ list.total() }} 条</span>
        </div>
        <div class="filter-bar">
          <button nz-button [nzType]="tab() === 'platform' ? 'primary' : 'default'" (click)="tab.set('platform')">
            平台空域 {{ platformZones().length }}
          </button>
          <button nz-button [nzType]="tab() === 'fence' ? 'primary' : 'default'" (click)="tab.set('fence')">
            我的围栏 {{ myFences().length }}
          </button>
        </div>

        @if (list.loading()) {
          <div class="page-loading"><nz-spin /></div>
        } @else if (!currentRows().length) {
          <nz-empty [nzNotFoundContent]="tab() === 'fence' ? '暂无商家围栏，可点击右上角新增' : '暂无平台空域数据'" />
        } @else {
          <div class="zone-list">
            @for (zone of currentRows(); track zone.id) {
              <div class="zone-item">
                <div class="zone-item__head">
                  <b>{{ zone.name }}</b>
                  <app-status-tag
                    [value]="zone.isActive ? '1' : '0'"
                    [map]="activeMap"
                    [color]="zone.isActive ? 'success' : 'default'"
                  />
                </div>
                <div class="zone-item__meta">{{ zone.code }} · {{ typeText(zone.type) }} · {{ sourceText(zone.source) }}</div>
                <div class="zone-item__meta">半径 {{ zone.radiusKm | number: '1.0-2' }} km · 高度 {{ altitudeText(zone) }}</div>
                <div class="zone-item__meta">{{ effectiveText(zone) }}</div>
                @if (zone.reason) {
                  <div class="zone-item__meta">原因：{{ zone.reason }}</div>
                }
                <div class="zone-item__actions">
                  @if (canManage(zone)) {
                    <button nz-button nzType="link" nzSize="small" (click)="openEdit(zone)">编辑</button>
                    @if (zone.isActive) {
                      <button nz-button nzType="link" nzSize="small" nzDanger (click)="deactivate(zone)">停用</button>
                    }
                  }
                  @if (!canManage(zone)) {
                    <span class="text-secondary">只读</span>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>

    <app-modal
      [(open)]="formOpen"
      [title]="formTitle()"
      [okText]="editingId() ? '保存' : '创建'"
      [loading]="saving()"
      [width]="760"
      (ok)="submit()"
    >
      <app-schema-form [fields]="formFields()" [(model)]="formModel" />
      <div class="card__title mt-8">地图拾取中心点</div>
      <app-map-canvas
        [height]="260"
        [zones]="formZones()"
        [markers]="formMarkers()"
        [pickable]="true"
        (pick)="onFormPick($event)"
      />
      <div class="text-secondary mt-8">点击地图任意位置可写入中心经纬度；圆圈为待提交的空域范围预览。</div>
    </app-modal>
  `,
  styles: [
    `
      .zone-layout {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
        gap: 16px;
        align-items: start;
      }
      @media (max-width: 1100px) {
        .zone-layout {
          grid-template-columns: 1fr;
        }
      }
      .zone-layout__filters {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .zone-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-height: 520px;
        overflow: auto;
        padding-right: 4px;
      }
      .zone-item {
        border: 1px solid #eef1f6;
        border-radius: 8px;
        padding: 10px 12px;
      }
      .zone-item__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 14px;
      }
      .zone-item__meta {
        font-size: 12px;
        color: #6b7688;
        margin-top: 4px;
        line-height: 1.6;
      }
      .zone-item__actions {
        margin-top: 6px;
        display: flex;
        gap: 4px;
        align-items: center;
      }
      :host ::ng-deep .zone-layout__filters nz-select {
        font-weight: 400;
      }
    `,
  ],
})
export class AirspaceZonePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  readonly perm = inject(PermissionService);

  readonly tab = signal<'platform' | 'fence'>('platform');
  readonly typeFilter = signal<number | null>(null);
  readonly activeOnly = signal(false);

  readonly formOpen = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly editingFence = signal(false);
  readonly formModel = signal<Record<string, unknown>>({});

  readonly activeMap: Record<string, string> = { '1': '生效中', '0': '已停用' };

  readonly list = new PagedList<ZoneRow>((query) =>
    this.api.get<Paged<ZoneRow>>('/airspace/zones', {
      ...query,
      type: this.typeFilter() ?? undefined,
      activeOnly: this.activeOnly() || undefined,
    }),
  );

  readonly zones = computed<ZoneRow[]>(() => this.list.rows());
  readonly platformZones = computed<ZoneRow[]>(() => this.zones().filter((z) => z.source !== 'MerchantFence'));
  readonly myFences = computed<ZoneRow[]>(() => this.zones().filter((z) => z.source === 'MerchantFence'));
  readonly currentRows = computed<ZoneRow[]>(() => (this.tab() === 'platform' ? this.platformZones() : this.myFences()));

  readonly mapZones = computed<MapZone[]>(() =>
    this.zones().map((zone) => ({
      lat: zone.centerLat,
      lng: zone.centerLng,
      radiusKm: zone.radiusKm,
      type: zone.source === 'MerchantFence' ? 'Fence' : zone.type,
      name: zone.name,
      code: zone.code,
      active: zone.isActive,
    })),
  );

  readonly formFields = computed<FormField[]>(() => {
    const fence = this.editingFence();
    const typeOptions = fence
      ? [
          { value: 1, label: '禁飞区' },
          { value: 2, label: '限飞区' },
        ]
      : [
          { value: 1, label: '禁飞区' },
          { value: 2, label: '限飞区' },
          { value: 3, label: '临时管制区' },
        ];
    return [
      { key: 'name', label: '名称', type: 'text', required: true, span: 24, maxLength: 60, placeholder: '如：西湖景区禁飞区' },
      { key: 'type', label: '类型', type: 'select', required: true, options: typeOptions, placeholder: '选择空域类型' },
      { key: 'centerLat', label: '中心纬度', type: 'number', required: true, min: -90, max: 90, step: 0.0001 },
      { key: 'centerLng', label: '中心经度', type: 'number', required: true, min: -180, max: 180, step: 0.0001 },
      { key: 'radiusKm', label: '半径(km)', type: 'number', required: true, min: 0.1, max: 200, step: 0.1 },
      { key: 'minAltitudeM', label: '最低高度(m)', type: 'number', min: 0, step: 10, placeholder: '留空表示不限' },
      { key: 'maxAltitudeM', label: '最高高度(m)', type: 'number', min: 0, step: 10, placeholder: '留空表示不限' },
      { key: 'effectiveFrom', label: '生效开始', type: 'datetime', help: fence ? '商家围栏固定长期有效' : '' },
      { key: 'effectiveTo', label: '生效结束', type: 'datetime' },
      { key: 'reason', label: '设置原因', type: 'textarea', span: 24, maxLength: 200, rows: 2, placeholder: '如：景区安保管控' },
    ];
  });

  readonly formMarkers = computed<MapMarker[]>(() => {
    const m = this.formModel();
    const lat = Number(m['centerLat']);
    const lng = Number(m['centerLng']);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{ lat, lng, label: '中心点', tone: 'blue' }];
  });

  readonly formZones = computed<MapZone[]>(() => {
    const zones = [...this.mapZones()];
    const m = this.formModel();
    const lat = Number(m['centerLat']);
    const lng = Number(m['centerLng']);
    const radiusKm = Number(m['radiusKm']);
    if (Number.isFinite(lat) && Number.isFinite(lng) && radiusKm > 0) {
      zones.push({
        lat,
        lng,
        radiusKm,
        type: ZONE_TYPE_NAME[Number(m['type'])] ?? 'NoFly',
        name: '待提交范围',
        active: true,
      });
    }
    return zones;
  });

  readonly formTitle = computed(() => {
    const fence = this.editingFence();
    if (this.editingId()) return fence ? '编辑商家围栏' : '编辑平台空域';
    return fence ? '新增商家围栏' : '新增平台空域';
  });

  ngOnInit(): void {
    this.list.setQuery({ pageNum: 1, pageSize: 200 });
    this.list.reload();
  }

  canCreate(): boolean {
    return this.tab() === 'fence' ? this.perm.can('airspace.fence.manage') : this.perm.can('airspace.zone.manage');
  }

  canManage(zone: ZoneRow): boolean {
    return zone.source === 'MerchantFence' ? this.perm.can('airspace.fence.manage') : this.perm.can('airspace.zone.manage');
  }

  typeText(type: string): string {
    return AirspaceZoneTypeNameText[type] ?? type;
  }

  sourceText(source: string): string {
    return AirspaceZoneSourceNameText[source] ?? source;
  }

  altitudeText(zone: ZoneRow): string {
    const min = zone.minAltitudeM;
    const max = zone.maxAltitudeM;
    if (min === null || min === undefined) {
      if (max === null || max === undefined) return '不限';
      return `0 ~ ${max} m`;
    }
    return `${min} ~ ${max ?? '不限'} m`;
  }

  effectiveText(zone: ZoneRow): string {
    if (!zone.effectiveFrom && !zone.effectiveTo) return '长期有效';
    return `生效 ${formatDateTime(zone.effectiveFrom)} ~ ${formatDateTime(zone.effectiveTo)}`;
  }

  onType(value: number | null): void {
    this.typeFilter.set(value);
    this.list.filter({});
  }

  onActiveOnly(value: boolean): void {
    this.activeOnly.set(value);
    this.list.filter({});
  }

  openCreate(): void {
    this.editingId.set(null);
    this.editingFence.set(this.tab() === 'fence');
    this.formModel.set({
      name: '',
      type: 1,
      centerLat: DEFAULT_CENTER.lat,
      centerLng: DEFAULT_CENTER.lng,
      radiusKm: 1,
      minAltitudeM: null,
      maxAltitudeM: null,
      effectiveFrom: null,
      effectiveTo: null,
      reason: '',
    });
    this.formOpen.set(true);
  }

  openEdit(zone: ZoneRow): void {
    this.editingId.set(zone.id);
    this.editingFence.set(zone.source === 'MerchantFence');
    this.formModel.set({
      name: zone.name,
      type: ZONE_TYPE_VALUE[zone.type] ?? 1,
      centerLat: zone.centerLat,
      centerLng: zone.centerLng,
      radiusKm: zone.radiusKm,
      minAltitudeM: zone.minAltitudeM ?? null,
      maxAltitudeM: zone.maxAltitudeM ?? null,
      effectiveFrom: zone.effectiveFrom ?? null,
      effectiveTo: zone.effectiveTo ?? null,
      reason: zone.reason ?? '',
    });
    this.formOpen.set(true);
  }

  onFormPick(point: LatLng): void {
    this.formModel.update((m) => ({
      ...m,
      centerLat: Number(point.lat.toFixed(6)),
      centerLng: Number(point.lng.toFixed(6)),
    }));
  }

  submit(): void {
    const m = this.formModel();
    const isFence = this.editingFence();
    const type = Number(m['type']);
    const centerLat = Number(m['centerLat']);
    const centerLng = Number(m['centerLng']);
    const radiusKm = Number(m['radiusKm']);
    const name = String(m['name'] ?? '').trim();
    if (!name || !type || !Number.isFinite(centerLat) || !Number.isFinite(centerLng) || !(radiusKm > 0)) {
      this.message.warning('请完整填写名称、类型、中心坐标与半径');
      return;
    }
    const body: CreateAirspaceZoneRequest = {
      name,
      type,
      centerLat,
      centerLng,
      radiusKm,
      minAltitudeM: this.toNumOrNull(m['minAltitudeM']),
      maxAltitudeM: this.toNumOrNull(m['maxAltitudeM']),
      effectiveFrom: (m['effectiveFrom'] as string | null) || null,
      effectiveTo: (m['effectiveTo'] as string | null) || null,
      reason: String(m['reason'] ?? '').trim() || null,
    };
    const id = this.editingId();
    const base = isFence ? '/airspace/fences' : '/airspace/zones';
    this.saving.set(true);
    const request = id
      ? this.api.put<AirspaceZoneDto>(`${base}/${id}`, body)
      : this.api.post<AirspaceZoneDto>(base, body);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.message.success(id ? '已保存空域信息' : isFence ? '商家围栏已创建' : '平台空域已创建');
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  deactivate(zone: ZoneRow): void {
    const isFence = zone.source === 'MerchantFence';
    this.confirm
      .open({
        title: `停用${isFence ? '围栏' : '空域'}`,
        content: `确认停用「${zone.name}」？停用后该区域不再参与飞行校验，可在列表中查看但不可恢复。`,
        danger: true,
      })
      .subscribe((ok) => {
        if (!ok) return;
        const path = isFence ? `/airspace/fences/${zone.id}/deactivate` : `/airspace/zones/${zone.id}/deactivate`;
        this.api.post<void>(path).subscribe(() => {
          this.message.success('已停用');
          this.list.reload();
        });
      });
  }

  mockSync(): void {
    this.confirm
      .open({
        title: '模拟空管同步',
        content: '将模拟空管部门下发临时管制指令并生成一个临时管制区，确认执行？',
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.post<AirspaceZoneDto>('/airspace/zones/mock-sync').subscribe((zone) => {
          this.message.success(`已生成临时管制区：${zone.name}`);
          this.list.reload();
        });
      });
  }

  private toNumOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
}
