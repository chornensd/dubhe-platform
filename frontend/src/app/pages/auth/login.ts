import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AuthService } from '../../core/auth.service';
import { defaultHome } from '../../core/nav.config';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NzFormModule, NzInputModule, NzButtonModule, NzIconModule],
  template: `
    <div class="auth-page">
      <div class="auth-page__hero">
        <div class="hero__badge">低空经济 · 数字底座</div>
        <h1 class="hero__title">天枢 · 低空智能运营管控平台</h1>
        <p class="hero__desc">覆盖「申请 — 审批 — 调度 — 监控 — 结算」全生命周期的城市级低空资源综合管理平台</p>
        <ul class="hero__list">
          <li><span nz-icon nzType="rocket"></span> 订单全流程管控与低空资源智能调度</li>
          <li><span nz-icon nzType="safety-certificate"></span> 空域合规校验、飞行计划审批与实时监控</li>
          <li><span nz-icon nzType="bar-chart"></span> 多角色数据看板与自定义报表分析</li>
          <li><span nz-icon nzType="alert"></span> 应急告警处置与客服工单闭环</li>
        </ul>
        <div class="hero__meta">7×24 稳定运行 · 全链路操作审计 · 双端统一权限体系</div>
      </div>

      <div class="auth-page__panel">
        <div class="login">
          <div class="login__brand">
            <div class="login__logo">天</div>
            <div>
              <div class="login__name">天枢</div>
              <div class="login__sub">低空智能运营管控平台</div>
            </div>
          </div>

          <h2 class="login__title">账号登录</h2>
          <p class="login__hint">支持用户名或手机号登录，连续 5 次密码错误将锁定 15 分钟</p>

          <nz-form-item>
            <nz-form-control>
              <nz-input-wrapper>
                <span nz-icon nzType="user" nzInputPrefix></span>
                <input nz-input placeholder="用户名 / 手机号" [(ngModel)]="account" (keyup.enter)="submit()" />
              </nz-input-wrapper>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-control>
              <nz-input-wrapper>
                <span nz-icon nzType="lock" nzInputPrefix></span>
                <input nz-input type="password" placeholder="密码" [(ngModel)]="password" (keyup.enter)="submit()" />
              </nz-input-wrapper>
            </nz-form-control>
          </nz-form-item>

          <button nz-button nzType="primary" nzSize="large" class="login__submit" [nzLoading]="loading()" (click)="submit()">
            登 录
          </button>

          <div class="login__foot">
            <span class="text-secondary">还没有账号？</span>
            <a routerLink="/auth/register">立即注册</a>
          </div>

          <div class="login__security">
            为保障平台数据安全，请勿共享账号；连续 5 次密码错误将锁定账号，后台 30 分钟无操作自动退出。
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .hero__badge {
        display: inline-block;
        border: 1px solid rgba(255, 255, 255, 0.35);
        border-radius: 20px;
        padding: 4px 14px;
        font-size: 12px;
        letter-spacing: 1px;
        margin-bottom: 20px;
      }
      .hero__title {
        font-size: 34px;
        margin: 0 0 16px;
        font-weight: 600;
        letter-spacing: 1px;
      }
      .hero__desc {
        font-size: 15px;
        color: rgba(255, 255, 255, 0.72);
        line-height: 1.9;
        max-width: 520px;
        margin-bottom: 28px;
      }
      .hero__list {
        list-style: none;
        padding: 0;
        margin: 0 0 32px;
        color: rgba(255, 255, 255, 0.85);
        font-size: 14px;
        line-height: 2.4;
      }
      .hero__list span {
        margin-right: 10px;
        color: #36cfc9;
      }
      .hero__meta {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.45);
        letter-spacing: 1px;
      }

      .login {
        width: 100%;
        max-width: 380px;
      }
      .login__brand {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 28px;
      }
      .login__logo {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        background: linear-gradient(135deg, #1677ff, #36cfc9);
        color: #fff;
        font-size: 20px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .login__name {
        font-size: 17px;
        font-weight: 600;
        letter-spacing: 2px;
      }
      .login__sub {
        font-size: 12px;
        color: #8c96a8;
      }
      .login__title {
        font-size: 22px;
        margin: 0 0 6px;
      }
      .login__hint {
        font-size: 12px;
        color: #98a2b3;
        margin-bottom: 20px;
      }
      .login__submit {
        width: 100%;
        margin-top: 4px;
      }
      .login__foot {
        margin-top: 16px;
        font-size: 13px;
        display: flex;
        gap: 6px;
      }
      .login__security {
        margin-top: 24px;
        font-size: 12px;
        line-height: 1.9;
        color: #a3adc2;
        border-top: 1px dashed #e3eaf5;
        padding-top: 14px;
      }
    `,
  ],
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  account = this.route.snapshot.queryParamMap.get('account') ?? '';
  password = '';


  submit(): void {
    if (!this.account.trim() || !this.password) {
      this.message.warning('请输入账号与密码');
      return;
    }
    this.loading.set(true);
    this.auth.login(this.account.trim(), this.password).subscribe({
      next: (result) => {
        this.loading.set(false);
        this.message.success(`欢迎回来，${result.user.displayName}`);
        const roles = result.user.roles ?? [];
        const perms = result.user.permissions ?? [];
        void this.router.navigateByUrl(defaultHome(roles, perms));
      },
      error: () => this.loading.set(false),
    });
  }
}


