import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ApiService } from '../../core/api.service';
import {
  CreateHelpArticleRequest,
  HelpArticleDto,
  HelpContentType,
  HelpContentTypeNameText,
  Paged,
} from '../../core/api-types';
import { ConfirmService } from '../../core/confirm.service';
import { PagedList } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent, formatDateTime } from '../../shared/data-table';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';

type HelpRow = HelpArticleDto & Record<string, unknown>;

/** M6 帮助中心：匿名浏览（图文/视频、分类检索）与文章管理（新增/编辑/发布） */
@Component({
  selector: 'app-help',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzPaginationModule,
    NzSelectModule,
    NzSpinModule,
    NzTabsModule,
    NzTagModule,
    DataTableComponent,
    ModalComponent,
    PageHeaderComponent,
    SchemaFormComponent,
  ],
  template: `
    <app-page-header title="帮助中心" subtitle="平台使用指引、飞行安全须知与常见问题解答">
      <button nz-button (click)="list.reload()"><span nz-icon nzType="reload"></span> 刷新</button>
      @if (perm.can('support.help.manage')) {
        <button nz-button nzType="primary" (click)="openCreate()"><span nz-icon nzType="plus"></span> 新增文章</button>
      }
    </app-page-header>

    <nz-tabs [nzSelectedIndex]="tab()" (nzSelectedIndexChange)="tab.set($event)">
      <nz-tab nzTitle="浏览">
        <div class="card">
          <div class="filter-bar">
            <nz-select
              style="width: 180px"
              nzPlaceHolder="全部分类"
              nzAllowClear
              [ngModel]="category()"
              (ngModelChange)="onCategory($event)"
            >
              @for (item of categories(); track item) {
                <nz-option [nzValue]="item" [nzLabel]="item" />
              }
            </nz-select>
            <nz-select
              style="width: 140px"
              nzPlaceHolder="全部类型"
              nzAllowClear
              [ngModel]="contentType()"
              (ngModelChange)="onContentType($event)"
            >
              <nz-option [nzValue]="1" nzLabel="图文" />
              <nz-option [nzValue]="2" nzLabel="视频" />
            </nz-select>
            <input
              nz-input
              style="width: 260px"
              placeholder="搜索标题 / 标签 / 内容"
              [ngModel]="keyword()"
              (ngModelChange)="keyword.set($event)"
              (keyup.enter)="search()"
            />
            <button nz-button nzType="primary" (click)="search()"><span nz-icon nzType="search"></span> 搜索</button>
            <button nz-button (click)="reset()">重置</button>
            <span class="filter-bar__spacer"></span>
            <span class="text-secondary">共 {{ list.total() }} 篇</span>
          </div>

          @if (list.loading()) {
            <div class="page-loading"><nz-spin nzTip="加载帮助文档" /></div>
          } @else if (!list.rows().length) {
            <nz-empty nzNotFoundContent="没有匹配的帮助文档" />
          } @else {
            <div class="grid grid--3">
              @for (article of list.rows(); track article.id) {
                <div class="help-card" (click)="openDetail(article)">
                  <div class="help-card__title">{{ article.title }}</div>
                  <div class="help-card__tags">
                    <nz-tag>{{ article.category }}</nz-tag>
                    <nz-tag [nzColor]="article.contentType === 'Video' ? 'blue' : 'default'">
                      {{ typeText(article.contentType) }}
                    </nz-tag>
                  </div>
                  <div class="help-card__tags text-secondary">{{ article.tags || '无标签' }}</div>
                  <div class="help-card__foot">
                    <span class="text-secondary">浏览 {{ article.viewCount }} 次</span>
                    <span class="text-secondary">{{ time(article.updatedAt) }}</span>
                  </div>
                </div>
              }
            </div>
            @if (list.total() > list.pageSize) {
              <div class="help-pager">
                <nz-pagination
                  [nzPageIndex]="list.pageNum"
                  [nzPageSize]="list.pageSize"
                  [nzTotal]="list.total()"
                  [nzPageSizeOptions]="[20, 40, 60]"
                  [nzShowSizeChanger]="true"
                  (nzPageIndexChange)="page($event)"
                  (nzPageSizeChange)="size($event)"
                />
              </div>
            }
          }
        </div>
      </nz-tab>

      @if (perm.can('support.help.manage')) {
        <nz-tab nzTitle="管理">
          <div class="card">
            <div class="filter-bar">
              <nz-select
                style="width: 180px"
                nzPlaceHolder="全部分类"
                nzAllowClear
                [ngModel]="category()"
                (ngModelChange)="onCategory($event)"
              >
                @for (item of categories(); track item) {
                  <nz-option [nzValue]="item" [nzLabel]="item" />
                }
              </nz-select>
              <input
                nz-input
                style="width: 260px"
                placeholder="搜索标题 / 标签 / 内容"
                [ngModel]="keyword()"
                (ngModelChange)="keyword.set($event)"
                (keyup.enter)="search()"
              />
              <button nz-button nzType="primary" (click)="search()"><span nz-icon nzType="search"></span> 查询</button>
              <button nz-button (click)="reset()">重置</button>
              <span class="filter-bar__spacer"></span>
              <span class="text-secondary">共 {{ list.total() }} 篇（仅列出已发布文章）</span>
            </div>

            <app-data-table
              [columns]="columns"
              [rows]="list.rows()"
              [total]="list.total()"
              [pageNum]="list.pageNum"
              [pageSize]="list.pageSize"
              [loading]="list.loading()"
              emptyText="暂无已发布文章，可点击右上角新增"
              scrollX="1040px"
              (pageChange)="list.page($event)"
            >
              <ng-template #actions let-row>
                <button nz-button nzType="link" nzSize="small" (click)="openEdit(row)">编辑</button>
                @if (!row.isPublished) {
                  <button nz-button nzType="link" nzSize="small" (click)="publish(row)">发布</button>
                }
                <button nz-button nzType="link" nzSize="small" (click)="openDetail(row)">预览</button>
              </ng-template>
            </app-data-table>
          </div>
        </nz-tab>
      }
    </nz-tabs>

    <app-modal
      [(open)]="detailOpen"
      title="文章详情"
      okText="关闭"
      [width]="760"
      (ok)="detailOpen.set(false)"
    >
      @if (detailLoading()) {
        <div class="page-loading"><nz-spin nzTip="加载文章内容" /></div>
      } @else {
        @if (detail(); as article) {
          <div class="help-detail__meta">
            <nz-tag>{{ article.category }}</nz-tag>
            <nz-tag [nzColor]="article.contentType === 'Video' ? 'blue' : 'default'">{{ typeText(article.contentType) }}</nz-tag>
            <span class="text-secondary">浏览 {{ article.viewCount }} 次 · 更新 {{ time(article.updatedAt) }}</span>
          </div>
          @if (article.tags) {
            <div class="text-secondary help-detail__tags">标签：{{ article.tags }}</div>
          }
          @if (article.videoUrl) {
            <div class="mb-8">
              <a [href]="article.videoUrl" target="_blank" rel="noopener">观看视频：{{ article.videoUrl }}</a>
            </div>
          }
          <div class="help-detail__content" [innerHTML]="article.content"></div>
        } @else {
          <nz-empty nzNotFoundContent="文章不存在或未发布" />
        }
      }
    </app-modal>

    <app-modal
      [(open)]="editOpen"
      [title]="editingId() ? '编辑文章' : '新增文章'"
      okText="保存"
      [loading]="saving()"
      [width]="760"
      (ok)="submitArticle()"
    >
      <app-schema-form [fields]="articleFields" [(model)]="articleModel" />
    </app-modal>
  `,
  styles: [
    `
      .help-card {
        border: 1px solid #eef1f6; border-radius: 8px; padding: 14px 16px;
        cursor: pointer; display: flex; flex-direction: column; gap: 8px; min-height: 130px;
      }
      .help-card:hover { border-color: #91caff; box-shadow: 0 2px 10px rgba(22, 119, 255, 0.12); }
      .help-card__title {
        font-size: 14px; font-weight: 600; color: #1f2637;
        display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      }
      .help-card__tags { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; }
      .help-card__foot { margin-top: auto; display: flex; justify-content: space-between; font-size: 12px; }
      .help-pager { margin-top: 16px; display: flex; justify-content: flex-end; }
      .help-detail__meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
      .help-detail__tags { font-size: 12px; margin-bottom: 10px; }
      .help-detail__content { font-size: 13px; line-height: 1.9; white-space: pre-wrap; word-break: break-word; }
    `,
  ],
})
export class HelpCenterPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  readonly perm = inject(PermissionService);

  readonly tab = signal(0);
  readonly keyword = signal('');
  readonly category = signal<string | null>(null);
  readonly contentType = signal<number | null>(null);
  readonly saving = signal(false);
  readonly editOpen = signal(false);
  readonly detailOpen = signal(false);
  readonly detailLoading = signal(false);
  readonly detail = signal<HelpArticleDto | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly categories = signal<string[]>([]);

  articleModel: Record<string, unknown> = {};

  readonly list = new PagedList<HelpRow>((query) =>
    this.api.get<Paged<HelpRow>>('/help/articles', {
      ...query,
      keyword: this.keyword() || undefined,
      category: this.category() ?? undefined,
      contentType: this.contentType() ?? undefined,
    }),
  );

  readonly columns: DataColumn<HelpRow>[] = [
    { key: 'title', title: '标题', ellipsis: true },
    { key: 'category', title: '分类', width: '140px' },
    { key: 'tags', title: '标签', width: '180px', pipe: (row) => row.tags || '-' },
    { key: 'contentType', title: '类型', width: '90px', type: 'status', map: HelpContentTypeNameText },
    { key: 'isPublished', title: '已发布', width: '90px', type: 'boolean' },
    { key: 'viewCount', title: '浏览数', width: '90px', align: 'right' },
    { key: 'updatedAt', title: '更新时间', width: '150px', type: 'datetime' },
  ];

  readonly articleFields: FormField[] = [
    { key: 'title', label: '文章标题', type: 'text', required: true, span: 24, maxLength: 100 },
    { key: 'category', label: '分类', type: 'text', required: true, span: 12, maxLength: 30, placeholder: '如：下单指引 / 飞行安全' },
    { key: 'tags', label: '标签', type: 'text', span: 12, maxLength: 100, placeholder: '多个标签用逗号分隔' },
    {
      key: 'contentType',
      label: '内容类型',
      type: 'select',
      required: true,
      span: 12,
      options: [
        { value: HelpContentType.Article, label: '图文' },
        { value: HelpContentType.Video, label: '视频' },
      ],
    },
    {
      key: 'videoUrl',
      label: '视频地址',
      type: 'text',
      span: 12,
      required: true,
      showWhen: (model) => Number(model['contentType']) === HelpContentType.Video,
      placeholder: '视频链接（视频教程必填）',
    },
    { key: 'content', label: '正文内容', type: 'textarea', required: true, span: 24, rows: 8, maxLength: 5000, help: '支持纯文本或富文本 HTML 内容' },
    { key: 'isPublished', label: '立即发布', type: 'switch', span: 12 },
  ];

  ngOnInit(): void {
    this.list.reload();
    this.loadCategories();
  }

  search(): void {
    this.list.filter({});
  }

  reset(): void {
    this.keyword.set('');
    this.category.set(null);
    this.contentType.set(null);
    this.list.filter({});
  }

  onCategory(value: string | null): void {
    this.category.set(value);
    this.list.filter({});
  }

  onContentType(value: number | null): void {
    this.contentType.set(value);
    this.list.filter({});
  }

  page(index: number): void {
    this.list.page({ pageNum: index, pageSize: this.list.pageSize });
  }

  size(pageSize: number): void {
    this.list.page({ pageNum: 1, pageSize });
  }

  time(value: unknown): string {
    return formatDateTime(value);
  }

  typeText(contentType: string): string {
    return HelpContentTypeNameText[contentType] ?? contentType;
  }

  openDetail(row: HelpRow): void {
    this.detail.set(null);
    this.detailOpen.set(true);
    this.detailLoading.set(true);
    this.api.get<HelpArticleDto>(`/help/articles/${row.id}`).subscribe({
      next: (article) => {
        this.detail.set(article);
        this.detailLoading.set(false);
      },
      error: () => {
        this.detail.set(null);
        this.detailLoading.set(false);
      },
    });
  }

  openCreate(): void {
    if (!this.perm.can('support.help.manage')) return;
    this.editingId.set(null);
    this.articleModel = {
      title: '',
      category: this.category() ?? '',
      tags: '',
      contentType: HelpContentType.Article,
      videoUrl: '',
      content: '',
      isPublished: true,
    };
    this.editOpen.set(true);
  }

  openEdit(row: HelpRow): void {
    if (!this.perm.can('support.help.manage')) return;
    this.editingId.set(row.id);
    this.articleModel = {
      title: row.title,
      category: row.category,
      tags: row.tags ?? '',
      contentType: row.contentType === 'Video' ? HelpContentType.Video : HelpContentType.Article,
      videoUrl: row.videoUrl ?? '',
      content: row.content,
      isPublished: row.isPublished,
    };
    this.editOpen.set(true);
  }

  submitArticle(): void {
    const title = String(this.articleModel['title'] ?? '').trim();
    const category = String(this.articleModel['category'] ?? '').trim();
    const content = String(this.articleModel['content'] ?? '').trim();
    const contentType = Number(this.articleModel['contentType'] ?? HelpContentType.Article);
    const videoUrl = String(this.articleModel['videoUrl'] ?? '').trim();
    if (!title || !category || !content) {
      this.message.warning('请填写标题、分类与正文内容');
      return;
    }
    if (contentType === HelpContentType.Video && !videoUrl) {
      this.message.warning('视频教程必须填写视频地址');
      return;
    }
    const body: CreateHelpArticleRequest = {
      title,
      category,
      tags: String(this.articleModel['tags'] ?? '').trim(),
      contentType,
      videoUrl: contentType === HelpContentType.Video ? videoUrl : null,
      content,
      isPublished: !!this.articleModel['isPublished'],
    };
    const id = this.editingId();
    const request = id
      ? this.api.put<HelpArticleDto>(`/support/help/articles/${id}`, body)
      : this.api.post<HelpArticleDto>('/support/help/articles', body);
    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.editOpen.set(false);
        this.message.success(id ? '文章已更新' : '文章已创建');
        this.list.reload();
        this.loadCategories();
      },
      error: () => this.saving.set(false),
    });
  }

  publish(row: HelpRow): void {
    if (!this.perm.can('support.help.manage')) return;
    this.confirm
      .open({ title: '发布文章', content: `确认发布「${row.title}」？发布后所有用户可在帮助中心浏览。` })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.post<HelpArticleDto>(`/support/help/articles/${row.id}/publish`).subscribe({
          next: () => {
            this.message.success('文章已发布');
            this.list.reload();
            this.loadCategories();
          },
          error: () => undefined,
        });
      });
  }

  private loadCategories(): void {
    this.api.get<string[]>('/help/categories').subscribe({
      next: (items) => this.categories.set(items ?? []),
      error: () => this.categories.set([]),
    });
  }
}
