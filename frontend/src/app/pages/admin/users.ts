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
  AccountStatusNameText,
  AssignRolesRequest,
  Paged,
  RoleDto,
  RoleText,
  UserListItemDto,
  UserTypeNameText,
} from '../../core/api-types';
import { ConfirmService } from '../../core/confirm.service';
import { PagedList } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent } from '../../shared/data-table';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';

type UserRow = UserListItemDto & Record<string, unknown>;

/** 用户管理：账号审核、冻结解冻与角色分配 */
@Component({
  selector: 'app-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    PageHeaderComponent,
    DataTableComponent,
    SchemaFormComponent,
    ModalComponent,
  ],
  template: `
    <app-page-header title="用户管理" subtitle="平台账号检索、注册审核、冻结解冻与角色分配">
      <button nz-button (click)="list.reload()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="card">
      <div class="filter-bar">
        <input
          nz-input
          style="width: 220px"
          placeholder="用户名 / 姓名 / 手机号"
          [ngModel]="keyword()"
          (ngModelChange)="keyword.set($event)"
          (keyup.enter)="search()"
        />
        <nz-select style="width: 140px" nzPlaceHolder="全部状态" nzAllowClear [ngModel]="status()" (ngModelChange)="onStatus($event)">
          @for (item of statusOptions; track item.value) {
            <nz-option [nzValue]="item.value" [nzLabel]="item.label" />
          }
        </nz-select>
        @if (roleOptions().length) {
          <nz-select
            style="width: 170px"
            nzPlaceHolder="全部角色"
            nzAllowClear
            nzShowSearch
            [ngModel]="roleCode()"
            (ngModelChange)="onRole($event)"
          >
            @for (item of roleOptions(); track item.value) {
              <nz-option [nzValue]="item.value" [nzLabel]="item.label" />
            }
          </nz-select>
        }
        <button nz-button nzType="primary" (click)="search()"><span nz-icon nzType="search"></span> 查询</button>
        <button nz-button (click)="reset()">重置</button>
        <span class="filter-bar__spacer"></span>
        <span class="text-secondary">共 {{ list.total() }} 个账号</span>
      </div>

      <app-data-table
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [pageNum]="list.pageNum"
        [pageSize]="list.pageSize"
        [loading]="list.loading()"
        emptyText="当前条件下暂无账号"
        scrollX="1500px"
        (pageChange)="list.page($event)"
      >
        <ng-template #actions let-row>
          @if (row.status === 'PendingReview') {
            <button nz-button nzType="link" nzSize="small" (click)="approve(row)">审核通过</button>
            <button nz-button nzType="link" nzSize="small" nzDanger (click)="reject(row)">驳回</button>
          }
          @if (row.status === 'Active') {
            <button nz-button nzType="link" nzSize="small" nzDanger (click)="freeze(row)">冻结</button>
          }
          @if (row.status === 'Frozen') {
            <button nz-button nzType="link" nzSize="small" (click)="unfreeze(row)">解冻</button>
          }
          @if (perm.can('account.role.manage')) {
            <button nz-button nzType="link" nzSize="small" (click)="openAssign(row)">分配角色</button>
          }
        </ng-template>
      </app-data-table>
    </div>

    <app-modal [(open)]="assignOpen" [title]="'分配角色 · ' + (assignUser()?.displayName ?? '')" okText="保存" [loading]="saving()" [width]="560" (ok)="submitAssign()">
      <app-schema-form [fields]="assignFields()" [(model)]="assignModel" />
    </app-modal>
  `,
})
export class AdminUserPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  readonly perm = inject(PermissionService);

  readonly keyword = signal('');
  readonly status = signal<number | null>(null);
  readonly roleCode = signal<string | null>(null);
  readonly roles = signal<RoleDto[]>([]);

  readonly assignOpen = signal(false);
  readonly assignUser = signal<UserRow | null>(null);
  readonly saving = signal(false);

  assignModel: Record<string, unknown> = { roleCodes: [] };

  readonly statusOptions = [
    { value: 0, label: '审核中' },
    { value: 1, label: '正常' },
    { value: 2, label: '已驳回' },
    { value: 3, label: '已冻结' },
  ];

  readonly roleOptions = computed(() =>
    this.roles().map((role) => ({ value: role.code, label: `${role.name}（${role.code}）` })),
  );

  readonly assignFields = computed<FormField[]>(() => [
    {
      key: 'roleCodes',
      label: '角色',
      type: 'multiselect',
      span: 24,
      placeholder: '选择该账号拥有的角色（可多选）',
      options: this.roles().map((role) => ({ value: role.code, label: `${role.name}（${role.code}）` })),
      help: '角色决定账号可见菜单与操作权限，保存后立即生效',
    },
  ]);

  readonly list = new PagedList<UserRow>((query) =>
    this.api.get<Paged<UserRow>>('/admin/users', {
      ...query,
      keyword: this.keyword().trim() || undefined,
      status: this.status() === null ? undefined : this.status()!,
      roleCode: this.roleCode() || undefined,
    }),
  );

  readonly columns: DataColumn<UserRow>[] = [
    { key: 'username', title: '用户名', width: '140px' },
    { key: 'displayName', title: '姓名', width: '110px' },
    { key: 'phone', title: '手机号', width: '130px' },
    { key: 'userType', title: '用户类型', width: '110px', pipe: (row) => UserTypeNameText[row.userType] ?? row.userType },
    {
      key: 'roles',
      title: '角色',
      width: '200px',
      type: 'tag',
      pipe: (row) => (row.roles?.length ? row.roles.map((code) => RoleText[code] ?? code).join('、') : '未分配'),
    },
    { key: 'status', title: '状态', width: '100px', type: 'status', map: AccountStatusNameText },
    { key: 'createdAt', title: '注册时间', width: '160px', type: 'datetime' },
    { key: 'lastLoginAt', title: '最近登录', width: '160px', type: 'datetime' },
  ];

  ngOnInit(): void {
    this.list.reload();
    this.loadRoles();
  }

  search(): void {
    this.list.filter({});
  }

  reset(): void {
    this.keyword.set('');
    this.status.set(null);
    this.roleCode.set(null);
    this.list.filter({});
  }

  onStatus(value: number | null): void {
    this.status.set(value);
    this.list.filter({});
  }

  onRole(value: string | null): void {
    this.roleCode.set(value);
    this.list.filter({});
  }

  approve(row: UserRow): void {
    this.confirm
      .open({ title: '审核通过', content: `确认通过「${row.displayName}（${row.username}）」的注册申请？` })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.post<void>(`/admin/users/${row.id}/approve`).subscribe(() => {
          this.message.success('已审核通过，账号可正常登录');
          this.list.reload();
        });
      });
  }

  reject(row: UserRow): void {
    this.confirm
      .prompt({ title: `驳回注册：${row.username}`, placeholder: '请填写驳回原因（将通知申请人）', danger: true })
      .subscribe((reason) => {
        if (!reason) return;
        this.api.post<void>(`/admin/users/${row.id}/reject`, { reason }).subscribe(() => {
          this.message.success('已驳回该注册申请');
          this.list.reload();
        });
      });
  }

  freeze(row: UserRow): void {
    this.confirm
      .prompt({ title: `冻结账号：${row.username}`, placeholder: '请填写冻结原因', danger: true })
      .subscribe((reason) => {
        if (!reason) return;
        this.api.post<void>(`/admin/users/${row.id}/freeze`, { reason }).subscribe(() => {
          this.message.success('账号已冻结');
          this.list.reload();
        });
      });
  }

  unfreeze(row: UserRow): void {
    this.confirm
      .open({ title: '解冻账号', content: `确认解除「${row.displayName}（${row.username}）」的冻结状态？` })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.post<void>(`/admin/users/${row.id}/unfreeze`).subscribe(() => {
          this.message.success('账号已解冻');
          this.list.reload();
        });
      });
  }

  openAssign(row: UserRow): void {
    this.assignUser.set(row);
    this.assignModel = { roleCodes: [...(row.roles ?? [])] };
    this.assignOpen.set(true);
  }

  submitAssign(): void {
    const user = this.assignUser();
    if (!user) return;
    const roleCodes = Array.isArray(this.assignModel['roleCodes']) ? (this.assignModel['roleCodes'] as string[]) : [];
    if (!roleCodes.length) {
      this.message.warning('请至少选择一个角色');
      return;
    }
    this.saving.set(true);
    this.api.put<void>(`/admin/users/${user.id}/roles`, { roleCodes } as AssignRolesRequest).subscribe({
      next: () => {
        this.saving.set(false);
        this.assignOpen.set(false);
        this.message.success('角色已更新，用户需重新登录后生效');
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  private loadRoles(): void {
    if (!this.perm.can('account.role.manage')) return;
    this.api.get<RoleDto[]>('/admin/roles').subscribe({
      next: (rows) => this.roles.set(rows ?? []),
      error: () => undefined,
    });
  }
}
