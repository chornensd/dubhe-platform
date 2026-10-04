import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { EChartsCoreOption } from 'echarts/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { interval } from 'rxjs';
import { AdminDashboardDto, EmergencyLevelNameText, NotificationTypeNameText, ViolationTypeNameText } from '../../core/api-types';
import { ApiService } from '../../core/api.service';
import { ChartComponent } from '../../shared/chart';
import { formatDateTime } from '../../shared/data-table';
import { PageHeaderComponent } from '../../shared/page-header';
import { StatCardComponent } from '../../shared/stat-card';

const AUTO_REFRESH_MS = 5 * 60 * 1000;

@Component({
  selector: 'app-dashboard-admin',
  standalone: true,
  imports: [
    CommonModule,
    NzButtonModule,
    NzEmptyModule,
    NzIconModule,
    NzSpinModule,
    PageHeaderComponent,
    StatCardComponent,
    ChartComponent,
  ],
  template: `
    <app-page-header title="管理员看板" subtitle="平台运营全景：订单、营收、活跃度与合规告警，每 5 分钟自动刷新">
      <span class="text-secondary">最后更新 {{ updatedAt() || '--' }}</span>
      <button nz-button (click)="load()" [nzLoading]="loading()">
        <span nz-icon nzType="reload"></span> 刷新
      </button>
    </app-page-header>

    @if (data(); as d) {
      <div class="grid grid--4">
        <app-stat-card label="订单总量" [value]="d.totalOrders" unit="单" [dark]="true" />
        <app-stat-card label="今日新增" [value]="d.todayOrders" unit="单" />
        <app-stat-card label="总营收（已支付）" [value]="d.totalRevenue" unit="元" />
        <app-stat-card label="活跃商家" [value]="d.activeMerchants" unit="家" />
        <app-stat-card label="活跃客户" [value]="d.activeCustomers" unit="人" />
        <app-stat-card label="空域利用率" [value]="rate(d.airspaceUtilization)" unit="%" [digits]="1" />
        <app-stat-card
          label="违规率"
          [value]="rate(d.violationRate)"
          unit="%"
          [digits]="1"
          [alert]="d.violationRate > 0.05"
          hint="阈值 5%"
        />
      </div>

      <div class="card mt-16">
        <div class="card__title">
          实时告警
          <span class="card__subtitle">共 {{ d.alerts.length }} 条</span>
        </div>
        @if (d.alerts.length) {
          <div class="alert-list">
            @for (alert of d.alerts; track $index) {
              <div [class]="'alert-item ' + alertClass(alert.level)">
                <span class="alert-item__badge">{{ levelText(alert.level) }}</span>
                <span class="alert-item__type">{{ typeText(alert.type) }}</span>
                <span class="alert-item__title">{{ alert.title }}</span>
                <span class="alert-item__time">{{ time(alert.occurredAt) }}</span>
              </div>
            }
          </div>
        } @else {
          <div class="text-secondary">当前无实时告警，平台运行状态正常</div>
        }
      </div>

      <div class="card mt-16">
        <div class="card__title">
          近 7 天订单与违规趋势
          <span class="card__subtitle">订单量 / 违规数</span>
        </div>
        @if (trendChart(); as option) {
          <app-chart [option]="option" [height]="340" />
        } @else {
          <div class="text-secondary">暂无趋势数据</div>
        }
      </div>
    } @else if (loading()) {
      <div class="card page-loading"><nz-spin nzSimple /></div>
    } @else {
      <div class="card"><nz-empty nzNotFoundContent="暂无看板数据，请稍后重试" /></div>
    }
  `,
  styles: [
    `
      .alert-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .alert-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 13px;
        border-left: 3px solid transparent;
        background: #f8fafd;
      }
      .alert-item__badge {
        flex: 0 0 48px;
        text-align: center;
        font-size: 12px;
        border-radius: 4px;
        padding: 1px 0;
      }
      .alert-item__type {
        flex: 0 0 96px;
        color: #6b7688;
      }
      .alert-item__title {
        flex: 1;
        color: #1f2637;
      }
      .alert-item__time {
        color: #8c96a8;
        font-size: 12px;
      }
      .alert-item--critical {
        border-left-color: #ff4d4f;
        background: #fff1f0;
      }
      .alert-item--critical .alert-item__badge {
        background: #ff4d4f;
        color: #fff;
      }
      .alert-item--serious {
        border-left-color: #faad14;
        background: #fffbe6;
      }
      .alert-item--serious .alert-item__badge {
        background: #faad14;
        color: #fff;
      }
      .alert-item--normal {
        border-left-color: #1677ff;
        background: #f0f5ff;
      }
      .alert-item--normal .alert-item__badge {
        background: #1677ff;
        color: #fff;
      }
    `,
  ],
})
export class AdminDashboardPage implements OnInit {
  private readonly api = inject(ApiService);

  readonly data = signal<AdminDashboardDto | null>(null);
  readonly loading = signal(false);
  readonly updatedAt = signal('');

  readonly trendChart = computed<EChartsCoreOption | null>(() => {
    const dashboard = this.data();
    if (!dashboard) return null;
    const orderTrend = dashboard.orderTrend ?? [];
    const violationTrend = dashboard.violationTrend ?? [];
    if (!orderTrend.length && !violationTrend.length) return null;
    const keys = Array.from(new Set([...orderTrend.map((p) => p.date), ...violationTrend.map((p) => p.date)])).sort();
    const orderMap = new Map(orderTrend.map((p) => [p.date, p.value]));
    const violationMap = new Map(violationTrend.map((p) => [p.date, p.value]));
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['订单量', '违规数'], top: 0 },
      grid: { left: 8, right: 16, top: 36, bottom: 4, containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: keys.map((key) => key.slice(5, 10)) },
      yAxis: [
        { type: 'value', name: '订单量', minInterval: 1 },
        { type: 'value', name: '违规数', minInterval: 1 },
      ],
      series: [
        {
          name: '订单量',
          type: 'line',
          smooth: true,
          data: keys.map((key) => orderMap.get(key) ?? 0),
          itemStyle: { color: '#1677ff' },
          areaStyle: { opacity: 0.08 },
        },
        {
          name: '违规数',
          type: 'line',
          smooth: true,
          yAxisIndex: 1,
          data: keys.map((key) => violationMap.get(key) ?? 0),
          itemStyle: { color: '#ff4d4f' },
        },
      ],
    };
  });

  constructor() {
    interval(AUTO_REFRESH_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.load());
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.api.get<AdminDashboardDto>('/reports/dashboard/admin').subscribe({
      next: (dashboard) => {
        this.data.set(dashboard);
        this.updatedAt.set(formatDateTime(new Date(), 'HH:mm:ss'));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  rate(value: number | null | undefined): number {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? Number((num * 100).toFixed(2)) : 0;
  }

  levelText(level: string): string {
    return EmergencyLevelNameText[level] ?? level;
  }

  typeText(type: string): string {
    return ViolationTypeNameText[type] ?? NotificationTypeNameText[type] ?? type;
  }

  time(value: string): string {
    return formatDateTime(value);
  }

  alertClass(level: string): string {
    const text = this.levelText(level);
    if (/紧急/.test(text)) return 'alert-item--critical';
    if (/严重/.test(text)) return 'alert-item--serious';
    return 'alert-item--normal';
  }
}



