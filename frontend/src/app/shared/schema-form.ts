import { CommonModule } from '@angular/common';
import { Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { SearchSelectComponent, SelectOption } from './search-select';
import { WaypointEditorComponent, Waypoint } from './waypoint-editor';

export interface FormField {
  key: string;
  label: string;
  type:
    | 'text'
    | 'password'
    | 'number'
    | 'select'
    | 'multiselect'
    | 'textarea'
    | 'switch'
    | 'datetime'
    | 'date'
    | 'waypoints'
    | 'search-select'
    | 'static';
  required?: boolean;
  options?: SelectOption[];
  default?: unknown;
  span?: number;
  placeholder?: string;
  help?: string;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  disabled?: boolean;
  /** 动态显示（依赖当前模型其他字段） */
  showWhen?: (model: Record<string, unknown>) => boolean;
  /** search-select 的回调 */
  search?: (keyword: string) => void;
  loading?: boolean;
  rows?: number;
}

type Model = Record<string, unknown>;

/** 稳定的空数组引用：避免每轮变更检测返回新数组导致 ngModel 无限写入 */
const EMPTY_WAYPOINTS: Waypoint[] = [];

/** Schema 驱动表单：字段定义 + 模型双向绑定；弹窗内自动校验必填项 */
@Component({
  selector: 'app-schema-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzFormModule,
    NzGridModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSwitchModule,
    NzDatePickerModule,
    NzIconModule,
    NzButtonModule,
    WaypointEditorComponent,
    SearchSelectComponent,
  ],
  template: `
    <div class="schema-form">
      <div nz-row [nzGutter]="16">
        @for (field of visibleFields(); track field.key) {
          <div nz-col [nzSpan]="field.span ?? 12" [nzXs]="24" [nzSm]="field.span && field.span <= 12 ? 24 : 12">
            <nz-form-item [class.schema-form__block]="field.type === 'textarea' || field.type === 'waypoints'">
              <nz-form-label [nzRequired]="!!field.required" [nzSpan]="field.type === 'textarea' || field.type === 'waypoints' ? 24 : 8">
                {{ field.label }}
              </nz-form-label>
              <nz-form-control [nzSpan]="field.type === 'textarea' || field.type === 'waypoints' ? 24 : 16" [nzErrorTip]="errorOf(field)">
                @switch (field.type) {
                  @case ('textarea') {
                    <textarea
                      nz-input
                      [rows]="field.rows ?? 3"
                      [placeholder]="field.placeholder ?? ''"
                      [maxlength]="field.maxLength ?? null"
                      [disabled]="!!field.disabled"
                      [ngModel]="get(field)"
                      (ngModelChange)="set(field, $event)"
                      [ngModelOptions]="{ standalone: true }"
                    ></textarea>
                  }
                  @case ('number') {
                    <nz-input-number
                      style="width: 100%"
                      [nzPlaceHolder]="field.placeholder ?? ''"
                      [nzMin]="field.min ?? -999999999"
                      [nzMax]="field.max ?? 999999999"
                      [nzStep]="field.step ?? 1"
                      [nzDisabled]="!!field.disabled"
                      [ngModel]="get(field)"
                      (ngModelChange)="set(field, $event)"
                      [ngModelOptions]="{ standalone: true }"
                    ></nz-input-number>
                  }
                  @case ('select') {
                    <nz-select
                      style="width: 100%"
                      [nzPlaceHolder]="field.placeholder ?? '请选择'"
                      [nzOptions]="field.options ?? []"
                      [nzDisabled]="!!field.disabled"
                      nzShowSearch
                      nzAllowClear
                      [ngModel]="get(field)"
                      (ngModelChange)="set(field, $event)"
                      [ngModelOptions]="{ standalone: true }"
                    ></nz-select>
                  }
                  @case ('multiselect') {
                    <nz-select
                      style="width: 100%"
                      nzMode="multiple"
                      [nzPlaceHolder]="field.placeholder ?? '请选择'"
                      [nzOptions]="field.options ?? []"
                      [nzDisabled]="!!field.disabled"
                      nzShowSearch
                      nzAllowClear
                      [ngModel]="get(field) ?? []"
                      (ngModelChange)="set(field, $event)"
                      [ngModelOptions]="{ standalone: true }"
                    ></nz-select>
                  }
                  @case ('switch') {
                    <nz-switch
                      [ngModel]="!!get(field)"
                      (ngModelChange)="set(field, $event)"
                      [ngModelOptions]="{ standalone: true }"
                    ></nz-switch>
                  }
                  @case ('datetime') {
                    <nz-date-picker
                      style="width: 100%"
                      nzShowTime
                      nzFormat="yyyy-MM-dd HH:mm"
                      [nzPlaceHolder]="field.placeholder ?? '选择时间'"
                      [ngModel]="toDate(get(field))"
                      (ngModelChange)="set(field, toIso($event, false))"
                      [ngModelOptions]="{ standalone: true }"
                    ></nz-date-picker>
                  }
                  @case ('date') {
                    <nz-date-picker
                      style="width: 100%"
                      nzFormat="yyyy-MM-dd"
                      [nzPlaceHolder]="field.placeholder ?? '选择日期'"
                      [ngModel]="toDate(get(field))"
                      (ngModelChange)="set(field, toIso($event, true))"
                      [ngModelOptions]="{ standalone: true }"
                    ></nz-date-picker>
                  }
                  @case ('waypoints') {
                    <app-waypoint-editor [ngModel]="asWaypoints(get(field))" (ngModelChange)="set(field, $event)" />
                  }
                  @case ('search-select') {
                    <app-search-select
                      [options]="field.options ?? []"
                      [loading]="!!field.loading"
                      [placeholder]="field.placeholder ?? '搜索选择'"
                      [ngModel]="get(field)"
                      (ngModelChange)="set(field, $event)"
                      (search)="field.search ? field.search($event) : null"
                    />
                  }
                  @case ('static') {
                    <div class="schema-form__static">{{ get(field) ?? '-' }}</div>
                  }
                  @default {
                    <input
                      nz-input
                      [type]="field.type === 'password' ? 'password' : 'text'"
                      [placeholder]="field.placeholder ?? ''"
                      [maxlength]="field.maxLength ?? null"
                      [disabled]="!!field.disabled"
                      [ngModel]="get(field)"
                      (ngModelChange)="set(field, $event)"
                      [ngModelOptions]="{ standalone: true }"
                    />
                  }
                }
                @if (field.help) {
                  <div class="schema-form__help">{{ field.help }}</div>
                }
              </nz-form-control>
            </nz-form-item>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .schema-form__help {
        font-size: 12px;
        color: #98a2b3;
        margin-top: 2px;
      }
      .schema-form__static {
        min-height: 22px;
        color: #1f2637;
      }
      :host ::ng-deep .schema-form__block nz-form-label {
        text-align: left;
      }
      :host ::ng-deep nz-form-item {
        margin-bottom: 14px;
      }
      :host ::ng-deep nz-form-label label {
        font-size: 13px;
        color: #4a5568;
      }
    `,
  ],
})
export class SchemaFormComponent {
  readonly fields = input.required<FormField[]>();
  readonly model = model.required<Model>();
  private touched = false;

