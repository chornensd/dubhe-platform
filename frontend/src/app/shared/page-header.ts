import { Component, input } from '@angular/core';

/** 页面标题栏：标题 + 说明 + 右侧操作区 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <div class="page-header">
      <div class="page-header__main">
        <div class="page-header__title">
          {{ title() }}
          @if (tag()) {
            <span class="page-header__tag">{{ tag() }}</span>
          }
        </div>
        @if (subtitle()) {
          <div class="page-header__subtitle">{{ subtitle() }}</div>
        }
      </div>
      <div class="page-header__extra">
        <ng-content />
      </div>
    </div>
  `,
  styles: [
    `
      .page-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
      }
      .page-header__title {
        font-size: 20px;
        font-weight: 600;
        color: #1f2637;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .page-header__tag {
        font-size: 12px;
        font-weight: 400;
        color: #1677ff;
        background: #e6f4ff;
        border: 1px solid #91caff;
        border-radius: 4px;
        padding: 1px 8px;
      }
      .page-header__subtitle {
        margin-top: 6px;
        color: #8c96a8;
        font-size: 13px;
      }
      .page-header__extra {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly tag = input<string>('');
}
