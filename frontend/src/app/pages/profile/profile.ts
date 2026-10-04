import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ApiService } from '../../core/api.service';
import {
  AccountStatusNameText,
  AuthUserDto,
  RoleText,
  UpdateProfileRequest,
  UserTypeNameText,
} from '../../core/api-types';
import { AuthService } from '../../core/auth.service';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { ModalComponent } from '../../shared/modal';

/** 权限点中文名（与后端 PermissionCatalog 一致，用于个人资料展示） */
const PermissionNameText: Record<string, string> = {
  'account.user.read': '查看账号',
  'account.user.manage': '账号管理',
  'account.role.manage': '角色权限管理',
  'account.audit.read': '审计日志查看',
  'order.read': '查看订单',
  'order.create': '创建订单',
  'order.accept': '接单/拒单',
  'order.dispatch': '订单调度',
  'order.settle': '结算对账',
  'order.review': '评价与投诉处理',
  'order.pay': '订单支付',
  'order.invoice.apply': '发票申请',
  'order.invoice.manage': '发票管理',
  'resource.drone.read': '查看飞行器',
  'resource.drone.manage': '飞行器管理',
  'resource.station.read': '查看场站',
  'resource.station.manage': '场站管理',
  'resource.crew.manage': '人员管理',
  'resource.maintenance.manage': '维保管理',
  'resource.fault.report': '故障上报',
  'resource.fault.manage': '故障处理',
  'resource.service-area.manage': '服务区域配置',
  'airspace.read': '空域查看',
  'airspace.plan.submit': '飞行计划申报',
  'airspace.plan.approve': '飞行计划审批',
  'airspace.fence.manage': '电子围栏管理',
  'airspace.zone.manage': '空域数据管理',
  'airspace.violation.manage': '违规处理',
  'airspace.violation.read': '违规记录查看',
  'airspace.monitoring.report': '飞行位置上报',
  'report.view': '查看报表',
  'report.export': '导出报表',
  'report.share': '分享报表',
  'support.alert.handle': '应急告警处置',
  'support.ticket.manage': '工单管理',
  'support.ticket.apply': '工单提交',
  'support.help.manage': '帮助中心管理',
  'config.param.manage': '参数配置',
  'config.interface.manage': '接口管理',
  'config.backup.manage': '备份管理',
  'config.log.read': '日志查看',
  'agent.use': '智能体使用',
  'agent.manage': '知识库管理',
};

