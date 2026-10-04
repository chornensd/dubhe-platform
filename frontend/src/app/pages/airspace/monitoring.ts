import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { ApiService } from '../../core/api.service';
import {
  AirspaceZoneDto,
  DroneDto,
  FlightPlanDto,
  Paged,
  PositionReportResultDto,
  ReportPositionRequest,
  SystemConfigDto,
  ViolationDto,
  ViolationTypeNameText,
} from '../../core/api-types';
import { PermissionService } from '../../core/permission.service';
import { formatDateTime } from '../../shared/data-table';
import { LatLng, MapCanvasComponent, MapMarker, MapZone } from '../../shared/map-canvas';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';

interface TrackPoint extends LatLng {
  altitudeM: number;
  at: string;
}

const DEFAULT_CENTER: LatLng = { lat: 30.2741, lng: 120.1551 };
const MAX_TRACK_POINTS = 50;
const AUTO_REPORT_MS = 5000;

/** 飞行监控：位置上报、违规实时检测、轨迹与空域叠加 */
@Component({
  selector: 'app-monitoring',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    PageHeaderComponent,
    MapCanvasComponent,
    SchemaFormComponent,
  ],
  template: `
    <app-page-header title="飞行监控" subtitle="实时位置上报与空域违规检测，轨迹保留最近 50 个点">
      <button nz-button (click)="refresh()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="grid grid--sidebar">
      <div>
        <div class="card">
          <div class="card__title">
            位置上报
            @if (canReport()) {
              <span class="report-switch">
                <nz-switch [ngModel]="autoReport()" (ngModelChange)="toggleAuto($event)" /> 每 5 秒自动上报
              </span>
            }
          </div>
          @if (!canReport()) {
            <div class="text-secondary">当前账号仅有查看权限，位置上报需 airspace.monitoring.report 权限。</div>
          } @else {
            <div class="filter-bar">
              @if (perm.can('resource.drone.read')) {
                <nz-select
                  style="width: 320px"
                  nzPlaceHolder="选择飞行器"
                  nzShowSearch
                  [ngModel]="droneId()"
                  (ngModelChange)="onDrone($event)"
                >
                  @for (drone of drones(); track drone.id) {
                    <nz-option
                      [nzValue]="drone.id"
                      [nzLabel]="drone.serialNo + ' · ' + drone.model + ' · 电量' + drone.batteryPercent + '%'"
                    />
                  }
                </nz-select>
              } @else {
                <input
                  nz-input
                  style="width: 320px"
                  placeholder="飞行器 ID（当前账号无飞行器列表权限）"
                  [ngModel]="droneId()"
                  (ngModelChange)="onDrone($event)"
                />
              }
              <nz-select
                style="width: 260px"
                nzPlaceHolder="关联飞行计划（可选）"
                nzAllowClear
                [ngModel]="planId()"
                (ngModelChange)="planId.set($event)"
              >
                @for (plan of plans(); track plan.id) {
                  <nz-option [nzValue]="plan.id" [nzLabel]="(plan.planNo ?? '草稿') + ' · ' + plan.purpose" />
                }
              </nz-select>
              <span class="filter-bar__spacer"></span>
              <button nz-button nzType="primary" [nzLoading]="saving()" (click)="report()">上报位置</button>
              <button nz-button [disabled]="saving()" (click)="simulate()">模拟移动</button>
            </div>
              <app-schema-form [fields]="reportFields" [(model)]="reportModel" />
          }
        </div>

        <div class="card mt-16">
          <div class="card__title">实时位置与空域叠加</div>
          <app-map-canvas [height]="420" [zones]="mapZones()" [markers]="mapMarkers()" [path]="trackPath()" />
          <div class="text-secondary mt-8">红点为所选飞行器最新位置（脉冲标记），蓝色虚线为最近轨迹；地图叠加生效中的空域与围栏。</div>
        </div>

        <div class="card mt-16">
          <div class="card__title">
            轨迹点
            <span class="text-secondary card__subtitle">最近 {{ tracks().length }} 个</span>
          </div>
          @if (!tracks().length) {
            <div class="text-secondary">暂无轨迹数据，上报一次位置后即可显示。</div>
          } @else {
            <div class="track-list">
              @for (point of recentTracks(); track $index) {
                <div class="track-item">
                  <span class="mono">{{ point.lat.toFixed(5) }}, {{ point.lng.toFixed(5) }}</span>
                  <span class="text-secondary">{{ point.altitudeM }} m</span>
                  <span class="text-secondary">{{ fmt(point.at) }}</span>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <div>
        <div class="card">
          <div class="card__title">上报结果</div>
          @if (result(); as res) {
            @if (res.detectedViolations?.length) {
              <nz-alert
                nzType="warning"
                nzShowIcon
                [nzMessage]="'检测到 ' + res.detectedViolations.length + ' 条违规'"
                [nzDescription]="violationTpl"
              />
              <ng-template #violationTpl>
                <ul class="plain-list">
                  @for (item of res.detectedViolations; track item.id) {
                    <li>{{ typeText(item.type) }}：{{ item.description }}</li>
                  }
                </ul>
              </ng-template>
            } @else {
              <nz-alert nzType="success" nzShowIcon nzMessage="本次上报未检测到违规" />
            }
            <div class="result-line mt-8">
              <span>距申报航线</span>
              <b>{{ res.distanceToRouteKm != null ? (res.distanceToRouteKm | number: '1.2-2') + ' km' : '未关联航线' }}</b>
            </div>
          } @else {
            <div class="text-secondary">尚无上报结果，选择飞行器并上报位置后将在此展示违规检测结果。</div>
          }
        </div>

        <div class="card mt-16">
          <div class="card__title">
            最近违规记录
            <span class="text-secondary card__subtitle">最新 10 条</span>
          </div>
          @if (!perm.can('airspace.violation.read')) {
            <div class="text-secondary">当前账号无违规记录查看权限。</div>
          } @else if (recentLoading()) {
            <div class="page-loading"><nz-spin /></div>
          } @else if (!recent().length) {
            <div class="text-secondary">暂无违规记录。</div>
          } @else {
            <div class="recent-list">
              @for (item of recent(); track item.id) {
                <div class="recent-item">
                  <div class="recent-item__head">
                    <b>{{ typeText(item.type) }}</b>
                    <span class="text-secondary">{{ fmt(item.occurredAt) }}</span>
                  </div>
                  <div class="text-secondary">{{ item.description }}</div>
                </div>
              }
            </div>
          }
        </div>

        <div class="card mt-16">
          <div class="card__title">监控说明</div>
          <ul class="plain-list">
            <li>偏航判定阈值（系统配置 airspace.deviation.threshold.km）：{{ thresholdText() }}</li>
            <li>飞行器进入禁飞区、限飞区或临时管制区将自动生成违规记录。</li>
            <li>自动上报每 5 秒触发一次，仅用于演示联调，关闭页面即停止。</li>
            <li>同一飞行器同类型违规在去重时间窗内不会重复生成。</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .report-switch {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 400;
        color: #6b7688;
      }
      .track-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 240px;
        overflow: auto;
      }
      .track-item {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
        padding: 4px 8px;
        border: 1px solid #eef1f6;
        border-radius: 6px;
      }
      .result-line {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
      }
      .result-line b {
        color: #1677ff;
      }
      .plain-list {
        margin: 0;
        padding-left: 18px;
        font-size: 13px;
      }
      .plain-list li {
        line-height: 1.9;
      }
      .recent-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 280px;
        overflow: auto;
      }
      .recent-item {
        border: 1px solid #eef1f6;
        border-radius: 6px;
        padding: 8px 10px;
        font-size: 12px;
      }
      .recent-item__head {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        font-size: 13px;
        margin-bottom: 2px;
      }
    `,
  ],
})
export class MonitoringPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  readonly perm = inject(PermissionService);

  readonly drones = signal<DroneDto[]>([]);
  readonly droneId = signal<string | null>(null);
  readonly plans = signal<FlightPlanDto[]>([]);
  readonly planId = signal<string | null>(null);

  readonly saving = signal(false);
  readonly autoReport = signal(false);
  readonly tracks = signal<TrackPoint[]>([]);
  readonly result = signal<PositionReportResultDto | null>(null);

  readonly zones = signal<AirspaceZoneDto[]>([]);
  readonly recent = signal<ViolationDto[]>([]);
  readonly recentLoading = signal(false);
  readonly threshold = signal<string | null>(null);

  readonly reportModel = signal<Record<string, unknown>>({
    lat: DEFAULT_CENTER.lat,
    lng: DEFAULT_CENTER.lng,
    altitudeM: 120,
    reportedAt: this.toIso(new Date()),
  });

  readonly reportFields: FormField[] = [
    { key: 'lat', label: '纬度', type: 'number', required: true, min: -90, max: 90, step: 0.0001 },
    { key: 'lng', label: '经度', type: 'number', required: true, min: -180, max: 180, step: 0.0001 },
    { key: 'altitudeM', label: '高度(m)', type: 'number', required: true, min: 0, max: 1000, step: 5 },
    { key: 'reportedAt', label: '上报时间', type: 'datetime', required: true },
  ];

  readonly trackPath = computed<LatLng[]>(() => this.tracks().map((point) => ({ lat: point.lat, lng: point.lng })));

  readonly recentTracks = computed<TrackPoint[]>(() => this.tracks().slice(-12).reverse());

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

  readonly mapMarkers = computed<MapMarker[]>(() => {
    const last = this.tracks().at(-1);
    const model = this.reportModel();
    const lat = last?.lat ?? Number(model['lat']);
    const lng = last?.lng ?? Number(model['lng']);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{ lat, lng, label: this.droneLabel(), tone: 'red', pulse: true }];
  });

  readonly thresholdText = computed(() => {
    const value = this.threshold();
    if (value) return `${value} 公里`;
    return this.perm.can('config.param.manage')
      ? '正在读取…'
      : '默认 1 公里（当前账号无配置读取权限，以系统配置为准）';
  });

  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.loadDrones();
    this.loadPlans();
    this.loadZones();
    this.loadRecent();
    this.loadConfig();
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  canReport(): boolean {
    return this.perm.can('airspace.monitoring.report');
  }

  refresh(): void {
    this.loadZones();
    this.loadRecent();
    this.loadPlans();
    this.loadConfig();
  }

  onDrone(value: string | number | null): void {
    const next = value ? String(value) : null;
    if (next !== this.droneId()) {
      this.tracks.set([]);
      this.result.set(null);
    }
    this.droneId.set(next);
  }

  droneLabel(): string {
    const id = this.droneId();
    const drone = this.drones().find((item) => item.id === id);
    return drone?.serialNo ?? '飞行器';
  }

  typeText(type: string): string {
    return ViolationTypeNameText[type] ?? type;
  }

  fmt(value: unknown): string {
    return formatDateTime(value);
  }

  report(): void {
    if (!this.canReport() || this.saving()) return;
    const droneId = this.droneId();
    if (!droneId) {
      this.message.warning('请先选择飞行器');
      return;
    }
    const model = this.reportModel();
    const lat = Number(model['lat']);
    const lng = Number(model['lng']);
    const altitudeM = Number(model['altitudeM']);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      this.message.warning('请填写有效的经纬度');
      return;
    }
    const body: ReportPositionRequest = {
      droneId,
      lat,
      lng,
      altitudeM: Number.isFinite(altitudeM) ? altitudeM : 0,
      reportedAt: (model['reportedAt'] as string | null) || null,
      flightPlanId: this.planId(),
    };
    this.saving.set(true);
    this.api.post<PositionReportResultDto>('/airspace/monitoring/positions', body).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.result.set(res);
        this.tracks.update((list) => [
          ...list.slice(-(MAX_TRACK_POINTS - 1)),
          { lat, lng, altitudeM: body.altitudeM, at: body.reportedAt ?? new Date().toISOString() },
        ]);
        if (res.detectedViolations?.length) {
          this.message.warning(`检测到 ${res.detectedViolations.length} 条违规`);
          this.loadRecent();
        } else {
          this.message.success('位置已上报');
        }
      },
      error: () => this.saving.set(false),
    });
  }

  simulate(): void {
    if (!this.canReport()) return;
    if (!this.droneId()) {
      this.message.warning('请先选择飞行器');
      return;
    }
    const last = this.tracks().at(-1);
    const model = this.reportModel();
    const baseLat = last?.lat ?? Number(model['lat']);
    const baseLng = last?.lng ?? Number(model['lng']);
    const baseAltitude = last?.altitudeM ?? Number(model['altitudeM']);
    const lat = Number((this.validCoord(baseLat, DEFAULT_CENTER.lat) + (Math.random() - 0.5) * 0.0016).toFixed(6));
    const lng = Number((this.validCoord(baseLng, DEFAULT_CENTER.lng) + (Math.random() - 0.5) * 0.0016).toFixed(6));
    const altitudeM = Math.max(30, Math.round(this.validCoord(baseAltitude, 120) + (Math.random() - 0.5) * 20));
    this.reportModel.update((prev) => ({ ...prev, lat, lng, altitudeM, reportedAt: this.toIso(new Date()) }));
    this.report();
  }

  toggleAuto(enabled: boolean): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    if (enabled && !this.droneId()) {
      this.message.warning('请先选择飞行器再开启自动上报');
      this.autoReport.set(false);
      return;
    }
    this.autoReport.set(enabled);
    if (enabled) {
      this.simulate();
      this.timer = setInterval(() => this.simulate(), AUTO_REPORT_MS);
    }
  }

  private loadDrones(): void {
    if (!this.perm.can('resource.drone.read')) return;
    this.api.get<Paged<DroneDto>>('/resource/drones', { pageNum: 1, pageSize: 200 }).subscribe({
      next: (page) => {
        const items = page.items ?? [];
        this.drones.set(items);
        if (!this.droneId() && items.length) this.droneId.set(items[0].id);
      },
      error: () => undefined,
    });
  }

  private loadPlans(): void {
    if (!this.perm.can('airspace.read')) return;
    this.api.get<Paged<FlightPlanDto>>('/airspace/flight-plans', { pageNum: 1, pageSize: 100 }).subscribe({
      next: (page) => this.plans.set(page.items ?? []),
      error: () => undefined,
    });
  }

  private loadZones(): void {
    if (!this.perm.can('airspace.read')) return;
    this.api.get<Paged<AirspaceZoneDto>>('/airspace/zones', { pageNum: 1, pageSize: 200, activeOnly: true }).subscribe({
      next: (page) => this.zones.set(page.items ?? []),
      error: () => undefined,
    });
  }

  private loadRecent(): void {
    if (!this.perm.can('airspace.violation.read')) return;
    this.recentLoading.set(true);
    this.api.get<Paged<ViolationDto>>('/airspace/violations', { pageNum: 1, pageSize: 10 }).subscribe({
      next: (page) => {
        this.recent.set(page.items ?? []);
        this.recentLoading.set(false);
      },
      error: () => this.recentLoading.set(false),
    });
  }

  private loadConfig(): void {
    if (!this.perm.can('config.param.manage')) return;
    this.api.get<SystemConfigDto[]>('/admin/config/params', { group: '空域配置' }).subscribe({
      next: (items) => {
        const item = (items ?? []).find((config) => config.key === 'airspace.deviation.threshold.km');
        this.threshold.set(item?.value ?? null);
      },
      error: () => undefined,
    });
  }

  private validCoord(value: number, fallback: number): number {
    return Number.isFinite(value) ? value : fallback;
  }

  private toIso(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  }
}



