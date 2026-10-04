import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ApiService } from '../../core/api.service';
import {
  CreateMaintenanceRecordRequest,
  CrewDto,
  CrewRoleNameText,
  DroneDto,
  DroneStatusNameText,
  MaintenancePlanDto,
  MaintenanceRecordDto,
  MaintenanceStatusNameText,
  Paged,
  UpsertMaintenancePlanRequest,
} from '../../core/api-types';
import { nameMap } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent } from '../../shared/data-table';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';

type PlanRow = MaintenancePlanDto & Record<string, unknown>;
type RecordRow = MaintenanceRecordDto & Record<string, unknown>;

@Component({
  selector: 'app-maintenance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzIconModule,
    NzSelectModule,
    DataTableComponent,
    ModalComponent,
    PageHeaderComponent,
    SchemaFormComponent,
  ],
  template: `
    <app-page-header title="维保管理" subtitle="飞行器维保计划、到期预警与维保记录留痕">
      <button nz-button (click)="refresh()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <nz-alert
      class="mb-16"
      nzType="warning"
      nzShowIcon
      nzMessage="超期未维保飞行器禁止调度"
      nzDescription="维保状态为「已超期」的飞行器将无法被派发订单，请及时安排维保并在下方登记维保记录。"
    />

    <div class="card">
      <div class="card__title">
        维保计划
        @if (perm.can('resource.maintenance.manage')) {
          <button nz-button nzSize="small" nzType="primary" (click)="openPlan()">
            <span nz-icon nzType="plus"></span> 新增计划
          </button>
        }
      </div>
      <div class="filter-bar">
        @if (canLoadDrones()) {
          <nz-select
            style="width: 260px"
            nzPlaceHolder="按飞行器筛选"
            nzAllowClear
            nzShowSearch
            [ngModel]="planDroneId()"
            (ngModelChange)="onPlanDrone($event)"
          >
            @for (drone of drones(); track drone.id) {
              <nz-option [nzValue]="drone.id" [nzLabel]="drone.serialNo + ' · ' + drone.model" />
            }
          </nz-select>
        } @else {
          <input
            nz-input
            style="width: 260px"
            placeholder="飞行器 ID 筛选"
            [ngModel]="planDroneId()"
            (ngModelChange)="onPlanDrone($event)"
          />
        }
        <button nz-button (click)="loadPlans()"><span nz-icon nzType="search"></span> 查询</button>
        <span class="filter-bar__spacer"></span>
        <span class="text-secondary">共 {{ plans().length }} 条计划</span>
      </div>
      <app-data-table
        [columns]="planColumns"
        [rows]="plans()"
        [total]="plans().length"
        [pageNum]="1"
        [pageSize]="100"
        [loading]="plansLoading()"
        scrollX="1180px"
      >
        <ng-template #actions let-row>
          @if (perm.can('resource.maintenance.manage')) {
            <button nz-button nzType="link" nzSize="small" (click)="openPlan(row)">编辑</button>
            <button nz-button nzType="link" nzSize="small" (click)="openRecord(row.droneId, row.id)">登记维保</button>
          }
        </ng-template>
      </app-data-table>
    </div>

    <div class="card mt-16">
      <div class="card__title">
        维保记录
        @if (perm.can('resource.maintenance.manage')) {
          <button nz-button nzSize="small" nzType="primary" (click)="openRecord()">
            <span nz-icon nzType="plus"></span> 新增记录
          </button>
        }
      </div>
      <div class="filter-bar">
        @if (canLoadDrones()) {
          <nz-select
            style="width: 260px"
            nzPlaceHolder="全部飞行器"
            nzAllowClear
            nzShowSearch
            [ngModel]="recordDroneId()"
            (ngModelChange)="recordDroneId.set($event)"
          >
            @for (drone of drones(); track drone.id) {
              <nz-option [nzValue]="drone.id" [nzLabel]="drone.serialNo + ' · ' + drone.model" />
            }
          </nz-select>
        } @else {
          <input
            nz-input
            style="width: 260px"
            placeholder="飞行器 ID"
            [ngModel]="recordDroneId()"
            (ngModelChange)="recordDroneId.set($event)"
          />
        }
        <nz-range-picker
          nzShowTime
          nzFormat="yyyy-MM-dd HH:mm"
          [ngModel]="recordRange()"
          (ngModelChange)="recordRange.set($event)"
        />
        <button nz-button nzType="primary" (click)="loadRecords()"><span nz-icon nzType="search"></span> 查询</button>
        <button nz-button (click)="resetRecords()">重置</button>
        <span class="filter-bar__spacer"></span>
        <span class="text-secondary">共 {{ records().length }} 条记录</span>
      </div>
      <app-data-table
        [columns]="recordColumns"
        [rows]="records()"
        [total]="records().length"
        [pageNum]="1"
        [pageSize]="100"
        [loading]="recordsLoading()"
        scrollX="1180px"
      >
        <ng-template #actions let-row>
          @if (row.fileUrl) {
            <a nz-button nzType="link" nzSize="small" [href]="row.fileUrl" target="_blank" rel="noopener">附件</a>
          } @else {
            <span class="text-secondary">-</span>
          }
        </ng-template>
      </app-data-table>
    </div>

    <app-modal
      [(open)]="planOpen"
      [title]="editingPlan() ? '编辑维保计划' : '新增维保计划'"
      okText="保存"
      [loading]="saving()"
      [width]="680"
      (ok)="submitPlan()"
    >
      <app-schema-form [fields]="planFields()" [(model)]="planModel" />
    </app-modal>

    <app-modal [(open)]="recordOpen" title="维保记录" okText="保存" [loading]="saving()" [width]="680" (ok)="submitRecord()">
      <app-schema-form [fields]="recordFields()" [(model)]="recordModel" />
    </app-modal>
  `,
})
export class MaintenancePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  readonly perm = inject(PermissionService);

  readonly plans = signal<PlanRow[]>([]);
  readonly plansLoading = signal(false);
  readonly planDroneId = signal<string | null>(null);
  readonly editingPlan = signal<PlanRow | null>(null);

  readonly records = signal<RecordRow[]>([]);
  readonly recordsLoading = signal(false);
  readonly recordDroneId = signal<string | null>(null);
  readonly recordRange = signal<Date[] | null>(null);

  readonly drones = signal<DroneDto[]>([]);
  readonly crews = signal<CrewDto[]>([]);

  readonly saving = signal(false);
  readonly planOpen = signal(false);
  readonly recordOpen = signal(false);

  planModel: Record<string, unknown> = {};
  recordModel: Record<string, unknown> = {};

  readonly droneMap = computed<Record<string, string>>(() =>
    nameMap(this.drones(), (d) => d.id, (d) => d.serialNo),
  );

  readonly crewMap = computed<Record<string, string>>(() =>
    nameMap(this.crews(), (c) => c.id, (c) => c.name),
  );

  readonly planColumns: DataColumn<PlanRow>[] = [
    { key: 'droneSerialNo', title: '飞行器编号', width: '150px' },
    { key: 'enabled', title: '启用', width: '80px', type: 'boolean' },
    { key: 'intervalDays', title: '周期(天)', width: '100px', align: 'right', pipe: (row) => row.intervalDays ?? '-' },
    {
      key: 'intervalFlightMinutes',
      title: '周期(飞行分钟)',
      width: '140px',
      align: 'right',
      pipe: (row) => row.intervalFlightMinutes ?? '-',
    },
    { key: 'lastMaintainedAt', title: '上次维保', width: '150px', type: 'datetime' },
    { key: 'nextDueAt', title: '下次到期', width: '150px', type: 'datetime' },
    { key: 'status', title: '状态', width: '110px', type: 'status', map: MaintenanceStatusNameText },
    { key: 'remark', title: '备注', ellipsis: true, pipe: (row) => row.remark ?? '-' },
  ];

  readonly recordColumns: DataColumn<RecordRow>[] = [
    {
      key: 'droneId',
      title: '飞行器',
      width: '160px',
      pipe: (row) => this.droneMap()[row.droneId] ?? row.droneId,
    },
    { key: 'type', title: '维保类型', width: '140px' },
    { key: 'content', title: '维保内容', ellipsis: true },
    { key: 'maintainedAt', title: '维保时间', width: '150px', type: 'datetime' },
    {
      key: 'crewMemberId',
      title: '维保人员',
      width: '140px',
      pipe: (row) => (row.crewMemberId ? this.crewMap()[row.crewMemberId] ?? row.crewMemberId : '-'),
    },
    { key: 'createdAt', title: '登记时间', width: '150px', type: 'datetime' },
  ];

  readonly canLoadDrones = computed(() => this.perm.can('resource.drone.read'));

  readonly planFields = computed<FormField[]>(() => {
    const droneField: FormField = this.canLoadDrones()
      ? {
          key: 'droneId',
          label: '飞行器',
          type: 'select',
          required: true,
          span: 24,
          placeholder: '选择飞行器',
          disabled: !!this.editingPlan(),
          options: this.drones().map((d) => ({
            value: d.id,
            label: `${d.serialNo} · ${d.model} · ${DroneStatusNameText[d.status] ?? d.status}`,
          })),
        }
      : { key: 'droneId', label: '飞行器 ID', type: 'text', required: true, span: 24, disabled: !!this.editingPlan() };
    return [
      droneField,
      { key: 'intervalDays', label: '周期(天)', type: 'number', span: 12, min: 1, max: 3650, step: 1, help: '与飞行分钟周期至少填写一项' },
      { key: 'intervalFlightMinutes', label: '周期(飞行分钟)', type: 'number', span: 12, min: 1, max: 1000000, step: 1 },
      { key: 'enabled', label: '启用计划', type: 'switch', span: 12 },
      { key: 'remark', label: '备注', type: 'textarea', span: 24, maxLength: 200 },
    ];
  });

  readonly recordFields = computed<FormField[]>(() => {
    const droneField: FormField = this.canLoadDrones()
      ? {
          key: 'droneId',
          label: '飞行器',
          type: 'select',
          required: true,
          span: 12,
          placeholder: '选择飞行器',
          options: this.drones().map((d) => ({ value: d.id, label: `${d.serialNo} · ${d.model}` })),
        }
      : { key: 'droneId', label: '飞行器 ID', type: 'text', required: true, span: 12 };
    const planField: FormField = {
      key: 'planId',
      label: '关联计划',
      type: 'select',
      span: 12,
      placeholder: '选择维保计划（可选）',
      options: this.plans().map((plan) => ({
        value: plan.id,
        label: `${plan.droneSerialNo} · 周期 ${plan.intervalDays ?? '-'} 天`,
      })),
    };
    const crewField: FormField = this.perm.can('resource.crew.manage')
      ? {
          key: 'crewMemberId',
          label: '维保人员',
          type: 'select',
          span: 12,
          placeholder: '选择维保人员（可选）',
          options: this.crews().map((c) => ({ value: c.id, label: `${c.name}（${CrewRoleNameText[c.role] ?? c.role}）` })),
        }
      : { key: 'crewMemberId', label: '维保人员 ID', type: 'text', span: 12, placeholder: '填写人员 ID（可选）' };
    return [
      droneField,
      planField,
      { key: 'type', label: '维保类型', type: 'text', required: true, span: 12, maxLength: 64, placeholder: '如 例行保养 / 故障维修' },
      crewField,
      { key: 'maintainedAt', label: '维保时间', type: 'datetime', required: true, span: 12 },
      { key: 'content', label: '维保内容', type: 'textarea', required: true, span: 24, maxLength: 500 },
      { key: 'fileUrl', label: '附件链接', type: 'text', span: 24, maxLength: 256, placeholder: '维保工单/照片地址（可选）' },
    ];
  });

  ngOnInit(): void {
    this.loadOptions();
    this.loadPlans();
    this.loadRecords();
  }

  refresh(): void {
    this.loadPlans();
    this.loadRecords();
  }

  onPlanDrone(value: string | null): void {
    this.planDroneId.set(value);
    this.loadPlans();
  }

  loadPlans(): void {
    this.plansLoading.set(true);
    this.api
      .get<MaintenancePlanDto[] | Paged<MaintenancePlanDto>>('/resource/maintenance/plans', {
        droneId: this.planDroneId() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.plans.set(this.asItems(res));
          this.plansLoading.set(false);
        },
        error: () => {
          this.plans.set([]);
          this.plansLoading.set(false);
        },
      });
  }

  openPlan(row?: PlanRow): void {
    this.editingPlan.set(row ?? null);
    this.planModel = row
      ? {
          droneId: row.droneId,
          intervalDays: row.intervalDays ?? null,
          intervalFlightMinutes: row.intervalFlightMinutes ?? null,
          enabled: row.enabled,
          remark: row.remark ?? '',
        }
      : { droneId: null, intervalDays: 90, intervalFlightMinutes: null, enabled: true, remark: '' };
    this.planOpen.set(true);
  }

  submitPlan(): void {
    const body: UpsertMaintenancePlanRequest = {
      droneId: String(this.planModel['droneId'] ?? ''),
      intervalDays: this.toNumber(this.planModel['intervalDays']),
      intervalFlightMinutes: this.toNumber(this.planModel['intervalFlightMinutes']),
      enabled: !!this.planModel['enabled'],
      remark: (this.planModel['remark'] as string) || null,
    };
    if (!body.droneId) {
      this.message.warning('请选择飞行器');
      return;
    }
    if (body.intervalDays === null && body.intervalFlightMinutes === null) {
      this.message.warning('周期（天）与周期（飞行分钟）至少填写一项');
      return;
    }
    this.saving.set(true);
    this.api.post<MaintenancePlanDto>('/resource/maintenance/plans', body).subscribe({
      next: () => {
        this.saving.set(false);
        this.planOpen.set(false);
        this.message.success(this.editingPlan() ? '维保计划已更新' : '维保计划已创建');
        this.loadPlans();
      },
      error: () => this.saving.set(false),
    });
  }

  loadRecords(): void {
    const range = this.recordRange();
    this.recordsLoading.set(true);
    this.api
      .get<MaintenanceRecordDto[] | Paged<MaintenanceRecordDto>>('/resource/maintenance/records', {
        droneId: this.recordDroneId() || undefined,
        from: range?.[0] ? this.toIso(range[0]) : undefined,
        to: range?.[1] ? this.toIso(range[1]) : undefined,
      })
      .subscribe({
        next: (res) => {
          this.records.set(this.asItems(res));
          this.recordsLoading.set(false);
        },
        error: () => {
          this.records.set([]);
          this.recordsLoading.set(false);
        },
      });
  }

  resetRecords(): void {
    this.recordDroneId.set(null);
    this.recordRange.set(null);
    this.loadRecords();
  }

  openRecord(droneId?: string, planId?: string): void {
    this.recordModel = {
      droneId: droneId ?? null,
      planId: planId ?? null,
      type: '',
      crewMemberId: null,
      maintainedAt: null,
      content: '',
      fileUrl: '',
    };
    this.recordOpen.set(true);
  }

  submitRecord(): void {
    const body: CreateMaintenanceRecordRequest = {
      droneId: String(this.recordModel['droneId'] ?? ''),
      planId: (this.recordModel['planId'] as string) || null,
      crewMemberId: (this.recordModel['crewMemberId'] as string) || null,
      type: String(this.recordModel['type'] ?? '').trim(),
      content: String(this.recordModel['content'] ?? '').trim(),
      maintainedAt: String(this.recordModel['maintainedAt'] ?? ''),
      fileUrl: (this.recordModel['fileUrl'] as string) || null,
    };
    if (!body.droneId || !body.type || !body.content || !body.maintainedAt) {
      this.message.warning('请完整填写飞行器、维保类型、内容与时间');
      return;
    }
    this.saving.set(true);
    this.api.post<MaintenanceRecordDto>('/resource/maintenance/records', body).subscribe({
      next: () => {
        this.saving.set(false);
        this.recordOpen.set(false);
        this.message.success('维保记录已登记');
        this.loadRecords();
        this.loadPlans();
      },
      error: () => this.saving.set(false),
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

  private asItems<T>(res: T[] | Paged<T> | null | undefined): (T & Record<string, unknown>)[] {
    if (!res) return [];
    return (Array.isArray(res) ? res : (res.items ?? [])) as (T & Record<string, unknown>)[];
  }

  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private toIso(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  }
}