/** 我的资料：个人基础信息维护与权限一览 */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzEmptyModule,
    NzIconModule,
    NzSpinModule,
    NzTagModule,
    PageHeaderComponent,
    SchemaFormComponent,
    ModalComponent,
  ],
  template: `
    <app-page-header title="我的资料" subtitle="查看个人账号信息、角色与权限范围，并可修改对外展示资料">
      <button nz-button (click)="load()"><span nz-icon nzType="reload"></span> 刷新</button>
      <button nz-button nzType="primary" [disabled]="!me()" (click)="openEdit()">
        <span nz-icon nzType="edit"></span> 编辑资料
      </button>
    </app-page-header>

    @if (loading()) {
      <div class="card"><div class="page-loading"><nz-spin nzTip="资料加载中" /></div></div>
    } @else if (!me()) {
      <div class="card"><nz-empty nzNotFoundContent="个人资料暂不可用" /></div>
    } @else {
      <div class="grid grid--2">
        <div class="card">
          <div class="card__title">基础信息</div>
          <div class="desc-grid">
            <div class="desc-item">
              <span class="desc-item__label">用户名</span>
              <span class="desc-item__value">{{ me()!.username }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">姓名</span>
              <span class="desc-item__value">{{ me()!.displayName }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">手机号</span>
              <span class="desc-item__value">{{ me()!.phone || '-' }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">邮箱</span>
              <span class="desc-item__value">{{ me()!.email || '-' }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">用户类型</span>
              <span class="desc-item__value">{{ userTypeText(me()!.userType) }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">账号状态</span>
              <span class="desc-item__value">{{ statusText(me()!.status) }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">所属企业</span>
              <span class="desc-item__value">{{ me()!.companyName || '-' }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">最近登录</span>
              <span class="desc-item__value">{{ me()!.lastLoginAt | date: 'yyyy-MM-dd HH:mm' }}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card__title">
            角色与权限
            <span class="card__subtitle">共 {{ permissionCodes().length }} 项权限</span>
          </div>
          <div class="card__subtitle mb-8">角色</div>
          <div class="tag-list">
            @for (role of me()!.roles; track role) {
              <nz-tag nzColor="blue">{{ roleText(role) }}</nz-tag>
            } @empty {
              <span class="text-secondary">未分配角色</span>
            }
          </div>
          <div class="card__subtitle mt-16 mb-8">权限点</div>
          <div class="tag-list">
            @for (code of permissionCodes(); track code) {
              <nz-tag>{{ permissionText(code) }}</nz-tag>
            } @empty {
              <span class="text-secondary">暂无权限点</span>
            }
          </div>
        </div>
      </div>
    }

    <app-modal [(open)]="editOpen" title="编辑资料" okText="保存" [loading]="saving()" [width]="560" (ok)="submit()">
      <app-schema-form [fields]="editFields" [(model)]="editModel" />
    </app-modal>
  `,
  styles: [
    `
      .tag-list {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
    `,
  ],
})
export class ProfilePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  private readonly auth = inject(AuthService);

  readonly me = signal<AuthUserDto | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editOpen = signal(false);

  editModel: Record<string, unknown> = { displayName: '', email: '', avatarUrl: '' };

  readonly editFields: FormField[] = [
    { key: 'displayName', label: '姓名', type: 'text', required: true, span: 24, maxLength: 50 },
    { key: 'email', label: '邮箱', type: 'text', span: 24, placeholder: 'name@example.com' },
    { key: 'avatarUrl', label: '头像地址', type: 'text', span: 24, placeholder: 'https://example.com/avatar.png' },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.get<AuthUserDto>('/users/me').subscribe({
      next: (user) => {
        this.loading.set(false);
        this.me.set(user ?? null);
      },
      error: () => {
        this.loading.set(false);
        this.me.set(null);
      },
    });
  }

  openEdit(): void {
    const user = this.me();
    if (!user) return;
    this.editModel = {
      displayName: user.displayName ?? '',
      email: user.email ?? '',
      avatarUrl: '',
    };
    this.editOpen.set(true);
  }

  submit(): void {
    const displayName = String(this.editModel['displayName'] ?? '').trim();
    const email = String(this.editModel['email'] ?? '').trim();
    const avatarUrl = String(this.editModel['avatarUrl'] ?? '').trim();
    if (!displayName) {
      this.message.warning('姓名不能为空');
      return;
    }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      this.message.warning('邮箱格式不正确');
      return;
    }
    const body: UpdateProfileRequest = { displayName, email, avatarUrl: avatarUrl || null };
    this.saving.set(true);
    this.api.put<AuthUserDto>('/users/me', body).subscribe({
      next: (user) => {
        this.saving.set(false);
        this.editOpen.set(false);
        this.me.set(user ?? this.me());
        this.auth.patchUser({
          displayName: user?.displayName ?? displayName,
          email: user?.email ?? email,
        });
        this.message.success('资料已更新');
      },
      error: () => this.saving.set(false),
    });
  }

  permissionCodes(): string[] {
    return this.me()?.permissions ?? [];
  }

  permissionText(code: string): string {
    return PermissionNameText[code] ?? code;
  }

  roleText(code: string): string {
    return RoleText[code] ?? code;
  }

  userTypeText(value: string): string {
    return UserTypeNameText[value] ?? value;
  }

  statusText(value: string): string {
    return AccountStatusNameText[value] ?? value;
  }
}
