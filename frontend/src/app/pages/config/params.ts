import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { ApiService } from '../../core/api.service';
import { SystemConfigDto } from '../../core/api-types';
import { ConfirmService } from '../../core/confirm.service';
import { PermissionService } from '../../core/permission.service';
import { PageHeaderComponent } from '../../shared/page-header';

type ConfigValue = string | number | boolean;

interface ReminderRunResult {
  qualificationReminders: number;
  maintenanceReminders: number;
}

/** 参数配置：按业务分组维护平台运行参数 */
@Component({
  selector: 'app-params',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzSpinModule,
    NzSwitchModule,
    NzTabsModule,
    PageHeaderComponent,
  ],
  template: `
    <app-page-header title="参数配置" subtitle="按业务分组维护平台运行参数，调整后点击「保存修改」统一生效">
      <button nz-button (click)="load()"><span nz-icon nzType="reload"></span> 刷新</button>
      @if (perm.can('config.param.manage')) {
        <button nz-button [nzLoading]="reminderRunning()" (click)="runReminders()">
          <span nz-icon nzType="clock-circle"></span> 手动触发到期提醒扫描
        </button>
        <button nz-button nzType="primary" [disabled]="dirtyCount() === 0" [nzLoading]="saving()" (click)="save()">
          <span nz-icon nzType="save"></span> 保存修改
          @if (dirtyCount() > 0) {
            （{{ dirtyCount() }} 项）
          }
        </button>
      }
    </app-page-header>

    <div class="card">
      <div class="card__title">
        平台参数
        <span class="card__subtitle">参数类型：数字 / 布尔 / 文本；共 {{ items().length }} 项</span>
      </div>

      @if (loading()) {
        <div class="page-loading"><nz-spin nzTip="参数加载中" /></div>
      } @else if (!items().length) {
        <nz-empty nzNotFoundContent="暂无可配置参数，请确认后端是否完成初始化" />
      } @else {
        <nz-tabs [(nzSelectedIndex)]="activeIndex">
          @for (group of groups(); track group) {
            <nz-tab [nzTitle]="group">
              <div class="param-list">
                @for (item of itemsOf(group); track item.key) {
                  <div class="param-row">
                    <div class="param-row__main">
                      <div class="param-row__name">
                        {{ item.name }}
                        @if (isDirty(item.key)) {
                          <span class="param-row__dirty">已修改</span>
                        }
                      </div>
                      <div class="param-row__meta mono">{{ item.key }} · {{ typeText(item.valueType) }}</div>
                      @if (item.description) {
                        <div class="param-row__desc">{{ item.description }}</div>
                      }
                    </div>
                    <div class="param-row__editor">
                      @switch (item.valueType) {
                        @case ('number') {
                          <nz-input-number
                            style="width: 200px"
                            [nzDisabled]="!perm.can('config.param.manage')"
                            [ngModel]="numValue(item.key)"
                            (ngModelChange)="setValue(item.key, $event)"
                          />
                        }
                        @case ('bool') {
                          <nz-switch
                            [nzDisabled]="!perm.can('config.param.manage')"
                            [ngModel]="boolValue(item.key)"
                            (ngModelChange)="setValue(item.key, $event)"
                          />
                        }
                        @case ('boolean') {
                          <nz-switch
                            [nzDisabled]="!perm.can('config.param.manage')"
                            [ngModel]="boolValue(item.key)"
                            (ngModelChange)="setValue(item.key, $event)"
                          />
                        }
                        @default {
                          <input
                            nz-input
                            style="width: 280px"
                            [disabled]="!perm.can('config.param.manage')"
                            [ngModel]="strValue(item.key)"
                            (ngModelChange)="setValue(item.key, $event)"
                          />
                        }
                      }
                    </div>
                    <div class="param-row__time">更新于 {{ item.updatedAt | date: 'yyyy-MM-dd HH:mm' }}</div>
                  </div>
                } @empty {
                  <nz-empty nzNotFoundContent="该分组暂无参数" />
                }
              </div>
            </nz-tab>
          }
        </nz-tabs>
      }
    </div>
  `,
  styles: [
    `
      .param-list {
        display: flex;
        flex-direction: column;
      }
      .param-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 300px 180px;
        align-items: center;
        gap: 12px;
        padding: 12px 4px;
        border-bottom: 1px solid #eef1f6;
      }
      .param-row:last-child {
        border-bottom: none;
      }
      .param-row__name {
        font-size: 14px;
        color: #1f2637;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .param-row__dirty {
        font-size: 12px;
        color: #d46b08;
        background: #fff7e6;
        border: 1px solid #ffd591;
        border-radius: 4px;
        padding: 0 6px;
      }
      .param-row__meta {
        margin-top: 2px;
        color: #8c96a8;
      }
      .param-row__desc {
        margin-top: 2px;
        font-size: 12px;
        color: #6b7688;
      }
      .param-row__time {
        font-size: 12px;
        color: #8c96a8;
        text-align: right;
      }
      @media (max-width: 1100px) {
        .param-row {
          grid-template-columns: 1fr;
        }
        .param-row__time {
          text-align: left;
        }
      }
    `,
  ],
})
export class ConfigParamPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  readonly perm = inject(PermissionService);

  readonly items = signal<SystemConfigDto[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly reminderRunning = signal(false);

  activeIndex = 0;

  private readonly values = signal<Record<string, ConfigValue>>({});
  private readonly original = signal<Record<string, string>>({});

  readonly groups = computed(() => {
    const seen: string[] = [];
    for (const item of this.items()) {
      if (item.group && !seen.includes(item.group)) seen.push(item.group);
    }
    return seen;
  });

  readonly dirtyKeys = computed(() => {
    const values = this.values();
    const original = this.original();
    return Object.keys(values).filter((key) => this.normalize(values[key]) !== (original[key] ?? ''));
  });

  readonly dirtyCount = computed(() => this.dirtyKeys().length);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.get<SystemConfigDto[]>('/admin/config/params').subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.apply(rows ?? []);
      },
      error: () => {
        this.loading.set(false);
        this.items.set([]);
      },
    });
  }

  itemsOf(group: string): SystemConfigDto[] {
    return this.items().filter((item) => item.group === group);
  }

  typeText(valueType: string): string {
    if (valueType === 'number') return '数字';
    if (valueType === 'bool' || valueType === 'boolean') return '布尔';
    return '文本';
  }

  numValue(key: string): number {
    const value = this.values()[key];
    return typeof value === 'number' ? value : Number(value) || 0;
  }

  boolValue(key: string): boolean {
    return !!this.values()[key];
  }

  strValue(key: string): string {
    const value = this.values()[key];
    return value === null || value === undefined ? '' : String(value);
  }

  isDirty(key: string): boolean {
    return this.dirtyKeys().includes(key);
  }

  setValue(key: string, value: ConfigValue): void {
    this.values.update((current) => ({ ...current, [key]: value }));
  }

  save(): void {
    const keys = this.dirtyKeys();
    if (!keys.length) return;
    this.confirm
      .open({
        title: '保存参数修改',
        content: `确认提交 ${keys.length} 项参数修改？修改后立即对平台业务生效。`,
      })
      .subscribe((ok) => {
        if (!ok) return;
        this.saving.set(true);
        this.api
          .put<SystemConfigDto[]>('/admin/config/params', {
            items: keys.map((key) => ({ key, value: this.normalize(this.values()[key]) })),
          })
          .subscribe({
            next: (rows) => {
              this.saving.set(false);
              this.message.success(`已保存 ${keys.length} 项参数`);
              this.apply(rows ?? this.items());
            },
            error: () => this.saving.set(false),
          });
      });
  }

  runReminders(): void {
    this.reminderRunning.set(true);
    this.api.post<ReminderRunResult>('/admin/system/reminders/run').subscribe({
      next: (result) => {
        this.reminderRunning.set(false);
        const qualification = result?.qualificationReminders ?? 0;
        const maintenance = result?.maintenanceReminders ?? 0;
        this.message.success(`扫描完成：生成资质到期提醒 ${qualification} 条、维保到期提醒 ${maintenance} 条`);
      },
      error: () => this.reminderRunning.set(false),
    });
  }

  private apply(rows: SystemConfigDto[]): void {
    this.items.set(rows);
    const values: Record<string, ConfigValue> = {};
    const original: Record<string, string> = {};
    for (const row of rows) {
      original[row.key] = row.value ?? '';
      values[row.key] = this.initialValue(row);
    }
    this.values.set(values);
    this.original.set(original);
    if (this.activeIndex >= this.groups().length) {
      this.activeIndex = 0;
    }
  }

  private initialValue(row: SystemConfigDto): ConfigValue {
    if (row.valueType === 'number') {
      const num = Number(row.value);
      return Number.isFinite(num) ? num : row.value ?? '';
    }
    if (row.valueType === 'bool' || row.valueType === 'boolean') {
      return String(row.value).toLowerCase() === 'true';
    }
    return row.value ?? '';
  }

  private normalize(value: ConfigValue | undefined): string {
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }
}
