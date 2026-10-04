import { CommonModule } from '@angular/common';
import { Component, ContentChild, EventEmitter, Input, Output, TemplateRef, computed, input } from '@angular/core';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzTableModule } from 'ng-zorro-antd/table';
import { StatusTagComponent } from './status-tag';

export interface DataColumn<T = Record<string, unknown>> {
  key: string;
  title: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  /** text 文本 / status 状态标签 / money 金额 / datetime 时间 / date 日期 / tag 标签 / boolean / percent */
  type?: 'text' | 'status' | 'money' | 'datetime' | 'date' | 'tag' | 'boolean' | 'percent';
  /** status/tag 的中文映射 */
  map?: Record<string, string>;
  /** 自定义取值 */
  pipe?: (row: T) => unknown;
  /** 自定义标签色（status 类型） */
  tone?: (row: T) => string;
  /** 是否可排序（前端排序） */
  sort?: boolean;
  /** 长文本省略 */
  ellipsis?: boolean;
}

export interface PageChange {
  pageNum: number;
  pageSize: number;
}

/** 统一数据表格：服务端分页 + 列定义 + 操作列插槽 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, NzTableModule, NzEmptyModule, StatusTagComponent],
  template: `
    <nz-table
      #table
      class="data-table"
      [nzData]="rows()"
      [nzLoading]="loading()"
      [nzFrontPagination]="false"
      [nzTotal]="total()"
      [nzPageIndex]="pageNum()"
      [nzPageSize]="pageSize()"
      [nzPageSizeOptions]="[10, 20, 50, 100]"
      [nzShowSizeChanger]="true"
      [nzShowQuickJumper]="total() > pageSize()"
      [nzShowTotal]="totalTpl"
      [nzScroll]="scroll()"
      (nzPageIndexChange)="emitPage($event)"
      (nzPageSizeChange)="emitSize($event)"
      [nzNoResult]="emptyTpl"
    >
      <thead>
        <tr>
          @for (col of columns(); track col.key) {
            <th [style.width]="col.width" [nzAlign]="col.align ?? null" [nzEllipsis]="!!col.ellipsis">{{ col.title }}</th>
          }
          @if (actionsTpl) {
            <th class="data-table__actions-head" nzRight>操作</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of table.data; track trackRow(row)) {
          <tr class="data-table__row" (click)="rowClick.emit(row)">
            @for (col of columns(); track col.key) {
              <td [nzAlign]="col.align ?? null" [nzEllipsis]="!!col.ellipsis">
                @switch (col.type) {
                  @case ('status') {
                    <app-status-tag [value]="text(col, row)" [map]="col.map ?? {}" [color]="col.tone ? col.tone(row) : null" />
                  }
                  @case ('tag') {
                    <span class="data-table__tag">{{ text(col, row) }}</span>
                  }
                  @case ('money') {
                    <span class="data-table__money">¥ {{ number(col, row) | number: '1.2-2' }}</span>
                  }
                  @case ('percent') {
                    <span>{{ number(col, row) | number: '1.1-2' }}%</span>
                  }
                  @case ('boolean') {
                    {{ raw(col, row) ? '是' : '否' }}
                  }
                  @default {
                    {{ text(col, row) }}
                  }
                }
              </td>
            }
            @if (actionsTpl) {
              <td nzRight class="data-table__actions" (click)="$event.stopPropagation()">
                <ng-container [ngTemplateOutlet]="actionsTpl" [ngTemplateOutletContext]="{ $implicit: row, row: row }" />
              </td>
            }
          </tr>
        }
      </tbody>
      <ng-template #emptyTpl>
        <nz-empty [nzNotFoundContent]="emptyText()" />
      </ng-template>
      <ng-template #totalTpl let-total let-range="range">
        第 {{ range[0] }}-{{ range[1] }} 条 / 共 {{ total }} 条
      </ng-template>
    </nz-table>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .data-table__row {
        cursor: default;
      }
      .data-table__actions-head {
        width: 132px;
      }
      .data-table__actions {
        white-space: nowrap;
      }
      .data-table__money {
        font-variant-numeric: tabular-nums;
        color: #d4380d;
      }
      .data-table__tag {
        background: #f0f5ff;
        border: 1px solid #adc6ff;
        color: #2f54eb;
        border-radius: 4px;
        padding: 0 6px;
        font-size: 12px;
      }
    `,
  ],
})
export class DataTableComponent<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly columns = input.required<DataColumn<T>[]>();
  readonly rows = input<T[]>([]);
  readonly total = input(0);
  readonly pageNum = input(1);
  readonly pageSize = input(20);
  readonly loading = input(false);
  readonly emptyText = input('暂无数据');
  readonly scrollX = input<string | null>(null);
  /** 行点击是否可交互（用于跳转详情） */
  readonly clickable = input(false);

  @Input() trackByKey = 'id';
  @Output() readonly pageChange = new EventEmitter<PageChange>();
  @Output() readonly rowClick = new EventEmitter<T>();

  @ContentChild('actions') actionsTpl?: TemplateRef<{ $implicit: T; row: T }>;

  readonly scroll = computed(() => (this.scrollX() ? { x: this.scrollX() as string } : {}));

  trackRow(row: T): unknown {
    return (row as Record<string, unknown>)[this.trackByKey] ?? row;
  }

  raw(col: DataColumn<T>, row: T): unknown {
    if (col.pipe) return col.pipe(row);
    return (row as Record<string, unknown>)[col.key];
  }

  text(col: DataColumn<T>, row: T): string {
    const value = this.raw(col, row);
    if (value === null || value === undefined || value === '') return '-';
    if (col.type === 'datetime') return formatDateTime(value);
    if (col.type === 'date') return formatDateTime(value, 'YYYY-MM-DD');
    const dict = col.map;
    if (dict) return dict[String(value)] ?? String(value);
    return String(value);
  }

  number(col: DataColumn<T>, row: T): number {
    const value = this.raw(col, row);
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  emitPage(pageNum: number): void {
    this.pageChange.emit({ pageNum, pageSize: this.pageSize() });
  }

  emitSize(pageSize: number): void {
    this.pageChange.emit({ pageNum: 1, pageSize });
  }
}

export function formatDateTime(value: unknown, format = 'YYYY-MM-DD HH:mm'): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  const map: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
  };
  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, (token) => map[token] ?? token);
}


