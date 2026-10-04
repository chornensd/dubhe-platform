import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { ApiService } from '../../core/api.service';
import { CreateKnowledgeDocRequest, KnowledgeDocDto, Paged, UpdateKnowledgeDocRequest } from '../../core/api-types';
import { ConfirmService } from '../../core/confirm.service';
import { PagedList } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent } from '../../shared/data-table';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';

type KnowledgeRow = KnowledgeDocDto & Record<string, unknown>;

/** 知识库：智能体知识文档的维护与发布 */
@Component({
  selector: 'app-knowledge',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzCheckboxModule,
    NzIconModule,
    NzInputModule,
    NzSwitchModule,
    PageHeaderComponent,
    DataTableComponent,
    SchemaFormComponent,
    ModalComponent,
  ],
  template: `
    <app-page-header title="知识库" subtitle="沉淀业务规范与产品文档，供智能体检索使用">
      @if (perm.can('agent.manage')) {
        <button nz-button nzType="primary" (click)="openCreate()">
          <span nz-icon nzType="plus"></span> 新增文档
        </button>
      }
      <button nz-button (click)="list.reload()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="card">
      <div class="filter-bar">
        <input
          nz-input
          style="width: 240px"
          placeholder="标题 / 标签 / 内容关键字"
          [ngModel]="keyword()"
          (ngModelChange)="keyword.set($event)"
          (keyup.enter)="search()"
        />
        <input
          nz-input
          style="width: 180px"
          placeholder="分类（精确匹配）"
          [ngModel]="category()"
          (ngModelChange)="category.set($event)"
          (keyup.enter)="search()"
        />
        <label nz-checkbox [ngModel]="publishedOnly()" (ngModelChange)="onPublishedOnly($event)">仅已发布</label>
        <button nz-button nzType="primary" (click)="search()"><span nz-icon nzType="search"></span> 查询</button>
        <button nz-button (click)="reset()">重置</button>
        <span class="filter-bar__spacer"></span>
        <span class="text-secondary">共 {{ list.total() }} 篇文档</span>
      </div>

      <app-data-table
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [pageNum]="list.pageNum"
        [pageSize]="list.pageSize"
        [loading]="list.loading()"
        emptyText="当前条件下暂无知识文档"
        scrollX="1200px"
        (pageChange)="list.page($event)"
      >
        <ng-template #actions let-row>
          <button nz-button nzType="link" nzSize="small" (click)="openView(row)">查看</button>
          @if (perm.can('agent.manage')) {
            <button nz-button nzType="link" nzSize="small" (click)="openEdit(row)">编辑</button>
            @if (!row.isPublished) {
              <button nz-button nzType="link" nzSize="small" (click)="publish(row)">发布</button>
            }
          }
        </ng-template>
      </app-data-table>
    </div>

    <app-modal
      [(open)]="formOpen"
      [title]="editing() ? '编辑知识文档' : '新增知识文档'"
      okText="保存"
      [loading]="saving()"
      [width]="720"
      (ok)="submitForm()"
    >
      <app-schema-form [fields]="formFields" [(model)]="model" />
    </app-modal>

    <app-modal [(open)]="viewOpen" [title]="viewDoc()?.title ?? '文档详情'" okText="关闭" [width]="760" (ok)="viewOpen.set(false)">
      @if (viewDoc(); as doc) {
        <div class="desc-grid">
          <div class="desc-item">
            <span class="desc-item__label">分类</span>
            <span class="desc-item__value">{{ doc.category }}</span>
          </div>
          <div class="desc-item">
            <span class="desc-item__label">版本</span>
            <span class="desc-item__value">{{ doc.version }}</span>
          </div>
          <div class="desc-item">
            <span class="desc-item__label">标签</span>
            <span class="desc-item__value">{{ doc.tags || '-' }}</span>
          </div>
          <div class="desc-item">
            <span class="desc-item__label">状态</span>
            <span class="desc-item__value">{{ doc.isPublished ? '已发布' : '草稿' }}</span>
          </div>
        </div>
        <div class="card__subtitle mt-16 mb-8">文档内容</div>
        <pre class="content-block">{{ doc.content }}</pre>
      }
    </app-modal>
  `,
  styles: [
    `
      .content-block {
        margin: 0;
        padding: 12px;
        background: #f7f9fc;
        border: 1px solid #eef1f6;
        border-radius: 6px;
        font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
        font-size: 12.5px;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 420px;
        overflow: auto;
      }
    `,
  ],
})
export class KnowledgePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  readonly perm = inject(PermissionService);

  readonly keyword = signal('');
  readonly category = signal('');
  readonly publishedOnly = signal(false);

  readonly formOpen = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<KnowledgeRow | null>(null);
  readonly viewOpen = signal(false);
  readonly viewDoc = signal<KnowledgeDocDto | null>(null);

  model: Record<string, unknown> = {};

  readonly formFields: FormField[] = [
    { key: 'title', label: '标题', type: 'text', required: true, span: 16, maxLength: 200 },
    { key: 'version', label: '版本', type: 'text', span: 8, placeholder: '如 v1' },
    { key: 'category', label: '分类', type: 'text', required: true, span: 12, placeholder: '如 产品手册 / 接口文档' },
    { key: 'tags', label: '标签', type: 'text', span: 12, placeholder: '多个标签用逗号分隔' },
    { key: 'isPublished', label: '立即发布', type: 'switch', span: 12, help: '发布后可供智能体检索' },
    { key: 'content', label: '文档内容', type: 'textarea', required: true, span: 24, rows: 10 },
  ];

  readonly list = new PagedList<KnowledgeRow>((query) =>
    this.api.get<Paged<KnowledgeRow>>('/agent/knowledge-docs', {
      ...query,
      keyword: this.keyword().trim() || undefined,
      category: this.category().trim() || undefined,
      publishedOnly: this.publishedOnly() ? true : undefined,
    }),
  );

  readonly columns: DataColumn<KnowledgeRow>[] = [
    { key: 'title', title: '标题', ellipsis: true },
    { key: 'category', title: '分类', width: '130px' },
    { key: 'tags', title: '标签', width: '160px', pipe: (row) => row.tags || '-' },
    { key: 'version', title: '版本', width: '80px' },
    {
      key: 'isPublished',
      title: '状态',
      width: '90px',
      type: 'status',
      pipe: (row) => (row.isPublished ? '已发布' : '草稿'),
    },
    { key: 'createdBy', title: '创建人', width: '110px', pipe: (row) => (row.createdBy ? row.createdBy.slice(0, 8) : '-') },
    { key: 'createdAt', title: '创建时间', width: '160px', type: 'datetime' },
    { key: 'updatedAt', title: '更新时间', width: '160px', type: 'datetime' },
  ];

  ngOnInit(): void {
    this.list.reload();
  }

  search(): void {
    this.list.filter({});
  }

  reset(): void {
    this.keyword.set('');
    this.category.set('');
    this.publishedOnly.set(false);
    this.list.filter({});
  }

  onPublishedOnly(value: boolean): void {
    this.publishedOnly.set(value);
    this.list.filter({});
  }

  openCreate(): void {
    this.editing.set(null);
    this.model = { title: '', category: '', tags: '', version: 'v1', isPublished: false, content: '' };
    this.formOpen.set(true);
  }

  openEdit(row: KnowledgeRow): void {
    this.editing.set(row);
    this.model = {
      title: row.title,
      category: row.category,
      tags: row.tags ?? '',
      version: row.version,
      isPublished: row.isPublished,
      content: row.content,
    };
    this.formOpen.set(true);
  }

  openView(row: KnowledgeRow): void {
    this.viewDoc.set(row);
    this.viewOpen.set(true);
  }

  submitForm(): void {
    const title = String(this.model['title'] ?? '').trim();
    const category = String(this.model['category'] ?? '').trim();
    const content = String(this.model['content'] ?? '');
    if (!title || !category || !content.trim()) {
      this.message.warning('请填写标题、分类与内容');
      return;
    }
    const body: CreateKnowledgeDocRequest = {
      title,
      category,
      tags: String(this.model['tags'] ?? '').trim(),
      content,
      version: String(this.model['version'] ?? '').trim() || null,
      isPublished: !!this.model['isPublished'],
    };

    this.saving.set(true);
    const current = this.editing();
    const request = current
      ? this.api.put<KnowledgeDocDto>(`/agent/knowledge-docs/${current.id}`, body as UpdateKnowledgeDocRequest)
      : this.api.post<KnowledgeDocDto>('/agent/knowledge-docs', body);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.message.success(current ? '文档已更新' : '文档已创建');
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  publish(row: KnowledgeRow): void {
    this.confirm
      .open({ title: '发布知识文档', content: `确认发布「${row.title}」？发布后智能体可检索到该文档。` })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.post<KnowledgeDocDto>(`/agent/knowledge-docs/${row.id}/publish`).subscribe(() => {
          this.message.success('文档已发布');
          this.list.reload();
        });
      });
  }
}
