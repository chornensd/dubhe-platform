import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import type { EChartsCoreOption } from 'echarts/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { interval } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { MerchantDashboardDto, Paged, RoleCodes, UserListItemDto } from '../../core/api-types';
import { AuthService } from '../../core/auth.service';
import { PermissionService } from '../../core/permission.service';
import { ChartComponent } from '../../shared/chart';
import { formatDateTime } from '../../shared/data-table';
import { PageHeaderComponent } from '../../shared/page-header';
import { SearchSelectComponent, SelectOption } from '../../shared/search-select';
import { StatCardComponent } from '../../shared/stat-card';

const AUTO_REFRESH_MS = 5 * 60 * 1000;

@Component({
  selector: 'app-dashboard-merchant',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzSpinModule,
    PageHeaderComponent,
    StatCardComponent,
    ChartComponent,
    SearchSelectComponent,
  ],
  template: `
    <app-page-header title="商家看板" subtitle="订单完成、营收与运力使用情况，每 5 分钟自动刷新">
      @if (isMerchantUser() && !canSwitchMerchant()) {
        <span class="text-secondary">当前商家：{{ merchantLabel() || '已绑定账号' }}</span>
      }
      @if (canSearchMerchant()) {
        <app-search-select
          style="width: 260px"
          [options]="merchantOptions()"
          [loading]="merchantLoading()"
          placeholder="搜索商家（名称 / 手机号）"
          [ngModel]="merchantId()"
          (ngModelChange)="onMerchant($event)"
          (search)="loadMerchants($event)"
        />
      } @else if (canSwitchMerchant()) {
        <input
          nz-input
          style="width: 220px"
          placeholder="商家 ID（GUID）"
          [ngModel]="merchantInput()"
          (ngModelChange)="merchantInput.set($event)"
          (keyup.enter)="applyMerchantInput()"
        />
        <button nz-button (click)="applyMerchantInput()">加载</button>
      }
      <span class="text-secondary">更新于 {{ updatedAt() || '--' }}</span>
      <button nz-button (click)="load()" [nzLoading]="loading()">
        <span nz-icon nzType="reload"></span> 刷新
      </button>
    </app-page-header>

    @if (needMerchant() && !data()) {
      <div class="card">
        <nz-alert nzType="info" nzShowIcon nzMessage="请先在上方选择要查看的商家，再查看商家看板数据" />
      </div>
    }

    @if (data(); as d) {
      <div class="grid grid--5">
        <app-stat-card label="完成订单量" [value]="d.completedOrders" unit="单" [dark]="true" />
        <app-stat-card label="创建订单量" [value]="d.createdOrders" unit="单" />
        <app-stat-card label="任务完成率" [value]="rate(d.completionRate)" unit="%" [digits]="1" />
        <app-stat-card label="已支付营收" [value]="d.paidRevenue" unit="元" />
        <app-stat-card label="飞行器使用率" [value]="rate(d.droneUtilization)" unit="%" [digits]="1" />
      </div>

      <div class="grid grid--2 mt-16">
        <div class="card">
          <div class="card__title">近 7 天营收趋势</div>
          @if (revenueChart(); as option) {
            <app-chart [option]="option" [height]="320" />
          } @else {
            <div class="text-secondary">暂无营收趋势数据</div>
          }
        </div>
        <div class="card">
          <div class="card__title">配送时长分布</div>
          @if (durationChart(); as option) {
            <app-chart [option]="option" [height]="320" />
          } @else {
            <div class="text-secondary">暂无配送时长数据</div>
          }
        </div>
      </div>
    } @else if (loading()) {
      <div class="card page-loading"><nz-spin nzSimple /></div>
    } @else {
      @if (!needMerchant()) {
        <div class="card"><nz-empty nzNotFoundContent="暂无看板数据，请稍后重试" /></div>
      }
    }
  `,
})
export class MerchantDashboardPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  readonly perm = inject(PermissionService);

  readonly data = signal<MerchantDashboardDto | null>(null);
  readonly loading = signal(false);
  readonly updatedAt = signal('');
  readonly merchantId = signal<string | null>(null);
  readonly needMerchant = signal(false);
  readonly merchantInput = signal('');
  readonly merchantOptions = signal<SelectOption[]>([]);
  readonly merchantLabel = signal('');
  readonly merchantLoading = signal(false);

  readonly canSearchMerchant = computed(() => this.perm.can('account.user.manage'));
  readonly canSwitchMerchant = computed(
    () => this.canSearchMerchant() || this.perm.role(RoleCodes.Admin) || this.perm.role(RoleCodes.Dispatcher),
  );
  readonly isMerchantUser = computed(() => ['Merchant', 'MerchantStaff'].includes(this.auth.user()?.userType ?? ''));

  readonly revenueChart = computed<EChartsCoreOption | null>(() => {
    const points = this.data()?.revenueTrend ?? [];
    if (!points.length) return null;
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 8, right: 16, top: 30, bottom: 4, containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: points.map((p) => p.date.slice(5, 10)) },
      yAxis: { type: 'value', name: '营收（元）' },
      series: [
        {
          name: '已支付营收',
          type: 'line',
          smooth: true,
          data: points.map((p) => p.value),
          itemStyle: { color: '#1677ff' },
          areaStyle: { opacity: 0.08 },
        },
      ],
    };
  });

  readonly durationChart = computed<EChartsCoreOption | null>(() => {
    const items = this.data()?.deliveryDurationDistribution ?? [];
    if (!items.length) return null;
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 8, right: 16, top: 30, bottom: 4, containLabel: true },
      xAxis: { type: 'category', data: items.map((item) => item.bucket) },
      yAxis: { type: 'value', name: '订单数', minInterval: 1 },
      series: [
        {
          name: '订单数',
          type: 'bar',
          barMaxWidth: 48,
          data: items.map((item) => item.count),
          itemStyle: { color: '#36cfc9' },
        },
      ],
    };
  });

  constructor() {
    const me = this.auth.user();
    if (this.isMerchantUser()) {
      this.merchantLabel.set(me?.companyName ?? me?.displayName ?? '');
    }
    if (this.canSearchMerchant()) this.loadMerchants('');
    interval(AUTO_REFRESH_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.load());
  }

  ngOnInit(): void {
    // 平台管理员未绑定商家：默认选中第一个已审核商家，避免空白页
    if (this.auth.roles().includes('Admin') && !this.merchantId()) {
      this.api
        .get<Paged<UserListItemDto>>('/admin/users', { pageNum: 1, pageSize: 1, roleCode: 'Merchant', status: 1 })
        .subscribe({
          next: (page) => {
            const first = page.items?.[0];
            if (first) {
              this.merchantId.set(first.id);
              this.merchantLabel.set(first.displayName);
            }
            this.load();
          },
          error: () => this.load(),
        });
      return;
    }
    this.load();
  }

  load(): void {
    // 平台管理员必须指定商家，否则后端按"未绑定商家"拒绝；此处跳过请求并提示选择商家
    if (this.auth.roles().includes('Admin') && !this.merchantId()) {
      this.loading.set(false);
      this.data.set(null);
      this.needMerchant.set(true);
      return;
    }
    if (this.loading()) return;
    this.needMerchant.set(false);
    this.loading.set(true);
    this.api
      .get<MerchantDashboardDto>('/reports/dashboard/merchant', { merchantId: this.merchantId() ?? undefined })
      .subscribe({
        next: (dashboard) => {
          this.data.set(dashboard);
          this.updatedAt.set(formatDateTime(new Date(), 'HH:mm:ss'));
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onMerchant(value: string | number | null): void {
    this.merchantId.set(value ? String(value) : null);
    const match = this.merchantOptions().find((option) => option.value === value);
    this.merchantLabel.set(match?.label ?? '');
    this.load();
  }

  applyMerchantInput(): void {
    const value = this.merchantInput().trim();
    this.merchantId.set(value || null);
    this.load();
  }

  loadMerchants(keyword: string): void {
    if (!this.canSearchMerchant()) return;
    this.merchantLoading.set(true);
    this.api
      .get<Paged<UserListItemDto>>('/admin/users', {
        pageNum: 1,
        pageSize: 30,
        roleCode: RoleCodes.Merchant,
        keyword: keyword || undefined,
      })
      .subscribe({
        next: (page) => {
          this.merchantOptions.set(
            (page.items ?? []).map((user) => ({ value: user.id, label: `${user.displayName}（${user.phone}）` })),
          );
          this.merchantLoading.set(false);
        },
        error: () => this.merchantLoading.set(false),
      });
  }

  rate(value: number | null | undefined): number {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? Number((num * 100).toFixed(2)) : 0;
  }
}




