import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { ApiService } from '../../core/api.service';
import {
  AddQualificationRequest,
  AttendanceDto,
  AttendanceStatus,
  AttendanceStatusNameText,
  CreateScheduleRequest,
  CrewDto,
  CrewRole,
  CrewRoleNameText,
  CrewStatus,
  CrewStatusNameText,
  DroneDto,
  Paged,
  QualificationDto,
  RecordAttendanceRequest,
  ScheduleDto,
  UpdateCrewRequest,
} from '../../core/api-types';
import { nameMap } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent, formatDateTime } from '../../shared/data-table';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { StatusTagComponent } from '../../shared/status-tag';

type AttendanceRow = AttendanceDto & Record<string, unknown>;
type ScheduleRow = ScheduleDto & Record<string, unknown>;

const CrewRoleValue: Record<string, number> = { Pilot: 1, Maintenance: 2 };
const CrewStatusValue: Record<string, number> = { Active: 1, Suspended: 2, Departed: 3 };

@Component({
  selector: 'app-crew-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzDatePickerModule,
    NzEmptyModule,
    NzIconModule,
    NzSpinModule,
    DataTableComponent,
    ModalComponent,
    PageHeaderComponent,
    SchemaFormComponent,
    StatusTagComponent,
  ],
  template: `
    <app-page-header [title]="title()" subtitle="人员基本信息、资质证书、排班计划与考勤记录">
      <button nz-button (click)="back()"><span nz-icon nzType="left"></span> 返回列表</button>
      @if (perm.can('resource.crew.manage')) {
        <button nz-button nzType="primary" (click)="openEdit()"><span nz-icon nzType="edit"></span> 编辑资料</button>
      }
    </app-page-header>

    @if (loading()) {
      <div class="page-loading"><nz-spin nzTip="加载中" /></div>
    } @else if (crew(); as c) {
      <div class="card">
        <div class="card__title">基本信息</div>
        <div class="desc-grid">
          <div class="desc-item"><span class="desc-item__label">姓名</span><span class="desc-item__value">{{ c.name }}</span></div>
          <div class="desc-item"><span class="desc-item__label">性别</span><span class="desc-item__value">{{ c.gender || '-' }}</span></div>
          <div class="desc-item"><span class="desc-item__label">联系电话</span><span class="desc-item__value">{{ c.phone }}</span></div>
          <div class="desc-item">
            <span class="desc-item__label">角色</span>
            <span class="desc-item__value"><app-status-tag [value]="c.role" [map]="CrewRoleNameText" /></span>
          </div>
          <div class="desc-item"><span class="desc-item__label">负责区域</span><span class="desc-item__value">{{ c.region || '-' }}</span></div>
          <div class="desc-item">
            <span class="desc-item__label">在职状态</span>
            <span class="desc-item__value"><app-status-tag [value]="c.status" [map]="CrewStatusNameText" /></span>
          </div>
          <div class="desc-item"><span class="desc-item__label">资质数量</span><span class="desc-item__value">{{ c.qualificationCount }}</span></div>
          <div class="desc-item"><span class="desc-item__label">入职时间</span><span class="desc-item__value">{{ formatDateTime(c.createdAt) }}</span></div>
          <div class="desc-item"><span class="desc-item__label">所属商家</span><span class="desc-item__value mono">{{ c.merchantId }}</span></div>
          <div class="desc-item"><span class="desc-item__label">关联用户</span><span class="desc-item__value mono">{{ c.userId || '未关联' }}</span></div>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card__title">
          资质证书
          @if (perm.can('resource.crew.manage')) {
            <button nz-button nzSize="small" nzType="primary" (click)="openQualification()">
              <span nz-icon nzType="plus"></span> 新增资质
            </button>
          }
        </div>
        <app-data-table
          [columns]="qualificationColumns"
          [rows]="qualifications()"
          [total]="qualifications().length"
          [pageNum]="1"
          [pageSize]="100"
          scrollX="880px"
        >
          <ng-template #actions let-row>
            @if (row.fileUrl) {
              <a nz-button nzType="link" nzSize="small" [href]="row.fileUrl" target="_blank" rel="noopener">文件</a>
            }
            @if (perm.can('resource.crew.manage')) {
              <button nz-button nzType="link" nzSize="small" (click)="openQualification(row)">编辑</button>
            }
          </ng-template>
        </app-data-table>
      </div>

      <div class="card mt-16">
        <div class="card__title">
          排班计划
          @if (perm.can('resource.crew.manage')) {
            <button nz-button nzSize="small" nzType="primary" (click)="openSchedule()">
              <span nz-icon nzType="plus"></span> 新增排班
            </button>
          }
        </div>
        <div class="filter-bar">
          <nz-range-picker
            nzShowTime
            nzFormat="yyyy-MM-dd HH:mm"
            [ngModel]="scheduleRange()"
            (ngModelChange)="scheduleRange.set($event)"
          />
          <button nz-button nzType="primary" (click)="loadSchedules()"><span nz-icon nzType="search"></span> 查询</button>
          <button nz-button (click)="resetScheduleRange()">重置</button>
          <span class="filter-bar__spacer"></span>
          <span class="text-secondary">共 {{ schedules().length }} 条排班</span>
        </div>
        <app-data-table
          [columns]="scheduleColumns"
          [rows]="schedules()"
          [total]="schedules().length"
          [pageNum]="1"
          [pageSize]="100"
          [loading]="schedulesLoading()"
          scrollX="960px"
        />
      </div>

      <div class="card mt-16">
        <div class="card__title">
          考勤记录
          @if (perm.can('resource.crew.manage')) {
            <button nz-button nzSize="small" nzType="primary" (click)="openAttendance()">
              <span nz-icon nzType="plus"></span> 登记考勤
            </button>
          }
        </div>
        <div class="filter-bar">
          <nz-range-picker
            nzFormat="yyyy-MM-dd"
            [ngModel]="attendanceRange()"
            (ngModelChange)="attendanceRange.set($event)"
          />
          <button nz-button nzType="primary" (click)="loadAttendances()"><span nz-icon nzType="search"></span> 查询</button>
          <button nz-button (click)="resetAttendanceRange()">重置</button>
          <span class="filter-bar__spacer"></span>
          <span class="text-secondary">共 {{ attendances().length }} 条考勤</span>
        </div>
        <app-data-table
          [columns]="attendanceColumns"
          [rows]="attendances()"
          [total]="attendances().length"
          [pageNum]="1"
          [pageSize]="100"
          [loading]="attendancesLoading()"
          scrollX="720px"
        />
      </div>
    } @else {
      <div class="card"><nz-empty nzNotFoundContent="未找到该人员信息" /></div>
    }

    <app-modal [(open)]="editOpen" title="编辑人员资料" okText="保存" [loading]="saving()" [width]="680" (ok)="submitEdit()">
      <app-schema-form [fields]="editFields" [(model)]="editModel" />
    </app-modal>

    <app-modal [(open)]="qualificationOpen" [title]="editingQualification() ? '编辑资质' : '新增资质'" okText="保存" [loading]="saving()" [width]="680" (ok)="submitQualification()">
      <app-schema-form [fields]="qualificationFields" [(model)]="qualificationModel" />
    </app-modal>

    <app-modal [(open)]="scheduleOpen" title="新增排班" okText="保存" [loading]="saving()" [width]="680" (ok)="submitSchedule()">
      <app-schema-form [fields]="scheduleFields()" [(model)]="scheduleModel" />
    </app-modal>

    <app-modal [(open)]="attendanceOpen" title="登记考勤" okText="保存" [loading]="saving()" [width]="680" (ok)="submitAttendance()">
      <app-schema-form [fields]="attendanceFields" [(model)]="attendanceModel" />
    </app-modal>
  `,
})
export class CrewDetailPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  readonly perm = inject(PermissionService);

  readonly CrewRoleNameText = CrewRoleNameText;
  readonly CrewStatusNameText = CrewStatusNameText;
  readonly formatDateTime = formatDateTime;

  readonly id = signal('');
  readonly loading = signal(false);
  readonly crew = signal<CrewDto | null>(null);
  readonly drones = signal<DroneDto[]>([]);

  readonly saving = signal(false);
  readonly editOpen = signal(false);
  readonly qualificationOpen = signal(false);
  readonly scheduleOpen = signal(false);
  readonly attendanceOpen = signal(false);

  readonly editingQualification = signal<QualificationDto | null>(null);

  readonly schedules = signal<ScheduleRow[]>([]);
  readonly schedulesLoading = signal(false);
  readonly scheduleRange = signal<Date[] | null>(null);

  readonly attendances = signal<AttendanceRow[]>([]);
  readonly attendancesLoading = signal(false);
  readonly attendanceRange = signal<Date[] | null>(null);

  editModel: Record<string, unknown> = {};
  qualificationModel: Record<string, unknown> = {};
  scheduleModel: Record<string, unknown> = {};
  attendanceModel: Record<string, unknown> = {};

  readonly title = computed(() => (this.crew() ? `${this.crew()!.name} · 人员详情` : '人员详情'));

  readonly qualifications = computed<(QualificationDto & Record<string, unknown>)[]>(
    () => (this.crew()?.qualifications ?? []) as (QualificationDto & Record<string, unknown>)[],
  );

  readonly droneMap = computed<Record<string, string>>(() =>
    nameMap(this.drones(), (d) => d.id, (d) => d.serialNo),
  );

  readonly editFields: FormField[] = [
    { key: 'name', label: '姓名', type: 'text', required: true, span: 12, maxLength: 32 },
    { key: 'gender', label: '性别', type: 'text', span: 12, maxLength: 8, placeholder: '如 男 / 女' },
    { key: 'phone', label: '联系电话', type: 'text', required: true, span: 12, maxLength: 20 },
    {
      key: 'role',
      label: '角色',
      type: 'select',
      required: true,
      span: 12,
      options: [
        { value: CrewRole.Pilot, label: '机长' },
        { value: CrewRole.Maintenance, label: '维保人员' },
      ],
    },
    { key: 'region', label: '负责区域', type: 'text', span: 12, maxLength: 64 },
    {
      key: 'status',
      label: '状态',
      type: 'select',
      required: true,
      span: 12,
      options: [
        { value: CrewStatus.Active, label: '在职' },
        { value: CrewStatus.Suspended, label: '停职' },
        { value: CrewStatus.Departed, label: '离职' },
      ],
    },
  ];

  readonly qualificationFields: FormField[] = [
    { key: 'type', label: '资质类型', type: 'text', required: true, span: 12, maxLength: 64, placeholder: '如 无人机驾驶员执照' },
    { key: 'number', label: '资质编号', type: 'text', required: true, span: 12, maxLength: 64 },
    { key: 'issuedAt', label: '签发日期', type: 'date', required: true, span: 12 },
    { key: 'expiresAt', label: '到期日期', type: 'date', required: true, span: 12 },
    { key: 'fileUrl', label: '文件链接', type: 'text', span: 24, maxLength: 256, placeholder: '证书扫描件地址（可选）' },
  ];

  readonly scheduleFields = computed<FormField[]>(() => {
    const droneField: FormField = this.perm.can('resource.drone.read')
      ? {
          key: 'droneId',
          label: '执飞飞行器',
          type: 'select',
          span: 12,
          placeholder: '选择飞行器（可选）',
          options: this.drones().map((d) => ({ value: d.id, label: `${d.serialNo} · ${d.model}` })),
        }
      : { key: 'droneId', label: '执飞飞行器', type: 'text', span: 12, placeholder: '填写飞行器 ID（可选）' };
    return [
      { key: 'startAt', label: '开始时间', type: 'datetime', required: true, span: 12 },
      { key: 'endAt', label: '结束时间', type: 'datetime', required: true, span: 12 },
      { key: 'area', label: '任务区域', type: 'text', span: 12, maxLength: 64 },
      droneField,
      { key: 'remark', label: '备注', type: 'textarea', span: 24, maxLength: 200 },
    ];
  });

  readonly attendanceFields: FormField[] = [
    { key: 'date', label: '考勤日期', type: 'date', required: true, span: 12 },
    {
      key: 'status',
      label: '考勤状态',
      type: 'select',
      required: true,
      span: 12,
      options: [
        { value: AttendanceStatus.Normal, label: '正常' },
        { value: AttendanceStatus.Late, label: '迟到' },
        { value: AttendanceStatus.EarlyLeave, label: '早退' },
        { value: AttendanceStatus.Leave, label: '请假' },
        { value: AttendanceStatus.Absent, label: '缺勤' },
      ],
    },
    { key: 'remark', label: '备注', type: 'textarea', span: 24, maxLength: 200 },
  ];

  readonly qualificationColumns: DataColumn<QualificationDto & Record<string, unknown>>[] = [
    { key: 'type', title: '资质类型', width: '200px' },
    { key: 'number', title: '资质编号', width: '180px' },
    { key: 'issuedAt', title: '签发日期', width: '130px', type: 'date' },
    {
      key: 'expiresAt',
      title: '到期日期',
      width: '150px',
      type: 'status',
      pipe: (row) => formatDateTime(row.expiresAt, 'YYYY-MM-DD'),
      tone: (row) => (row.isExpired ? 'error' : 'success'),
    },
    {
      key: 'isExpired',
      title: '是否过期',
      width: '110px',
      type: 'status',
      pipe: (row) => (row.isExpired ? '已过期' : '有效'),
      tone: (row) => (row.isExpired ? 'error' : 'success'),
    },
  ];

  readonly scheduleColumns: DataColumn<ScheduleRow>[] = [
    { key: 'startAt', title: '开始时间', width: '160px', type: 'datetime' },
    { key: 'endAt', title: '结束时间', width: '160px', type: 'datetime' },
    { key: 'area', title: '任务区域', width: '160px', pipe: (row) => row.area ?? '-' },
    {
      key: 'droneId',
      title: '执飞飞行器',
      width: '180px',
      pipe: (row) => (row.droneId ? this.droneMap()[row.droneId] ?? row.droneId : '-'),
    },
    { key: 'remark', title: '备注', ellipsis: true, pipe: (row) => row.remark ?? '-' },
  ];

  readonly attendanceColumns: DataColumn<AttendanceRow>[] = [
    { key: 'date', title: '考勤日期', width: '140px', type: 'date' },
    { key: 'status', title: '考勤状态', width: '120px', type: 'status', map: AttendanceStatusNameText },
    { key: 'remark', title: '备注', ellipsis: true, pipe: (row) => row.remark ?? '-' },
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.id.set(id);
    if (!id) return;
    this.loadCrew();
    this.loadSchedules();
    this.loadAttendances();
    this.loadDrones();
  }

  back(): void {
    void this.router.navigateByUrl('/resources/crew');
  }

  loadCrew(): void {
    this.loading.set(true);
    this.api.get<CrewDto>(`/resource/crew/${this.id()}`).subscribe({
      next: (crew) => {
        this.crew.set(crew);
        this.loading.set(false);
      },
      error: () => {
        this.crew.set(null);
        this.loading.set(false);
      },
    });
  }

  openEdit(): void {
    const crew = this.crew();
    if (!crew) return;
    this.editModel = {
      name: crew.name,
      gender: crew.gender ?? '',
      phone: crew.phone,
      role: CrewRoleValue[crew.role] ?? CrewRole.Pilot,
      region: crew.region ?? '',
      status: CrewStatusValue[crew.status] ?? CrewStatus.Active,
    };
    this.editOpen.set(true);
  }

  submitEdit(): void {
    const body: UpdateCrewRequest = {
      name: String(this.editModel['name'] ?? '').trim(),
      gender: (this.editModel['gender'] as string) || null,
      phone: String(this.editModel['phone'] ?? '').trim(),
      role: Number(this.editModel['role'] ?? CrewRole.Pilot),
      region: (this.editModel['region'] as string) || null,
      status: Number(this.editModel['status'] ?? CrewStatus.Active),
    };
    this.saving.set(true);
    this.api.put<CrewDto>(`/resource/crew/${this.id()}`, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.editOpen.set(false);
        this.message.success('人员资料已更新');
        this.loadCrew();
      },
      error: () => this.saving.set(false),
    });
  }

  openQualification(row?: QualificationDto): void {
    this.editingQualification.set(row ?? null);
    this.qualificationModel = row
      ? { type: row.type, number: row.number, issuedAt: row.issuedAt, expiresAt: row.expiresAt, fileUrl: row.fileUrl ?? '' }
      : { type: '', number: '', issuedAt: null, expiresAt: null, fileUrl: '' };
    this.qualificationOpen.set(true);
  }

  submitQualification(): void {
    const body: AddQualificationRequest = {
      type: String(this.qualificationModel['type'] ?? '').trim(),
      number: String(this.qualificationModel['number'] ?? '').trim(),
      issuedAt: String(this.qualificationModel['issuedAt'] ?? ''),
      expiresAt: String(this.qualificationModel['expiresAt'] ?? ''),
      fileUrl: (this.qualificationModel['fileUrl'] as string) || null,
    };
    if (!body.type || !body.number || !body.issuedAt || !body.expiresAt) {
      this.message.warning('请完整填写资质信息');
      return;
    }
    const editing = this.editingQualification();
    const path = editing
      ? `/resource/crew/${this.id()}/qualifications/${editing.id}`
      : `/resource/crew/${this.id()}/qualifications`;
    this.saving.set(true);
    const request = editing
      ? this.api.put<QualificationDto>(path, body)
      : this.api.post<QualificationDto>(path, body);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.qualificationOpen.set(false);
        this.message.success(editing ? '资质已更新' : '资质已新增');
        this.loadCrew();
      },
      error: () => this.saving.set(false),
    });
  }

  loadSchedules(): void {
    const range = this.scheduleRange();
    this.schedulesLoading.set(true);
    this.api
      .get<ScheduleDto[] | Paged<ScheduleDto>>(`/resource/crew/${this.id()}/schedules`, {
        from: range?.[0] ? this.toIso(range[0]) : undefined,
        to: range?.[1] ? this.toIso(range[1]) : undefined,
      })
      .subscribe({
        next: (res) => {
          this.schedules.set(this.asItems(res));
          this.schedulesLoading.set(false);
        },
        error: () => {
          this.schedules.set([]);
          this.schedulesLoading.set(false);
        },
      });
  }

  resetScheduleRange(): void {
    this.scheduleRange.set(null);
    this.loadSchedules();
  }

  openSchedule(): void {
    this.scheduleModel = { startAt: null, endAt: null, area: '', droneId: null, remark: '' };
    this.scheduleOpen.set(true);
  }

  submitSchedule(): void {
    const body: CreateScheduleRequest = {
      startAt: String(this.scheduleModel['startAt'] ?? ''),
      endAt: String(this.scheduleModel['endAt'] ?? ''),
      area: (this.scheduleModel['area'] as string) || null,
      droneId: (this.scheduleModel['droneId'] as string) || null,
      remark: (this.scheduleModel['remark'] as string) || null,
    };
    if (!body.startAt || !body.endAt) {
      this.message.warning('请选择排班起止时间');
      return;
    }
    this.saving.set(true);
    this.api.post<ScheduleDto>(`/resource/crew/${this.id()}/schedules`, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.scheduleOpen.set(false);
        this.message.success('排班已新增');
        this.loadSchedules();
      },
      error: () => this.saving.set(false),
    });
  }

  loadAttendances(): void {
    const range = this.attendanceRange();
    this.attendancesLoading.set(true);
    this.api
      .get<AttendanceDto[] | Paged<AttendanceDto>>(`/resource/crew/${this.id()}/attendances`, {
        from: range?.[0] ? this.toDateOnly(range[0]) : undefined,
        to: range?.[1] ? this.toDateOnly(range[1]) : undefined,
      })
      .subscribe({
        next: (res) => {
          this.attendances.set(this.asItems(res));
          this.attendancesLoading.set(false);
        },
        error: () => {
          this.attendances.set([]);
          this.attendancesLoading.set(false);
        },
      });
  }

  resetAttendanceRange(): void {
    this.attendanceRange.set(null);
    this.loadAttendances();
  }

  openAttendance(): void {
    this.attendanceModel = { date: this.toDateOnly(new Date()), status: AttendanceStatus.Normal, remark: '' };
    this.attendanceOpen.set(true);
  }

  submitAttendance(): void {
    const body: RecordAttendanceRequest = {
      date: String(this.attendanceModel['date'] ?? ''),
      status: Number(this.attendanceModel['status'] ?? AttendanceStatus.Normal),
      remark: (this.attendanceModel['remark'] as string) || null,
    };
    if (!body.date) {
      this.message.warning('请选择考勤日期');
      return;
    }
    this.saving.set(true);
    this.api.post<AttendanceDto>(`/resource/crew/${this.id()}/attendances`, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.attendanceOpen.set(false);
        this.message.success('考勤已登记');
        this.loadAttendances();
      },
      error: () => this.saving.set(false),
    });
  }

  private loadDrones(): void {
    if (!this.perm.can('resource.drone.read')) return;
    this.api.get<Paged<DroneDto>>('/resource/drones', { pageNum: 1, pageSize: 200 }).subscribe({
      next: (page) => this.drones.set(page.items ?? []),
      error: () => undefined,
    });
  }

  private asItems<T>(res: T[] | Paged<T> | null | undefined): (T & Record<string, unknown>)[] {
    if (!res) return [];
    return (Array.isArray(res) ? res : (res.items ?? [])) as (T & Record<string, unknown>)[];
  }

  private toIso(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  }

  private toDateOnly(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
}
