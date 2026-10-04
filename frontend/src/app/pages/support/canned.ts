import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ApiService } from '../../core/api.service';
import { CannedResponseDto, CreateCannedResponseRequest } from '../../core/api-types';
import { PermissionService } from '../../core/permission.service';
import { formatDateTime } from '../../shared/data-table';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';

interface CannedRow extends CannedResponseDto {
  [key: string]: unknown;
}

/** M6 客服常用语：个人常用语库，按分类筛选与新增 */
@Component({
  selector: 'app-canned',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
    ModalComponent,
    PageHeaderComponent,
    SchemaFormComponent,
  ],
  template: `
    <app-page-header title="客服常用语" subtitle="维护个人常用回复语，工单会话中可一键填充">
      @if (perm.can('support.ticket.manage')) {
        <button nz-button nzType="primary" (click)="openCreate()">
          <span nz-icon nzType="plus"></span> 新增常用语
        </button>
      }
      <button nz-button (click)="load()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="card">
      <div class="filter-bar">
        <nz-select
          style="width: 180px"
          nzPlaceHolder="全部分类"
          nzAllowClear
          [ngModel]="category()"
          (ngModelChange)="category.set($event)"
        >
          @for (item of categories(); track item) {
            <nz-option [nzValue]="item" [nzLabel]="item" />
          }
        </nz-select>
        <input
          nz-input
          style="width: 240px"
          placeholder="搜索常用语内容"
          [ngModel]="keyword()"
          (ngModelChange)="keyword.set($event)"
        />
        <button nz-button (click)="reset()">重置</button>
        <span class="filter-bar__spacer"></span>
        <span class="text-secondary">共 {{ filtered().length }} 条</span>
      </div>

      <nz-spin [nzSpinning]="loading()" nzTip="加载常用语">
        @if (filtered().length) {
          <div class="canned-list">
            @for (item of filtered(); track item.id) {
              <div class="canned-item">
                <div class="canned-item__content">{{ item.content }}</div>
                <div class="canned-item__meta">
                  <nz-tag>{{ item.category || '未分类' }}</nz-tag>
                  <span class="text-secondary">{{ time(item.createdAt) }}</span>
                </div>
              </div>
            }
          </div>
        } @else if (!loading()) {
          <nz-empty nzNotFoundContent="暂无常用语，点击右上角新增" />
        }
      </nz-spin>
    </div>

    <app-modal
      [(open)]="createOpen"
      title="新增常用语"
      okText="保存"
      [loading]="saving()"
      [width]="620"
      (ok)="submit()"
    >
      <app-schema-form [fields]="createFields" [(model)]="createModel" />
    </app-modal>
  `,
  styles: [
    `
      .canned-list {
        display: flex;
        flex-direction: column;
      }
      .canned-item {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 4px;
        border-bottom: 1px solid #f2f4f8;
      }
      .canned-item:last-child {
        border-bottom: none;
      }
      .canned-item__content {
        font-size: 13px;
        line-height: 1.7;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .canned-item__meta {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 0 0 auto;
        font-size: 12px;
      }
    `,
  ],
})
export class CannedResponsePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  readonly perm = inject(PermissionService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly createOpen = signal(false);
  readonly category = signal<string | null>(null);
  readonly keyword = signal('');
  readonly items = signal<CannedRow[]>([]);

  createModel: Record<string, unknown> = {};

  readonly categories = computed(() => {
    const set = new Set<string>();
    for (const item of this.items()) {
      if (item.category) set.add(item.category);
    }
    return Array.from(set);
  });

  readonly filtered = computed(() => {
    const category = this.category();
    const keyword = this.keyword().trim();
    return this.items().filter((item) => {
      if (category && item.category !== category) return false;
      if (keyword && !item.content.includes(keyword)) return false;
      return true;
    });
  });

  readonly createFields: FormField[] = [
    { key: 'content', label: '常用语内容', type: 'textarea', required: true, span: 24, rows: 4, maxLength: 500, placeholder: '如：您好，您的工单已受理，我们会尽快处理。' },
    { key: 'category', label: '分类', type: 'text', span: 12, maxLength: 30, placeholder: '如：受理通知 / 结果反馈' },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.get<CannedRow[]>('/support/tickets/canned-responses').subscribe({
      next: (items) => {
        this.items.set(items ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.loading.set(false);
      },
    });
  }

  reset(): void {
    this.category.set(null);
    this.keyword.set('');
  }

  time(value: unknown): string {
    return formatDateTime(value);
  }

  openCreate(): void {
    if (!this.perm.can('support.ticket.manage')) return;
    this.createModel = { content: '', category: '' };
    this.createOpen.set(true);
  }

  submit(): void {
    const content = String(this.createModel['content'] ?? '').trim();
    if (!content) {
      this.message.warning('请填写常用语内容');
      return;
    }
    const body: CreateCannedResponseRequest = {
      content,
      category: String(this.createModel['category'] ?? '').trim() || null,
    };
    this.saving.set(true);
    this.api.post<CannedResponseDto>('/support/tickets/canned-responses', body).subscribe({
      next: () => {
        this.saving.set(false);
        this.createOpen.set(false);
        this.message.success('常用语已保存');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
