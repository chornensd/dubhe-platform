import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ApiService } from '../../core/api.service';
import {
  CreateCrewRequest,
  CrewDto,
  CrewRole,
  CrewRoleNameText,
  CrewStatus,
  CrewStatusNameText,
  Paged,
  UpdateCrewRequest,
  UserListItemDto,
} from '../../core/api-types';
import { AuthService } from '../../core/auth.service';
import { PagedList } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent } from '../../shared/data-table';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { SelectOption } from '../../shared/search-select';

type CrewRow = CrewDto & Record<string, unknown>;

const CrewRoleValue: Record<string, number> = { Pilot: 1, Maintenance: 2 };
const CrewStatusValue: Record<string, number> = { Active: 1, Suspended: 2, Departed: 3 };

@Component({
  selector: 'app-crew-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    DataTableComponent,
    ModalComponent,
    PageHeaderComponent,
    SchemaFormComponent,
  ],
  template: `
    <app-page-header title="人员与资质" subtitle="机长与维保人员台账、资质状态与排班考勤管理">
      @if (perm.can('resource.crew.manage')) {
        <button nz-button nzType="primary" (click)="openCreate()">
          <span nz-icon nzType="plus"></span> 新增人员
        </button>
      }
      <button nz-button (click)="list.reload()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="card">
      <div class="filter-bar">
        <nz-select
          style="width: 140px"
          nzPlaceHolder="全部角色"
          nzAllowClear
          [ngModel]="role()"
          (ngModelChange)="onRole($event)"
        >
          @for (item of roleOptions; track item.value) {
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
          placeholder="姓名 / 电话"
          [ngModel]="keyword()"
          (ngModelChange)="keyword.set($event)"
          (keyup.enter)="search()"
        />
        <button nz-button nzType="primary" (click)="search()"><span nz-icon nzType="search"></span> 查询</button>
        <button nz-button (click)="reset()">重置</button>
        <span class="filter-bar__spacer"></span>
        <span class="text-secondary">共 {{ list.total() }} 人</span>
      </div>

      <app-data-table
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [pageNum]="list.pageNum"
        [pageSize]="list.pageSize"
        [loading]="list.loading()"
        scrollX="1240px"
        (pageChange)="list.page($event)"
        (rowClick)="gotoDetail($event)"
      >
        <ng-template #actions let-row>
          <button nz-button nzType="link" nzSize="small" (click)="gotoDetail(row)">详情</button>
          @if (perm.can('resource.crew.manage')) {
            <button nz-button nzType="link" nzSize="small" (click)="openEdit(row)">编辑</button>
          }
        </ng-template>
      </app-data-table>
    </div>

    <app-modal
      [(open)]="createOpen"
      title="新增人员"
      okText="提交登记"
      [loading]="saving()"
      [width]="680"
      (ok)="submitCreate()"
    >
      <app-schema-form [fields]="createFields()" [(model)]="createModel" />
    </app-modal>

    <app-modal [(open)]="editOpen" title="编辑人员" okText="保存" [loading]="saving()" [width]="680" (ok)="submitEdit()">
      <app-schema-form [fields]="editFields" [(model)]="editModel" />
    </app-modal>
  `,
})
export class CrewListPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly auth = inject(AuthService);
  readonly perm = inject(PermissionService);

  readonly keyword = signal('');
  readonly role = signal<number | null>(null);
  readonly status = signal<number | null>(null);
  readonly saving = signal(false);
  readonly createOpen = signal(false);
  readonly editOpen = signal(false);

  readonly merchantOptions = signal<SelectOption[]>([]);
  readonly merchantLoading = signal(false);

  createModel: Record<string, unknown> = {};
  editModel: Record<string, unknown> = {};

  private ownMerchantId: string | null = null;
  private editing?: CrewRow;

  readonly list = new PagedList<CrewRow>((query) =>
    this.api.get<Paged<CrewRow>>('/resource/crew', {
      ...query,
      keyword: this.keyword() || undefined,
      role: this.role() ?? undefined,
      status: this.status() ?? undefined,
    }),
  );

  readonly columns: DataColumn<CrewRow>[] = [
    { key: 'name', title: '姓名', width: '130px' },
    { key: 'gender', title: '性别', width: '80px', pipe: (row) => row.gender ?? '-' },
    { key: 'phone', title: '电话', width: '130px' },
    { key: 'role', title: '角色', width: '110px', type: 'status', map: CrewRoleNameText },
    { key: 'region', title: '负责区域', ellipsis: true, pipe: (row) => row.region ?? '-' },
    { key: 'status', title: '状态', width: '100px', type: 'status', map: CrewStatusNameText },
    { key: 'qualificationCount', title: '资质数', width: '90px', align: 'right' },
    { key: 'createdAt', title: '入职时间', width: '150px', type: 'datetime' },
  ];

  readonly roleOptions = [
    { value: CrewRole.Pilot, label: '机长' },
    { value: CrewRole.Maintenance, label: '维保人员' },
  ];

  readonly statusOptions = [
    { value: CrewStatus.Active, label: '在职' },
    { value: CrewStatus.Suspended, label: '停职' },
    { value: CrewStatus.Departed, label: '离职' },
  ];

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

  readonly canPickMerchant = computed(() => this.perm.can('account.user.manage'));

  readonly createFields = computed<FormField[]>(() => {
    const fields: FormField[] = [];
    if (this.canPickMerchant()) {
      fields.push({
        key: 'merchantId',
        label: '所属商家',
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
      { key: 'name', label: '姓名', type: 'text', required: true, span: 12, maxLength: 32 },
      { key: 'gender', label: '性别', type: 'text', span: 12, maxLength: 8, placeholder: '如 男 / 女' },
      { key: 'phone', label: '联系电话', type: 'text', required: true, span: 12, maxLength: 20, placeholder: '手机号' },
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
      { key: 'region', label: '负责区域', type: 'text', span: 12, maxLength: 64, placeholder: '如 滨江区' },
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
  }

  search(): void {
    this.list.filter({});
  }

  reset(): void {
    this.keyword.set('');
    this.role.set(null);
    this.status.set(null);
    this.list.filter({});
  }

  onRole(value: number | null): void {
    this.role.set(value);
    this.list.filter({});
  }

  onStatus(value: number | null): void {
    this.status.set(value);
    this.list.filter({});
  }

  gotoDetail(row: CrewRow): void {
    void this.router.navigate(['/resources', 'crew', row.id]);
  }

  openCreate(): void {
    this.createModel = {
      merchantId: this.ownMerchantId,
      name: '',
      gender: '',
      phone: '',
      role: CrewRole.Pilot,
      region: '',
    };
    this.createOpen.set(true);
  }

  submitCreate(): void {
    const body: CreateCrewRequest = {
      merchantId: (this.createModel['merchantId'] as string | null) ?? null,
      name: String(this.createModel['name'] ?? '').trim(),
      gender: (this.createModel['gender'] as string) || null,
      phone: String(this.createModel['phone'] ?? '').trim(),
      role: Number(this.createModel['role'] ?? CrewRole.Pilot),
      region: (this.createModel['region'] as string) || null,
    };
    if (!body.name || !body.phone) {
      this.message.warning('请填写姓名与联系电话');
      return;
    }
    if (this.canPickMerchant() && !body.merchantId) {
      this.message.warning('请选择所属商家');
      return;
    }
    this.saving.set(true);
    this.api.post<CrewDto>('/resource/crew', body).subscribe({
      next: () => {
        this.saving.set(false);
        this.createOpen.set(false);
        this.message.success('人员已登记');
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  openEdit(row: CrewRow): void {
    this.editing = row;
    this.editModel = {
      name: row.name,
      gender: row.gender ?? '',
      phone: row.phone,
      role: CrewRoleValue[row.role] ?? CrewRole.Pilot,
      region: row.region ?? '',
      status: CrewStatusValue[row.status] ?? CrewStatus.Active,
    };
    this.editOpen.set(true);
  }

  submitEdit(): void {
    if (!this.editing) return;
    const body: UpdateCrewRequest = {
      name: String(this.editModel['name'] ?? '').trim(),
      gender: (this.editModel['gender'] as string) || null,
      phone: String(this.editModel['phone'] ?? '').trim(),
      role: Number(this.editModel['role'] ?? CrewRole.Pilot),
      region: (this.editModel['region'] as string) || null,
      status: Number(this.editModel['status'] ?? CrewStatus.Active),
    };
    this.saving.set(true);
    this.api.put<CrewDto>(`/resource/crew/${this.editing.id}`, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.editOpen.set(false);
        this.message.success('人员信息已更新');
        this.list.reload();
      },
      error: () => this.saving.set(false),
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
}

