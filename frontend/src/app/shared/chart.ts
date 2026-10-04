import { Component, ElementRef, OnDestroy, afterNextRender, effect, input, viewChild } from '@angular/core';
import { BarChart, GaugeChart, LineChart, PieChart, RadarChart, ScatterChart } from 'echarts/charts';
import {
  DataZoomComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import type { EChartsCoreOption } from 'echarts/core';
import { LegacyGridContainLabel } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GaugeChart,
  RadarChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  DataZoomComponent,
  DatasetComponent,
  VisualMapComponent,
  MarkLineComponent,
  LegacyGridContainLabel,
  CanvasRenderer,
]);

/** ECharts 封装：按信号自动更新、窗口自适应、深浅主题 */
@Component({
  selector: 'app-chart',
  standalone: true,
  template: `<div #host class="chart" [style.height.px]="height()"></div>`,
  styles: [
    `
      .chart {
        width: 100%;
        min-height: 120px;
      }
    `,
  ],
})
export class ChartComponent implements OnDestroy {
  readonly option = input<EChartsCoreOption | null>(null);
  readonly height = input(300);
  readonly dark = input(false);

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private chart?: echarts.ECharts;
  private observer?: ResizeObserver;

  constructor() {
    afterNextRender(() => {
      this.chart = echarts.init(this.host().nativeElement, this.dark() ? 'dark' : undefined, { renderer: 'canvas' });
      this.applyOption();
      this.observer = new ResizeObserver(() => this.chart?.resize());
      this.observer.observe(this.host().nativeElement);
    });

    effect(() => {
      // 读取信号以建立依赖
      this.option();
      this.dark();
      queueMicrotask(() => this.applyOption());
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.chart?.dispose();
  }

  private applyOption(): void {
    const chart = this.chart;
    const option = this.option();
    if (!chart || !option) return;
    chart.setOption(option, true);
  }
}
