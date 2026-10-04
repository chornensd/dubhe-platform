import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ApiService } from '../../core/api.service';
import {
  CrewDto,
  CrewRoleNameText,
  DroneDto,
  FaultDto,
  FaultStatus,
  FaultStatusNameText,
  HandleFaultRequest,
  Paged,
  ReportFaultRequest,
  ResolveFaultRequest,
  UserListItemDto,
} from '../../core/api-types';
import { ConfirmService } from '../../core/confirm.service';
import { PagedList, nameMap } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent } from '../../shared/data-table';
import { LatLng, MapCanvasComponent, MapMarker } from '../../shared/map-canvas';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { SearchSelectComponent, SelectOption } from '../../shared/search-select';

type FaultRow = FaultDto & Record<string, unknown>;

@Component({
  selector: 'app-faults',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    DataTableComponent,
    MapCanvasComponent,
    ModalComponent,
    PageHeaderComponent,
    SchemaFormComponent,
    SearchSelectComponent,
  ],
  template: `
    <app-page-header title="故障处理" subtitle="飞行器故障上报、维保派单与解决闭环">
      @if (perm.can('resource.fault.report')) {
        <button nz-button nzType="primary" (click)="openReport()">
          <span nz-icon nzType="alert"></span> 上报故障
        </button>
      }
      <button nz-button (click)="list.reload()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="card">
      <div class="filter-bar">
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
        @if (canLoadDrones()) {
          <nz-select
            style="width: 240px"
            nzPlaceHolder="全部飞行器"
            nzAllowClear
            nzShowSearch
            [ngModel]="droneId()"
            (ngModelChange)="onDrone($event)"
          >
            @for (drone of drones(); track drone.id) {
              <nz-option [nzValue]="drone.id" [nzLabel]="drone.serialNo + ' · ' + drone.model" />
            }
          </nz-select>
        } @else {
          <input
            nz-input
            style="width: 220px"
            placeholder="飞行器 ID"
            [ngModel]="droneId()"
            (ngModelChange)="onDrone($event)"
          />
        }
        @if (canPickMerchant()) {
          <app-search-select
            style="width: 240px"
            [options]="merchantOptions()"
            [loading]="merchantLoading()"
            placeholder="按商家筛选"
            [ngModel]="merchantId()"
            (ngModelChange)="onMerchant($event)"
            (search)="loadMerchants($event)"
          />
        }
        <button nz-button (click)="reset()">重置</button>
        <span class="filter-bar__spacer"></span>
        <span class="text-secondary">共 {{ list.total() }} 条故障</span>
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
      >
        <ng-template #actions let-row>
          @if (row.status !== 'Resolved' && perm.can('resource.fault.manage')) {
            <button nz-button nzType="link" nzSize="small" (click)="openHandle(row)">处理</button>
            <button nz-button nzType="link" nzSize="small" (click)="resolve(row)">解决</button>
          } @else {
            <span class="text-secondary">-</span>
          }
        </ng-template>
      </app-data-table>
    </div>

    <app-modal [(open)]="reportOpen" title="上报故障" okText="提交上报" [loading]="saving()" [width]="720" (ok)="submitReport()">
      <app-schema-form [fields]="reportFields()" [(model)]="reportModel" />
      <div class="card__title">故障位置</div>
      <app-map-canvas [height]="220" [markers]="reportMarkers()" [pickable]="true" (pick)="onPick($event)" />
      <div class="text-secondary mt-8">点击地图可拾取故障发生位置，或直接修改上方经纬度。</div>
    </app-modal>

    <app-modal [(open)]="handleOpen" title="故障处理派单" okText="提交处理" [loading]="saving()" [width]="620" (ok)="submitHandle()">
      @if (handling(); as fault) {
        <div class="text-secondary mb-8">故障描述：{{ fault.description }}</div>
      }
      <app-schema-form [fields]="handleFields()" [(model)]="handleModel" />
    </app-modal>
  `,
})
export class FaultListPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  readonly perm = inject(PermissionService);

  readonly status = signal<number | null>(null);
  readonly droneId = signal<string | null>(null);
  readonly merchantId = signal<string | null>(null);

  readonly saving = signal(false);
  readonly reportOpen = signal(false);
  readonly handleOpen = signal(false);

  readonly handling = signal<FaultRow | null>(null);

  readonly drones = signal<DroneDto[]>([]);
  readonly crews = signal<CrewDto[]>([]);
  readonly merchantOptions = signal<SelectOption[]>([]);
  readonly merchantLoading = signal(false);

  reportModel: Record<string, unknown> = {};
  handleModel: Record<string, unknown> = {};

  readonly list = new PagedList<FaultRow>((query) =>
    this.api.get<Paged<FaultRow>>('/resource/faults', {
      ...query,
      status: this.status() ?? undefined,
      droneId: this.droneId() || undefined,
      merchantId: this.merchantId() || undefined,
    }),
  );

  readonly droneMap = computed<Record<string, string>>(() =>
    nameMap(this.drones(), (d) => d.id, (d) => d.serialNo),
  );

  readonly columns: DataColumn<FaultRow>[] = [
    {
      key: 'droneId',
      title: '飞行器',
      width: '150px',
      pipe: (row) => this.droneMap()[row.droneId] ?? row.droneId,
    },
    { key: 'faultType', title: '故障类型', width: '140px' },
    { key: 'description', title: '描述', ellipsis: true },
    {
      key: 'location',
      title: '故障位置',
      width: '170px',
      pipe: (row) => (row.lat != null && row.lng != null ? `${row.lat.toFixed(4)}, ${row.lng.toFixed(4)}` : '-'),
    },
    { key: 'status', title: '状态', width: '100px', type: 'status', map: FaultStatusNameText },
    { key: 'reportedAt', title: '上报时间', width: '150px', type: 'datetime' },
    { key: 'resolvedAt', title: '解决时间', width: '150px', type: 'datetime' },
  ];

  readonly statusOptions = [
    { value: FaultStatus.Reported, label: '已上报' },
    { value: FaultStatus.Handling, label: '处理中' },
    { value: FaultStatus.Resolved, label: '已解决' },
  ];

  reportMarkers(): MapMarker[] {
    const lat = this.toNumber(this.reportModel['lat']);
    const lng = this.toNumber(this.reportModel['lng']);
    return lat !== null && lng !== null ? [{ lat, lng, label: '故障位置', tone: 'red', pulse: true }] : [];
  }

  readonly canLoadDrones = computed(() => this.perm.can('resource.drone.read'));
  readonly canPickMerchant = computed(() => this.perm.can('account.user.manage'));

  readonly reportFields = computed<FormField[]>(() => {
    const droneField: FormField = this.canLoadDrones()
      ? {
          key: 'droneId',
          label: '故障飞行器',
          type: 'select',
          required: true,
          span: 12,
          placeholder: '选择飞行器',
          options: this.drones().map((d) => ({ value: d.id, label: `${d.serialNo} · ${d.model}` })),
        }
      : { key: 'droneId', label: '飞行器 ID', type: 'text', required: true, span: 12 };
    return [
      droneField,
      { key: 'faultType', label: '故障类型', type: 'text', required: true, span: 12, maxLength: 64, placeholder: '如 电机异常 / 电池故障' },
      { key: 'description', label: '故障描述', type: 'textarea', required: true, span: 24, maxLength: 500 },
      { key: 'lat', label: '纬度', type: 'number', span: 12, min: -90, max: 90, step: 0.0001 },
      { key: 'lng', label: '经度', type: 'number', span: 12, min: -180, max: 180, step: 0.0001 },
      { key: 'photoText', label: '现场照片', type: 'textarea', span: 24, rows: 3, help: '每行一个图片链接，提交后转为照片地址列表', placeholder: 'https://…\nhttps://…' },
    ];
  });

  readonly handleFields = computed<FormField[]>(() => {
    if (this.perm.can('resource.crew.manage')) {
      return [
        {
          key: 'handlerCrewId',
          label: '维保人员',
          type: 'select',
          required: true,
          span: 24,
          placeholder: '选择维保人员',
          options: this.crews().map((c) => ({ value: c.id, label: `${c.name}（${CrewRoleNameText[c.role] ?? c.role}）` })),
        },
      ];
    }
    return [{ key: 'handlerCrewId', label: '维保人员 ID', type: 'text', required: true, span: 24 }];
  });

  ngOnInit(): void {
    this.list.reload();
    this.loadOptions();
    if (this.canPickMerchant()) this.loadMerchants('');
  }

  onStatus(value: number | null): void {
    this.status.set(value);
    this.list.filter({});
  }

  onDrone(value: string | null): void {
    this.droneId.set(value);
    this.list.filter({});
  }

  onMerchant(value: string | number | null): void {
    this.merchantId.set(value ? String(value) : null);
    this.list.filter({});
  }

  reset(): void {
    this.status.set(null);
    this.droneId.set(null);
    this.merchantId.set(null);
    this.list.filter({});
  }

  openReport(): void {
    this.reportModel = { droneId: null, faultType: '', description: '', lat: null, lng: null, photoText: '' };
    this.reportOpen.set(true);
  }

  onPick(point: LatLng): void {
    this.reportModel = {
      ...this.reportModel,
      lat: Number(point.lat.toFixed(6)),
      lng: Number(point.lng.toFixed(6)),
    };
  }

  submitReport(): void {
    const photoUrls = String(this.reportModel['photoText'] ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => !!line);
    const body: ReportFaultRequest = {
      droneId: String(this.reportModel['droneId'] ?? ''),
      faultType: String(this.reportModel['faultType'] ?? '').trim(),
      description: String(this.reportModel['description'] ?? '').trim(),
      photoUrls: photoUrls.length ? photoUrls : null,
      lat: this.toNumber(this.reportModel['lat']),
      lng: this.toNumber(this.reportModel['lng']),
    };
    if (!body.droneId || !body.faultType || !body.description) {
      this.message.warning('请填写故障飞行器、类型与描述');
      return;
    }
    this.saving.set(true);
    this.api.post<FaultDto>('/resource/faults', body).subscribe({
      next: () => {
        this.saving.set(false);
        this.reportOpen.set(false);
        this.message.success('故障已上报');
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  openHandle(row: FaultRow): void {
    this.handling.set(row);
    this.handleModel = { handlerCrewId: null };
    this.handleOpen.set(true);
  }

  submitHandle(): void {
    const fault = this.handling();
    if (!fault) return;
    const handlerCrewId = String(this.handleModel['handlerCrewId'] ?? '');
    if (!handlerCrewId) {
      this.message.warning('请选择维保人员');
      return;
    }
    const body: HandleFaultRequest = { handlerCrewId };
    this.saving.set(true);
    this.api.post<FaultDto>(`/resource/faults/${fault.id}/handle`, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.handleOpen.set(false);
        this.message.success('已派单，故障进入处理中');
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  resolve(row: FaultRow): void {
    this.confirm
      .prompt({
        title: '故障解决',
        placeholder: '请填写处理结果与解决方案',
        multiline: true,
        danger: false,
      })
      .subscribe((resolution) => {
        if (!resolution) return;
        const body: ResolveFaultRequest = { resolution };
        this.api.post<FaultDto>(`/resource/faults/${row.id}/resolve`, body).subscribe({
          next: () => {
            this.message.success('故障已解决');
            this.list.reload();
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

  private loadOptions(): void {
    if (this.canLoadDrones()) {
      this.api.get<Paged<DroneDto>>('/resource/drones', { pageNum: 1, pageSize: 200 }).subscribe({
        next: (page) => this.drones.set(page.items ?? []),
        error: () => undefined,
      });
    }
    if (this.perm.can('resource.crew.manage')) {
      this.api.get<Paged<CrewDto>>('/resource/crew', { pageNum: 1, pageSize: 200, role: 2 }).subscribe({
        next: (page) => this.crews.set(page.items ?? []),
        error: () => undefined,
      });
    }
  }

  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
}

