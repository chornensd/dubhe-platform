import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AutoAcceptRuleDto } from '../../core/api-types';
import { ConfirmService } from '../../core/confirm.service';
import { PermissionService } from '../../core/permission.service';
import { PageHeaderComponent } from '../../shared/page-header';

@Component({
  selector: 'app-auto-accept',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzFormModule,
    NzIconModule,
    NzInputNumberModule,
    NzSpinModule,
    NzSwitchModule,
    NzTagModule,
    PageHeaderComponent,
  ],
  template: `
    <app-page-header title="自动接单规则" subtitle="配置自动接单条件，命中规则的订单将自动进入待调度">
      <button nz-button (click)="back()"><span nz-icon nzType="left"></span> 返回列表</button>
    </app-page-header>

    @if (loading()) {
      <div class="page-loading"><nz-spin /></div>
    } @else {
      <div class="grid grid--sidebar">
        <div>
          <div class="card">
            <div class="card__title">
              <span>规则配置</span>
              @if (!canEdit()) {
                <span class="card__subtitle">当前账号无修改权限，仅可查看</span>
              }
            </div>

            @if (!rule()) {
              <nz-alert nzType="warning" nzShowIcon [nzMessage]="loadNotice()" />
            } @else {
              <nz-form-item>
                <nz-form-label [nzSpan]="6">启用自动接单</nz-form-label>
                <nz-form-control [nzSpan]="18">
                  <nz-switch [(ngModel)]="model.enabled" [nzDisabled]="!canEdit()" />
                  <span class="text-secondary ml-8">关闭时新订单需人工接单</span>
                </nz-form-control>
              </nz-form-item>

              <nz-form-item>
                <nz-form-label [nzSpan]="6">最大重量(kg)</nz-form-label>
                <nz-form-control [nzSpan]="18">
                  <nz-input-number
                    style="width: 220px"
                    [nzMin]="0.1"
                    [nzMax]="500"
                    [nzStep]="0.1"
                    nzPlaceHolder="如 5"
                    [nzDisabled]="!canEdit()"
                    [(ngModel)]="model.maxWeightKg"
                  />
                  <div class="text-secondary mt-8">订单物品重量不超过该值时命中</div>
                </nz-form-control>
              </nz-form-item>

              <nz-form-item>
                <nz-form-label [nzSpan]="6">最远距离(km)</nz-form-label>
                <nz-form-control [nzSpan]="18">
                  <nz-input-number
                    style="width: 220px"
                    [nzMin]="0.1"
                    [nzMax]="200"
                    [nzStep]="0.5"
                    nzPlaceHolder="如 10"
                    [nzDisabled]="!canEdit()"
                    [(ngModel)]="model.maxDistanceKm"
                  />
                  <div class="text-secondary mt-8">订单飞行距离不超过该值时命中</div>
                </nz-form-control>
              </nz-form-item>

              @if (canEdit()) {
                <button nz-button nzType="primary" [nzLoading]="saving()" (click)="save()">
                  <span nz-icon nzType="save"></span> 保存规则
                </button>
              }
            }
          </div>

          <div class="card">
            <div class="card__title">当前规则摘要</div>
            @if (rule(); as current) {
              <div class="desc-grid">
                <div class="desc-item">
                  <span class="desc-item__label">规则状态</span>
                  <span class="desc-item__value">
                    <nz-tag [nzColor]="current.enabled ? 'green' : 'default'">{{ current.enabled ? '已启用' : '已停用' }}</nz-tag>
                  </span>
                </div>
                <div class="desc-item">
                  <span class="desc-item__label">最大重量</span>
                  <span class="desc-item__value">{{ current.maxWeightKg != null ? (current.maxWeightKg | number: '1.1-2') + ' kg' : '未设置' }}</span>
                </div>
                <div class="desc-item">
                  <span class="desc-item__label">最远距离</span>
                  <span class="desc-item__value">{{ current.maxDistanceKm != null ? (current.maxDistanceKm | number: '1.1-2') + ' km' : '未设置' }}</span>
                </div>
                <div class="desc-item">
                  <span class="desc-item__label">所属商家</span>
                  <span class="desc-item__value mono">{{ current.merchantId }}</span>
                </div>
              </div>
              <div class="text-secondary mt-8">
                {{ current.enabled ? '命中规则的新订单将自动进入待调度，无需人工接单。' : '自动接单已停用，所有新订单均需人工确认。' }}
              </div>
            } @else {
              <div class="text-secondary">暂无规则数据</div>
            }
          </div>
        </div>

        <div>
          <div class="card">
            <div class="card__title">规则说明</div>
            <ul class="rules">
              <li>开启自动接单后，新订单同时满足「重量不超过最大重量」且「飞行距离不超过最远距离」时，系统自动接单并进入待调度。</li>
              <li>规则仅对保存之后创建的订单生效，已存在的待接单订单不会自动接单。</li>
              <li>启用自动接单前请填写有效的最大重量与最远距离，两者均为必填条件。</li>
              <li>关闭自动接单后，所有新订单恢复人工接单流程。</li>
              <li>规则与运营商家绑定，商家账号仅能维护本商家的规则。</li>
            </ul>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .rules {
        margin: 0;
        padding-left: 18px;
        font-size: 13px;
        line-height: 1.9;
        color: #4a5568;
      }
      .ml-8 {
        margin-left: 10px;
      }
    `,
  ],
})
export class AutoAcceptPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  private readonly perm = inject(PermissionService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly rule = signal<AutoAcceptRuleDto | null>(null);

  model: { enabled: boolean; maxWeightKg: number | null; maxDistanceKm: number | null } = {
    enabled: false,
    maxWeightKg: null,
    maxDistanceKm: null,
  };

  readonly canEdit = computed(() => this.perm.can('order.accept'));
  readonly loadNotice = signal('规则加载失败，请稍后刷新重试');

  ngOnInit(): void {
    // 自动接单规则按商家维度维护，平台管理员账号未绑定商家时后端会拒绝，前端直接给出提示
    if (this.auth.roles().includes('Admin')) {
      this.loadNotice.set('平台管理员账号未绑定商家，自动接单规则需由商家（或商家子账号）维护');
      this.loading.set(false);
      return;
    }
    this.load();
  }

  back(): void {
    void this.router.navigateByUrl('/orders');
  }

  save(): void {
    if (!this.canEdit()) {
      this.message.warning('当前账号无自动接单规则修改权限');
      return;
    }
    if (this.model.enabled && (!(this.model.maxWeightKg && this.model.maxWeightKg > 0) || !(this.model.maxDistanceKm && this.model.maxDistanceKm > 0))) {
      this.message.warning('启用自动接单前，请填写有效的最大重量与最远距离');
      return;
    }
    this.confirm
      .open({
        title: '保存自动接单规则',
        content: this.model.enabled
          ? '保存后，命中重量与距离条件的新订单将自动接单并进入待调度。确认保存？'
          : '保存后自动接单将停用，新订单需人工接单。确认保存？',
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.saving.set(true);
        this.api
          .put<AutoAcceptRuleDto>('/orders/auto-accept', {
            enabled: this.model.enabled,
            maxWeightKg: this.model.maxWeightKg,
            maxDistanceKm: this.model.maxDistanceKm,
          })
          .subscribe({
            next: (rule) => {
              this.saving.set(false);
              this.rule.set(rule);
              this.model = {
                enabled: rule.enabled,
                maxWeightKg: rule.maxWeightKg ?? null,
                maxDistanceKm: rule.maxDistanceKm ?? null,
              };
              this.message.success('自动接单规则已保存');
            },
            error: () => this.saving.set(false),
          });
      });
  }

  private load(): void {
    this.loading.set(true);
    this.api.get<AutoAcceptRuleDto>('/orders/auto-accept').subscribe({
      next: (rule) => {
        this.rule.set(rule);
        this.model = {
          enabled: rule.enabled,
          maxWeightKg: rule.maxWeightKg ?? null,
          maxDistanceKm: rule.maxDistanceKm ?? null,
        };
        this.loading.set(false);
      },
      error: () => {
        this.rule.set(null);
        this.loading.set(false);
      },
    });
  }
}

