import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { AuthService } from '../../core/auth.service';
import { UserType } from '../../core/api-types';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NzFormModule, NzInputModule, NzButtonModule, NzIconModule, NzRadioModule],
  template: `
    <div class="auth-page">
      <div class="auth-page__hero">
        <div class="hero__badge">账号注册</div>
        <h1 class="hero__title">加入天枢低空运营网络</h1>
        <p class="hero__desc">
          个人客户注册后即可下单；企业客户与物流运营企业（商家）需提交资料并经平台审核，审核通过后开通运营能力。
        </p>
        <ul class="hero__list">
          <li><span nz-icon nzType="user"></span> 个人客户：即时开通，快速下单寄递</li>
          <li><span nz-icon nzType="bank"></span> 企业客户：对公结算与发票管理</li>
          <li><span nz-icon nzType="shop"></span> 商家：接单调度、资源与空域申报</li>
        </ul>
      </div>

      <div class="auth-page__panel">
        <div class="register">
          <h2 class="register__title">创建账号</h2>
          <p class="register__hint">带 * 为必填项，注册信息将用于资质审核</p>

          <div class="register__types">
            @for (type of types; track type.value) {
              <label class="register__type" [class.register__type--active]="userType() === type.value">
                <input type="radio" name="userType" [value]="type.value" [checked]="userType() === type.value" (change)="userType.set(type.value)" />
                <div class="register__type-name">{{ type.label }}</div>
                <div class="register__type-desc">{{ type.desc }}</div>
              </label>
            }
          </div>

          <nz-form-item>
            <nz-form-control>
              <input nz-input nzSize="large" placeholder="用户名（登录用，4-20 位）" [(ngModel)]="model.username" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-control>
              <input nz-input nzSize="large" placeholder="手机号" [(ngModel)]="model.phone" maxlength="11" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-control>
              <input nz-input nzSize="large" type="password" placeholder="密码（至少 8 位，含大小写与数字）" [(ngModel)]="model.password" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-control>
              <input nz-input nzSize="large" placeholder="联系人 / 昵称" [(ngModel)]="model.displayName" />
            </nz-form-control>
          </nz-form-item>
          @if (needCompany()) {
            <nz-form-item>
              <nz-form-control>
                <input nz-input nzSize="large" placeholder="企业 / 公司名称（用于资质审核）" [(ngModel)]="model.companyName" />
              </nz-form-control>
            </nz-form-item>
          }

          <button nz-button nzType="primary" nzSize="large" class="register__submit" [nzLoading]="loading()" (click)="submit()">
            提交注册
          </button>

          <div class="register__foot">
            <span class="text-secondary">已有账号？</span>
            <a routerLink="/auth/login">返回登录</a>
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
        font-size: 32px;
        margin: 0 0 16px;
        font-weight: 600;
      }
      .hero__desc {
        font-size: 15px;
        color: rgba(255, 255, 255, 0.72);
        line-height: 1.9;
        max-width: 520px;
        margin-bottom: 24px;
      }
      .hero__list {
        list-style: none;
        padding: 0;
        color: rgba(255, 255, 255, 0.85);
        font-size: 14px;
        line-height: 2.4;
      }
      .hero__list span {
        margin-right: 10px;
        color: #36cfc9;
      }
      .register {
        width: 100%;
        max-width: 420px;
      }
      .register__title {
        font-size: 22px;
        margin: 0 0 6px;
      }
      .register__hint {
        font-size: 12px;
        color: #98a2b3;
        margin-bottom: 16px;
      }
      .register__types {
        display: flex;
        gap: 8px;
        margin-bottom: 16px;
      }
      .register__type {
        flex: 1;
        border: 1px solid #e3e8f0;
        border-radius: 8px;
        padding: 8px 10px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .register__type--active {
        border-color: #1677ff;
        background: #f0f7ff;
        box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
      }
      .register__type input {
        display: none;
      }
      .register__type-name {
        font-size: 13px;
        font-weight: 600;
      }
      .register__type-desc {
        font-size: 11px;
        color: #98a2b3;
        margin-top: 2px;
      }
      .register__submit {
        width: 100%;
      }
      .register__foot {
        margin-top: 14px;
        font-size: 13px;
        display: flex;
        gap: 6px;
      }
    `,
  ],
})
export class RegisterPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);

  readonly loading = signal(false);
  readonly userType = signal<number>(UserType.IndividualCustomer);

  readonly types = [
    { value: UserType.IndividualCustomer, label: '个人客户', desc: '即时开通' },
    { value: UserType.EnterpriseCustomer, label: '企业客户', desc: '需审核' },
    { value: UserType.Merchant, label: '物流运营企业', desc: '需审核' },
  ];

  model = {
    username: '',
    phone: '',
    password: '',
    displayName: '',
    companyName: '',
  };

  readonly needCompany = computed(() => this.userType() !== UserType.IndividualCustomer);

  submit(): void {
    const { username, phone, password, displayName, companyName } = this.model;
    if (!username.trim() || !phone.trim() || !password || !displayName.trim()) {
      this.message.warning('请完整填写注册信息');
      return;
    }
    if (!/^1\d{10}$/.test(phone.trim())) {
      this.message.warning('请输入正确的手机号');
      return;
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      this.message.warning('密码至少 8 位，且需包含大小写字母与数字');
      return;
    }
    if (this.needCompany() && !companyName.trim()) {
      this.message.warning('请填写企业名称');
      return;
    }

    this.loading.set(true);
    this.auth
      .register({
        username: username.trim(),
        phone: phone.trim(),
        password,
        displayName: displayName.trim(),
        userType: this.userType(),
        companyName: this.needCompany() ? companyName.trim() : null,
      })
      .subscribe({
        next: (user) => {
          this.loading.set(false);
          if (user.status === 'Active') {
            this.message.success('注册成功，请使用该账号登录');
          } else {
            this.message.info('注册已提交，请等待平台审核通过后登录使用');
          }
          void this.router.navigate(['/auth/login'], { queryParams: { account: user.username } });
        },
        error: () => this.loading.set(false),
      });
  }
}