  readonly visibleFields = computed(() => {
    const model = this.model();
    return this.fields().filter((f) => (f.showWhen ? f.showWhen(model) : true));
  });

  get(field: FormField): unknown {
    if (field.key.includes('.')) {
      return field.key.split('.').reduce<unknown>((acc, key) => (acc as Model | null)?.[key], this.model());
    }
    return this.model()[field.key];
  }

  set(field: FormField, value: unknown): void {
    const next: Model = { ...this.model() };
    if (field.key.includes('.')) {
      const keys = field.key.split('.');
      let cursor: Model = next;
      keys.slice(0, -1).forEach((key) => {
        cursor[key] = { ...((cursor[key] as Model) ?? {}) };
        cursor = cursor[key] as Model;
      });
      cursor[keys[keys.length - 1]] = value;
    } else {
      next[field.key] = value;
    }
    this.model.set(next);
  }

  errorOf(field: FormField): string {
    if (!field.required || !this.touched) return '';
    const value = this.get(field);
    if (value === null || value === undefined || value === '') return `${field.label}不能为空`;
    if (field.type === 'number' && Number.isNaN(Number(value))) return `${field.label}必须为数字`;
    return '';
  }

  /** 校验必填与数字范围；返回 false 时弹窗不提交 */
  validate(): boolean {
    this.touched = true;
    for (const field of this.visibleFields()) {
      if (field.type === 'static') continue;
      const value = this.get(field);
      if (field.required && (value === null || value === undefined || value === '')) return false;
      if (field.type === 'number' && value !== null && value !== undefined && value !== '') {
        const num = Number(value);
        if (Number.isNaN(num)) return false;
        if (field.min !== undefined && num < field.min) return false;
        if (field.max !== undefined && num > field.max) return false;
      }
      if (field.maxLength && typeof value === 'string' && value.length > field.maxLength) return false;
    }
    return true;
  }

  /** Date 实例缓存：同一字符串返回同一实例，避免每轮变更检测产生新对象导致 ngModel 无限写入 */
  private readonly dateCache = new Map<string, Date>();

  toDate(value: unknown): Date | null {
    if (!value) return null;
    const key = String(value);
    const cached = this.dateCache.get(key);
    if (cached) return cached;
    const date = new Date(key);
    if (Number.isNaN(date.getTime())) return null;
    if (this.dateCache.size > 500) this.dateCache.clear();
    this.dateCache.set(key, date);
    return date;
  }

  toIso(value: Date | null, dateOnly: boolean): string | null {
    if (!value) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    const ymd = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    if (dateOnly) return ymd;
    return `${ymd}T${pad(value.getHours())}:${pad(value.getMinutes())}:00`;
  }

  asWaypoints(value: unknown): Waypoint[] {
    return Array.isArray(value) ? (value as Waypoint[]) : EMPTY_WAYPOINTS;
  }
}
