import { Component, computed, input } from '@angular/core';

/** 指标卡：数值 + 单位 + 环比/阈值高亮 */
@Component({
  selector: 'app-stat-card',
  standalone: true,
  template: `
    <div class="stat-card" [class.stat-card--dark]="dark()" [class.stat-card--alert]="alert()">
      <div class="stat-card__label">
        {{ label() }}
        @if (hint()) {
          <span class="stat-card__hint">{{ hint() }}</span>
        }
      </div>
      <div class="stat-card__value">
        {{ display() }}
        @if (unit()) {
          <span class="stat-card__unit">{{ unit() }}</span>
        }
      </div>
      @if (trend() !== null) {
        <div class="stat-card__trend" [class.up]="(trend() ?? 0) >= 0" [class.down]="(trend() ?? 0) < 0">
          {{ (trend() ?? 0) >= 0 ? '▲' : '▼' }} {{ abs(trend() ?? 0) }}%
        </div>
      }
      @if (footer()) {
        <div class="stat-card__footer">{{ footer() }}</div>
      }
    </div>
  `,
  styles: [
    `
      .stat-card {
        background: #fff;
        border-radius: 10px;
        padding: 18px 20px;
        border: 1px solid #eef1f6;
        box-shadow: 0 2px 8px rgba(23, 43, 77, 0.04);
        height: 100%;
      }
      .stat-card--dark {
        background: linear-gradient(135deg, #0b1e3d 0%, #123a6b 100%);
        border: none;
      }
      .stat-card--dark .stat-card__label,
      .stat-card--dark .stat-card__hint,
      .stat-card--dark .stat-card__footer {
        color: rgba(255, 255, 255, 0.65);
      }
      .stat-card--dark .stat-card__value {
        color: #fff;
      }
      .stat-card--dark .stat-card__unit {
        color: rgba(255, 255, 255, 0.65);
      }
      .stat-card--alert {
        border-color: #ffccc7;
        box-shadow: 0 0 0 2px rgba(255, 77, 79, 0.12);
        animation: stat-alert 1.6s ease-in-out infinite;
      }
      @keyframes stat-alert {
        0%,
        100% {
          box-shadow: 0 0 0 2px rgba(255, 77, 79, 0.08);
        }
        50% {
          box-shadow: 0 0 0 5px rgba(255, 77, 79, 0.2);
        }
      }
      .stat-card__label {
        color: #6b7688;
        font-size: 13px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .stat-card__hint {
        font-size: 11px;
        color: #a3adc2;
      }
      .stat-card__value {
        margin-top: 10px;
        font-size: 30px;
        line-height: 1.1;
        font-weight: 700;
        color: #1f2637;
        font-variant-numeric: tabular-nums;
      }
      .stat-card__unit {
        font-size: 13px;
        font-weight: 400;
        color: #8c96a8;
        margin-left: 6px;
      }
      .stat-card__trend {
        margin-top: 8px;
        font-size: 12px;
      }
      .stat-card__trend.up {
        color: #52c41a;
      }
      .stat-card__trend.down {
        color: #ff4d4f;
      }
      .stat-card__footer {
        margin-top: 8px;
        font-size: 12px;
        color: #8c96a8;
      }
    `,
  ],
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input<number | string | null | undefined>(0);
  readonly unit = input<string>('');
  readonly hint = input<string>('');
  readonly footer = input<string>('');
  readonly trend = input<number | null>(null);
  readonly alert = input(false);
  readonly dark = input(false);
  readonly digits = input<number | null>(null);

  readonly display = computed(() => {
    const v = this.value();
    if (v === null || v === undefined) return '-';
    if (typeof v === 'number') {
      const digits = this.digits();
      if (digits !== null) return v.toFixed(digits);
      return v.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
    }
    return v;
  });

  abs(value: number): number {
    return Math.abs(value);
  }
}
