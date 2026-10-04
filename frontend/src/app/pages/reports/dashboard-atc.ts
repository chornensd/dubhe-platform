import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { EChartsCoreOption } from 'echarts/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { interval } from 'rxjs';
import { AirTrafficDashboardDto, ViolationTypeNameText } from '../../core/api-types';
import { ApiService } from '../../core/api.service';
import { ChartComponent } from '../../shared/chart';
import { formatDateTime } from '../../shared/data-table';
import { MapCanvasComponent, MapHeat } from '../../shared/map-canvas';
import { PageHeaderComponent } from '../../shared/page-header';
import { StatCardComponent } from '../../shared/stat-card';

const AUTO_REFRESH_MS = 5 * 60 * 1000;

@Component({
  selector: 'app-dashboard-atc',
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
    MapCanvasComponent,
  ],
  template: `
    <app-page-header title="空管看板" subtitle="飞行计划审批、冲突与违规分布、飞行密度，每 5 分钟自动刷新">
      <span class="text-secondary">更新于 {{ updatedAt() || '--' }}</span>
      <button nz-button (click)="load()" [nzLoading]="loading()">
        <span nz-icon nzType="reload"></span> 刷新
      </button>
    </app-page-header>

    @if (data(); as d) {
      <div class="grid grid--5">
        <app-stat-card label="计划总量" [value]="d.totalPlans" unit="件" [dark]="true" />
        <app-stat-card label="已批准" [value]="d.approvedPlans" unit="件" />
        <app-stat-card label="通过率" [value]="rate(d.approvalRate)" unit="%" [digits]="1" />
        <app-stat-card label="冲突次数" [value]="d.conflictPlans" unit="次" />
        <app-stat-card
          label="冲突率"
          [value]="rate(d.conflictRate)"
          unit="%"
          [digits]="1"
          [alert]="d.conflictRate > 0.05"
          hint="阈值 5%"
        />
      </div>

      <div class="grid grid--2 mt-16">
        <div class="card">
          <div class="card__title">违规类型分布</div>
          @if (violationChart(); as option) {
            <app-chart [option]="option" [height]="360" />
          } @else {
            <div class="text-secondary">暂无违规数据</div>
          }
        </div>
        <div class="card">
          <div class="card__title">
            飞行密度
            <span class="card__subtitle">按上报位置聚合，红圈越大表示架次越多</span>
          </div>
          <app-map-canvas [heat]="density()" [height]="420" />
        </div>
      </div>
    } @else if (loading()) {
      <div class="card page-loading"><nz-spin nzSimple /></div>
    } @else {
      <div class="card"><nz-empty nzNotFoundContent="暂无看板数据，请稍后重试" /></div>
    }
  `,
})
export class AtcDashboardPage implements OnInit {
  private readonly api = inject(ApiService);

  readonly data = signal<AirTrafficDashboardDto | null>(null);
  readonly loading = signal(false);
  readonly updatedAt = signal('');

  readonly density = computed<MapHeat[]>(() =>
    (this.data()?.flightDensity ?? []).map((cell) => ({ lat: cell.lat, lng: cell.lng, count: cell.count })),
  );

  readonly violationChart = computed<EChartsCoreOption | null>(() => {
    const items = this.data()?.violationsByType ?? [];
    if (!items.length) return null;
    return {
      tooltip: { trigger: 'item', formatter: '{b}：{c} 次（{d}%）' },
      legend: { bottom: 0, type: 'scroll' },
      color: ['#ff4d4f', '#faad14', '#1677ff', '#722ed1', '#13c2c2'],
      series: [
        {
          name: '违规类型',
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: true,
          data: items.map((item) => ({ name: this.typeText(item.bucket), value: item.count })),
          label: { formatter: '{b}\n{c} 次' },
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
    this.api.get<AirTrafficDashboardDto>('/reports/dashboard/air-traffic').subscribe({
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

  typeText(bucket: string): string {
    return ViolationTypeNameText[bucket] ?? bucket;
  }
}
