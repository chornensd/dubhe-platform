import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ApiService } from '../../core/api.service';
import { PermissionGroupDto, RoleDto } from '../../core/api-types';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent } from '../../shared/data-table';
import { PageHeaderComponent } from '../../shared/page-header';

type RoleRow = RoleDto & Record<string, unknown>;

const ModuleText: Record<string, string> = {
  account: '账号权限',
  order: '订单',
  resource: '低空资源',
  airspace: '空域合规',
  report: '统计报表',
  support: '应急与客服',
  config: '系统配置',
  agent: '智能体',
};

/** 角色与权限：查看系统角色及其权限点（只读，权限为系统预置） */
@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzSpinModule,
    NzTagModule,
    PageHeaderComponent,
    DataTableComponent,
  ],
  template: `
    <app-page-header title="角色与权限" subtitle="平台内置角色的权限范围一览；权限点为系统预置，账号差异通过分配角色实现">
      <button nz-button (click)="load()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="roles-layout">
      <div class="card">
        <div class="card__title">
          角色列表
          <span class="card__subtitle">共 {{ roles().length }} 个角色</span>
        </div>
        @if (loading()) {
          <div class="page-loading"><nz-spin nzTip="角色加载中" /></div>
        } @else if (!roles().length) {
          <nz-empty nzNotFoundContent="暂无角色数据" />
        } @else {
          <app-data-table
            [columns]="columns"
            [rows]="roles()"
            [total]="roles().length"
            [pageNum]="1"
            [pageSize]="rolePageSize()"
            [loading]="false"
            emptyText="暂无角色数据"
            (rowClick)="select($event)"
          >
            <ng-template #actions let-row>
              <button nz-button nzType="link" nzSize="small" (click)="select(row)">查看权限</button>
            </ng-template>
          </app-data-table>
        }
      </div>

      <div class="card">
        <div class="card__title">
          <span>
            权限明细
            @if (selectedRole(); as role) {
              <nz-tag nzColor="blue">{{ role.name }}</nz-tag>
              <span class="text-secondary">{{ role.code }} · 已授予 {{ role.permissions?.length ?? 0 }} 项</span>
            }
          </span>
          <span class="card__subtitle">{{ matchedCount() }} 项权限</span>
        </div>

        @if (selectedRole(); as role) {
          @if (role.isSystem) {
            <div class="notice-bar mb-16">内置角色权限为系统预置，用户级差异通过分配角色实现。</div>
          } @else {
            <div class="notice-bar mb-16">自定义角色，权限以系统配置为准。</div>
          }
        }

        <div class="filter-bar">
          <input
            nz-input
            style="width: 260px"
            placeholder="检索权限名称或编码"
            [ngModel]="keyword()"
            (ngModelChange)="keyword.set($event)"
          />
          @if (keyword()) {
            <button nz-button nzSize="small" (click)="keyword.set('')">清除</button>
          }
        </div>

        @if (catalogLoading()) {
          <div class="page-loading"><nz-spin nzTip="权限加载中" /></div>
        } @else if (!selectedRole()) {
          <nz-empty nzNotFoundContent="请在左侧选择一个角色查看权限" />
        } @else if (!filteredGroups().length) {
          <nz-empty nzNotFoundContent="没有匹配的权限点" />
        } @else {
          <div class="perm-groups">
            @for (group of filteredGroups(); track group.module) {
              <div class="perm-group">
                <div class="perm-group__title">
                  {{ moduleText(group.module) }}
                  <span class="text-secondary">（{{ group.items.length }} 项）</span>
                </div>
                <div class="perm-group__items">
                  @for (item of group.items; track item.code) {
                    <label
                      nz-checkbox
                      class="perm-item"
                      [nzDisabled]="true"
                      [ngModel]="checked(item.code)"
                    >
                      {{ item.name }}
                      <span class="mono perm-item__code">{{ item.code }}</span>
                    </label>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .roles-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 16px;
        align-items: start;
      }
      @media (max-width: 1200px) {
        .roles-layout {
          grid-template-columns: 1fr;
        }
      }
      .notice-bar {
        background: #f0f5ff;
        border: 1px solid #adc6ff;
        color: #2f54eb;
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 13px;
      }
      .perm-groups {
        display: flex;
        flex-direction: column;
        gap: 16px;
        max-height: 560px;
        overflow: auto;
      }
      .perm-group__title {
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .perm-group__items {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 6px 16px;
      }
      .perm-item {
        font-size: 13px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .perm-item__code {
        color: #98a2b3;
      }
    `,
  ],
})
export class RolePermissionPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly perm = inject(PermissionService);

  readonly roles = signal<RoleRow[]>([]);
  readonly loading = signal(false);
  readonly catalog = signal<PermissionGroupDto[]>([]);
  readonly catalogLoading = signal(false);
  readonly selectedCode = signal<string | null>(null);
  readonly keyword = signal('');

  readonly selectedRole = computed(() => this.roles().find((role) => role.code === this.selectedCode()) ?? null);

  readonly filteredGroups = computed(() => {
    const keyword = this.keyword().trim().toLowerCase();
    const groups = this.catalog();
    if (!keyword) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => item.name.toLowerCase().includes(keyword) || item.code.toLowerCase().includes(keyword),
        ),
      }))
      .filter((group) => group.items.length > 0);
  });

  readonly matchedCount = computed(() => this.filteredGroups().reduce((sum, group) => sum + group.items.length, 0));

  readonly columns: DataColumn<RoleRow>[] = [
    { key: 'code', title: '编码', width: '150px' },
    { key: 'name', title: '名称', width: '130px' },
    { key: 'description', title: '描述', ellipsis: true },
    { key: 'isSystem', title: '系统内置', width: '90px', type: 'boolean' },
    { key: 'permissions', title: '权限数', width: '80px', align: 'right', pipe: (row) => row.permissions?.length ?? 0 },
  ];

  ngOnInit(): void {
    this.load();
    this.loadCatalog();
  }

  rolePageSize(): number {
    return Math.max(10, this.roles().length);
  }

  load(): void {
    this.loading.set(true);
    this.api.get<RoleDto[]>('/admin/roles').subscribe({
      next: (rows) => {
        this.loading.set(false);
        const list = (rows ?? []) as RoleRow[];
        this.roles.set(list);
        if (!this.selectedCode() || !list.some((role) => role.code === this.selectedCode())) {
          this.selectedCode.set(list[0]?.code ?? null);
        }
      },
      error: () => {
        this.loading.set(false);
        this.roles.set([]);
      },
    });
  }

  loadCatalog(): void {
    this.catalogLoading.set(true);
    this.api.get<PermissionGroupDto[]>('/admin/roles/permissions').subscribe({
      next: (groups) => {
        this.catalogLoading.set(false);
        this.catalog.set(groups ?? []);
      },
      error: () => {
        this.catalogLoading.set(false);
        this.catalog.set([]);
      },
    });
  }

  select(row: RoleRow): void {
    this.selectedCode.set(row.code);
  }

  checked(code: string): boolean {
    return this.selectedRole()?.permissions?.includes(code) ?? false;
  }

  moduleText(module: string): string {
    return ModuleText[module] ?? module;
  }
}

