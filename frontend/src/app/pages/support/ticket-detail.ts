import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ApiService } from '../../core/api.service';
import {
  AssignTicketRequest,
  CannedResponseDto,
  Paged,
  RateTicketRequest,
  ServiceTicketDto,
  TicketStatusNameText,
  TicketTypeNameText,
  UserListItemDto,
} from '../../core/api-types';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { nameMap } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { formatDateTime } from '../../shared/data-table';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { SelectOption } from '../../shared/search-select';
import { StatusTagComponent } from '../../shared/status-tag';

/** M6 工单详情：工单信息 + 会话回复（常用语快捷填充）+ 指派/完成/关闭/评价 */
@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzSpinModule,
    NzTagModule,
    ModalComponent,
    PageHeaderComponent,
    SchemaFormComponent,
    StatusTagComponent,
  ],
  template: `
    <app-page-header title="工单详情" [subtitle]="ticket()?.title ?? '加载中'">
      <button nz-button (click)="back()">返回列表</button>
      <button nz-button (click)="load()"><span nz-icon nzType="reload"></span> 刷新</button>
      @if (ticket(); as item) {
        @if (canAssign(item)) {
          <button nz-button nzType="primary" (click)="openAssign()"><span nz-icon nzType="team"></span> 指派 / 转派</button>
        }
        @if (canComplete(item)) {
          <button nz-button (click)="complete()"><span nz-icon nzType="check"></span> 完成工单</button>
        }
        @if (item.status !== 'Closed') {
          <button nz-button nzDanger (click)="close()">关闭工单</button>
        }
        @if (canRate(item)) {
          <button nz-button nzType="primary" (click)="openRate()"><span nz-icon nzType="star"></span> 评价工单</button>
        }
      }
    </app-page-header>

    @if (loading()) {
      <div class="card page-loading"><nz-spin nzTip="加载工单详情" /></div>
    } @else {
      @if (ticket(); as item) {
        <div class="card">
          <div class="card__title">
            工单信息
            <span class="detail-tags">
              <app-status-tag [value]="item.type" [map]="TicketTypeNameText" />
              <app-status-tag [value]="item.status" [map]="TicketStatusNameText" />
            </span>
          </div>
          <div class="desc-grid">
            <div class="desc-item"><span class="desc-item__label">工单号</span><span class="desc-item__value mono">{{ item.ticketNo }}</span></div>
            <div class="desc-item"><span class="desc-item__label">提交人</span><span class="desc-item__value">{{ userLabel(item.submitterUserId) }}</span></div>
            <div class="desc-item">
              <span class="desc-item__label">处理人</span>
              <span class="desc-item__value">{{ item.assigneeUserId ? userLabel(item.assigneeUserId) : '未指派' }}</span>
            </div>
            <div class="desc-item"><span class="desc-item__label">指派时间</span><span class="desc-item__value">{{ time(item.assignedAt) }}</span></div>
            <div class="desc-item"><span class="desc-item__label">商家</span><span class="desc-item__value mono">{{ item.merchantId || '-' }}</span></div>
            <div class="desc-item"><span class="desc-item__label">关联订单</span><span class="desc-item__value mono">{{ item.orderId || '-' }}</span></div>
            <div class="desc-item"><span class="desc-item__label">创建时间</span><span class="desc-item__value">{{ time(item.createdAt) }}</span></div>
            <div class="desc-item"><span class="desc-item__label">完成时间</span><span class="desc-item__value">{{ time(item.completedAt) }}</span></div>
            <div class="desc-item"><span class="desc-item__label">关闭时间</span><span class="desc-item__value">{{ time(item.closedAt) }}</span></div>
            <div class="desc-item">
              <span class="desc-item__label">满意度</span>
              <span class="desc-item__value">
                {{ item.satisfactionRating ? item.satisfactionRating + ' 分' : '未评价' }}
                @if (item.satisfactionComment) {
                  <span class="text-secondary">（{{ item.satisfactionComment }}）</span>
                }
              </span>
            </div>
          </div>
          <div class="card__subtitle mt-8">问题描述</div>
          <div class="detail-content">{{ item.content }}</div>
          @if (item.attachments?.length) {
            <div class="mt-8">
              <span class="text-secondary">附件：</span>
              @for (file of item.attachments; track $index) {
                <a class="attach-link" [href]="file" target="_blank" rel="noopener">{{ file }}</a>
              }
            </div>
          }
        </div>

        <div class="card mt-16">
          <div class="card__title">
            会话记录
            <span class="card__subtitle">共 {{ item.replies?.length ?? 0 }} 条</span>
          </div>
          @if (item.replies?.length) {
            <div class="chat">
              @for (reply of item.replies; track reply.id) {
                <div class="chat__row" [class.chat__row--right]="isMine(reply.userId)">
                  <div class="chat__bubble" [class.chat__bubble--mine]="isMine(reply.userId)">
                    <div class="chat__meta">
                      {{ reply.isStaff ? '客服' : '提交人' }}{{ isMine(reply.userId) ? '（我）' : '' }} · {{ time(reply.at) }}
                    </div>
                    <div class="chat__text">{{ reply.content }}</div>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="text-secondary">暂无会话记录。</div>
          }

          @if (item.status === 'Closed') {
            <div class="mt-16 text-secondary">工单已关闭，如需继续沟通请提交新工单。</div>
          } @else {
            @if (canned().length) {
              <div class="filter-bar mt-16">
                <span class="filter-bar__label">常用语</span>
                @for (phrase of canned(); track phrase.id) {
                  <nz-tag class="canned-tag" (click)="useCanned(phrase)">{{ shortText(phrase.content) }}</nz-tag>
                }
              </div>
            }
            <div class="mt-16">
              <textarea
                nz-input
                rows="3"
                maxlength="1000"
                placeholder="输入回复内容，可通过上方常用语快速填充"
                [ngModel]="replyText()"
                (ngModelChange)="replyText.set($event)"
              ></textarea>
              <div class="mt-8">
                <button nz-button nzType="primary" [nzLoading]="saving()" (click)="sendReply()">
                  <span nz-icon nzType="send"></span> 发送回复
                </button>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="card"><nz-empty nzNotFoundContent="工单不存在或无权查看" /></div>
      }
    }

    <app-modal
      [(open)]="assignOpen"
      title="指派 / 转派工单"
      okText="确认指派"
      [loading]="saving()"
      [width]="620"
      (ok)="submitAssign()"
    >
      <app-schema-form [fields]="assignFields()" [(model)]="assignModel" />
    </app-modal>

    <app-modal
      [(open)]="rateOpen"
      title="评价工单"
      okText="提交评价"
      [loading]="saving()"
      [width]="620"
      (ok)="submitRate()"
    >
      <app-schema-form [fields]="rateFields" [(model)]="rateModel" />
    </app-modal>
  `,
  styles: [
    `
      .detail-tags { display: flex; gap: 6px; }
      .detail-content { font-size: 13px; line-height: 1.8; white-space: pre-wrap; word-break: break-word; }
      .attach-link { display: block; font-size: 12px; word-break: break-all; }
      .chat { display: flex; flex-direction: column; gap: 12px; max-height: 460px; overflow: auto; padding-right: 4px; }
      .chat__row { display: flex; }
      .chat__row--right { justify-content: flex-end; }
      .chat__bubble {
        max-width: 72%; background: #f5f7fa; border: 1px solid #eef1f6;
        border-radius: 10px; padding: 10px 12px;
      }
      .chat__bubble--mine { background: #e6f4ff; border-color: #91caff; }
      .chat__meta { font-size: 12px; color: #8c96a8; margin-bottom: 4px; }
      .chat__text { font-size: 13px; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }
      .canned-tag { cursor: pointer; }
    `,
  ],
})
export class TicketDetailPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  readonly perm = inject(PermissionService);

  readonly TicketTypeNameText = TicketTypeNameText;
  readonly TicketStatusNameText = TicketStatusNameText;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly assignOpen = signal(false);
  readonly rateOpen = signal(false);
  readonly replyText = signal('');
  readonly ticket = signal<ServiceTicketDto | null>(null);
  readonly canned = signal<CannedResponseDto[]>([]);

  readonly userOptions = signal<SelectOption[]>([]);
  readonly userLoading = signal(false);
  private readonly userMap = signal<Record<string, string>>({});

  private readonly ticketId = this.route.snapshot.paramMap.get('id') ?? '';

  assignModel: Record<string, unknown> = {};
  rateModel: Record<string, unknown> = {};

  readonly assignFields = computed<FormField[]>(() => {
    if (this.perm.can('account.user.manage')) {
      return [
        {
          key: 'assigneeUserId',
          label: '处理人',
          type: 'search-select',
          required: true,
          span: 24,
          placeholder: '输入姓名或用户名搜索',
          options: this.userOptions(),
          loading: this.userLoading(),
          search: (keyword) => this.loadUsers(keyword),
        },
      ];
    }
    return [
      { key: 'assigneeUserId', label: '处理人 ID', type: 'text', required: true, span: 24, placeholder: '填写处理人用户 ID（GUID）', help: '当前账号无用户查询权限，请手填处理人用户 ID' },
    ];
  });

  readonly rateFields: FormField[] = [
    {
      key: 'rating',
      label: '满意度评分',
      type: 'select',
      required: true,
      span: 12,
      options: [
        { value: 5, label: '5 分（非常满意）' },
        { value: 4, label: '4 分（满意）' },
        { value: 3, label: '3 分（一般）' },
        { value: 2, label: '2 分（不满意）' },
        { value: 1, label: '1 分（非常不满意）' },
      ],
    },
    { key: 'comment', label: '评价说明', type: 'textarea', span: 24, rows: 3, maxLength: 200, placeholder: '补充说明（可选）' },
  ];

  ngOnInit(): void {
    this.load();
    this.loadCanned();
    this.loadUsers('');
  }

  load(): void {
    if (!this.ticketId) return;
    this.loading.set(true);
    this.api.get<ServiceTicketDto>(`/support/tickets/${this.ticketId}`).subscribe({
      next: (data) => {
        this.ticket.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.ticket.set(null);
        this.loading.set(false);
      },
    });
  }

  back(): void {
    void this.router.navigateByUrl('/support/tickets');
  }

  time(value: unknown): string {
    return formatDateTime(value);
  }

  shortText(value: string): string {
    return value.length > 18 ? `${value.slice(0, 18)}…` : value;
  }

  userLabel(userId: string): string {
    if (!userId) return '-';
    return this.userMap()[userId] ?? userId;
  }

  isMine(userId: string): boolean {
    return !!this.auth.user()?.id && this.auth.user()?.id === userId;
  }

  canAssign(item: ServiceTicketDto): boolean {
    return !!item && item.status !== 'Closed' && this.perm.can('support.ticket.manage');
  }

  canComplete(item: ServiceTicketDto): boolean {
    return !!item && (item.status === 'Pending' || item.status === 'Processing') && this.perm.can('support.ticket.manage');
  }

  canRate(item: ServiceTicketDto): boolean {
    return (
      !!item &&
      item.submitterUserId === this.auth.user()?.id &&
      item.status === 'Completed' &&
      (item.satisfactionRating === null || item.satisfactionRating === undefined)
    );
  }

  useCanned(phrase: CannedResponseDto): void {
    const current = this.replyText();
    this.replyText.set(current ? `${current}\n${phrase.content}` : phrase.content);
  }

  sendReply(): void {
    const item = this.ticket();
    const content = this.replyText().trim();
    if (!item) return;
    if (!content) {
      this.message.warning('请填写回复内容');
      return;
    }
    this.saving.set(true);
    this.api.post<ServiceTicketDto>(`/support/tickets/${item.id}/reply`, { content }).subscribe({
      next: () => {
        this.saving.set(false);
        this.replyText.set('');
        this.message.success('回复已发送');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  openAssign(): void {
    this.assignModel = { assigneeUserId: null };
    this.loadUsers('');
    this.assignOpen.set(true);
  }

  submitAssign(): void {
    const item = this.ticket();
    const assigneeUserId = String(this.assignModel['assigneeUserId'] ?? '').trim();
    if (!item) return;
    if (!assigneeUserId) {
      this.message.warning('请选择或填写处理人');
      return;
    }
    const body: AssignTicketRequest = { assigneeUserId };
    this.saving.set(true);
    this.api.post<ServiceTicketDto>(`/support/tickets/${item.id}/assign`, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.assignOpen.set(false);
        this.message.success('工单已指派');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  complete(): void {
    const item = this.ticket();
    if (!item) return;
    this.confirm
      .open({ title: '完成工单', content: `确认将工单 ${item.ticketNo} 标记为已完成？完成后可由提交人评价。` })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.post<ServiceTicketDto>(`/support/tickets/${item.id}/complete`).subscribe({
          next: () => {
            this.message.success('工单已完成');
            this.load();
          },
          error: () => undefined,
        });
      });
  }

  close(): void {
    const item = this.ticket();
    if (!item) return;
    this.confirm
      .open({ title: '关闭工单', content: `确认关闭工单 ${item.ticketNo}？关闭后不再建议继续会话。`, danger: true })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.post<ServiceTicketDto>(`/support/tickets/${item.id}/close`).subscribe({
          next: () => {
            this.message.success('工单已关闭');
            this.load();
          },
          error: () => undefined,
        });
      });
  }

  openRate(): void {
    this.rateModel = { rating: 5, comment: '' };
    this.rateOpen.set(true);
  }

  submitRate(): void {
    const item = this.ticket();
    const rating = Number(this.rateModel['rating'] ?? 0);
    if (!item) return;
    if (!rating) {
      this.message.warning('请选择满意度评分');
      return;
    }
    const body: RateTicketRequest = { rating, comment: String(this.rateModel['comment'] ?? '').trim() || null };
    this.saving.set(true);
    this.api.post<ServiceTicketDto>(`/support/tickets/${item.id}/rate`, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.rateOpen.set(false);
        this.message.success('感谢您的评价');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  private loadCanned(): void {
    if (!this.perm.can('support.ticket.manage')) return;
    this.api.get<CannedResponseDto[]>('/support/tickets/canned-responses').subscribe({
      next: (items) => this.canned.set(items ?? []),
      error: () => this.canned.set([]),
    });
  }

  private loadUsers(keyword: string): void {
    if (!this.perm.can('account.user.manage')) return;
    this.userLoading.set(true);
    this.api
      .get<Paged<UserListItemDto>>('/admin/users', { pageNum: 1, pageSize: 50, keyword: keyword || undefined })
      .subscribe({
        next: (page) => {
          const items = page.items ?? [];
          this.userOptions.set(items.map((user) => ({ value: user.id, label: `${user.displayName}（${user.username}）` })));
          this.userMap.update((map) => ({
            ...map,
            ...nameMap(items, (user) => user.id, (user) => user.displayName || user.username),
          }));
          this.userLoading.set(false);
        },
        error: () => {
          this.userOptions.set([]);
          this.userLoading.set(false);
        },
      });
  }
}
