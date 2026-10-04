import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { ApiService } from '../../core/api.service';
import {
  DispatchEmergencyRequest,
  EmergencyAlertDto,
  EmergencyAlertStatus,
  EmergencyLevelNameText,
  EmergencyStatusNameText,
  Paged,
  ProgressEmergencyRequest,
  UserListItemDto,
} from '../../core/api-types';
import { ConfirmService } from '../../core/confirm.service';
import { nameMap } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { formatDateTime } from '../../shared/data-table';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { SelectOption } from '../../shared/search-select';
import { StatusTagComponent } from '../../shared/status-tag';

const TIMELINE_ACTION_TEXT: Record<string, string> = {
  Report: '上报告警',
  Dispatch: '下发处置',
  Progress: '处置进展',
  Close: '关闭归档',
};

/** M6 告警处置详情：信息卡 + 处置方案 + 时间线，按状态下发处置/新增进展/关闭归档 */
@Component({
  selector: 'app-alert-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzEmptyModule,
    NzIconModule,
    NzSpinModule,
    NzTimelineModule,
    ModalComponent,
    PageHeaderComponent,
    SchemaFormComponent,
    StatusTagComponent,
  ],
  template: `
    <app-page-header title="告警处置" [subtitle]="alert()?.title ?? '加载中'">
      <button nz-button (click)="back()">返回列表</button>
      <button nz-button (click)="load()"><span nz-icon nzType="reload"></span> 刷新</button>
      @if (alert(); as item) {
        @if (canDispatch(item)) {
          <button nz-button nzType="primary" (click)="openDispatch()">
            <span nz-icon nzType="send"></span> 下发处置
          </button>
        }
        @if (canProgress(item)) {
          <button nz-button (click)="openProgress()"><span nz-icon nzType="tool"></span> 新增进展</button>
        }
        @if (canClose(item)) {
          <button nz-button nzDanger (click)="closeAlert()">关闭归档</button>
        }
      }
    </app-page-header>

    @if (loading()) {
      <div class="card page-loading"><nz-spin nzTip="加载告警详情" /></div>
    } @else {
      @if (alert(); as item) {
        @if (item.status === 'Open') {
          <div class="card hint-card">告警尚未处置：请先下发处置，明确处理人与处置方案。</div>
        }

        <div class="card">
          <div class="card__title">
            告警信息
            <span class="detail-tags">
              <app-status-tag [value]="item.level" [map]="EmergencyLevelNameText" [color]="levelTone(item.level)" />
              <app-status-tag [value]="item.status" [map]="EmergencyStatusNameText" />
            </span>
          </div>
          <div class="desc-grid">
            <div class="desc-item">
              <span class="desc-item__label">告警编号</span>
              <span class="desc-item__value mono">{{ item.id }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">告警来源</span>
              <span class="desc-item__value">{{ item.source || '-' }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">上报人</span>
              <span class="desc-item__value">{{ userLabel(item.reportedBy) }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">上报时间</span>
              <span class="desc-item__value">{{ time(item.reportedAt) }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">处置时限</span>
              <span class="desc-item__value">{{ time(item.deadlineAt) }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">关闭时间</span>
              <span class="desc-item__value">{{ time(item.closedAt) }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">关联商家</span>
              <span class="desc-item__value mono">{{ item.merchantId || '-' }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">关联业务</span>
              <span class="desc-item__value mono">{{ item.relatedId || '-' }}</span>
            </div>
          </div>
          <div class="card__subtitle mt-8">告警内容</div>
          <div class="detail-content">{{ item.content }}</div>
          @if (item.result) {
            <div class="card__subtitle mt-8">处置结果</div>
            <div class="detail-content">{{ item.result }}</div>
          }
        </div>

        <div class="card mt-16">
          <div class="card__title">处置方案</div>
          @if (item.disposalPlan) {
            <div class="detail-content">{{ item.disposalPlan }}</div>
            <div class="mt-8">
              <span class="text-secondary">处理人：</span>
              @for (handler of item.handlers ?? []; track $index) {
                <span class="handler-chip" [title]="handler">{{ userLabel(handler) }}</span>
              } @empty {
                <span class="text-secondary">未指派</span>
              }
            </div>
          } @else {
            <div class="text-secondary">尚未下发处置方案。</div>
          }
        </div>

        <div class="card mt-16">
          <div class="card__title">
            处置时间线
            <span class="card__subtitle">共 {{ item.timeline?.length ?? 0 }} 条</span>
          </div>
          @if (item.timeline?.length) {
            <nz-timeline>
              @for (entry of item.timeline; track entry.id) {
                <nz-timeline-item [nzColor]="timelineColor(entry.action)">
                  <div class="timeline__head">
                    <span class="timeline__action">{{ actionText(entry.action) }}</span>
                    <span class="text-secondary">{{ time(entry.at) }} · {{ userLabel(entry.operatorId) }}</span>
                  </div>
                  @if (entry.note) {
                    <div class="timeline__note">{{ entry.note }}</div>
                  }
                  @if (entry.attachments?.length) {
                    <div class="timeline__attachments">
                      @for (file of entry.attachments; track $index) {
                        <a [href]="file" target="_blank" rel="noopener">{{ file }}</a>
                      }
                    </div>
                  }
                </nz-timeline-item>
              }
            </nz-timeline>
          } @else {
            <div class="text-secondary">暂无处置记录。</div>
          }
        </div>
      } @else {
        <div class="card"><nz-empty nzNotFoundContent="告警不存在或无权查看" /></div>
      }
    }

    <app-modal
      [(open)]="dispatchOpen"
      title="下发处置"
      okText="下发"
      [loading]="saving()"
      [width]="680"
      (ok)="submitDispatch()"
    >
      <app-schema-form [fields]="dispatchFields()" [(model)]="dispatchModel" />
    </app-modal>

    <app-modal
      [(open)]="progressOpen"
      title="新增处置进展"
      okText="提交进展"
      [loading]="saving()"
      [width]="680"
      (ok)="submitProgress()"
    >
      <app-schema-form [fields]="progressFields" [(model)]="progressModel" />
    </app-modal>
  `,
  styles: [
    `
      .hint-card { border-color: #ffe58f; background: #fffbe6; color: #ad6800; margin-bottom: 16px; }
      .detail-tags { display: flex; gap: 6px; }
      .detail-content { font-size: 13px; line-height: 1.8; white-space: pre-wrap; word-break: break-word; }
      .handler-chip {
        display: inline-block; background: #f0f5ff; border: 1px solid #adc6ff; color: #2f54eb;
        border-radius: 4px; padding: 0 8px; margin: 0 6px 6px 0; font-size: 12px;
      }
      .timeline__head { display: flex; gap: 12px; align-items: baseline; font-size: 13px; }
      .timeline__action { font-weight: 600; color: #1f2637; }
      .timeline__note { margin-top: 4px; font-size: 13px; white-space: pre-wrap; word-break: break-word; }
      .timeline__attachments { margin-top: 4px; display: flex; flex-direction: column; gap: 2px; font-size: 12px; }
    `,
  ],
})
export class AlertDetailPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  readonly perm = inject(PermissionService);

  readonly EmergencyLevelNameText = EmergencyLevelNameText;
  readonly EmergencyStatusNameText = EmergencyStatusNameText;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly dispatchOpen = signal(false);
  readonly progressOpen = signal(false);
  readonly alert = signal<EmergencyAlertDto | null>(null);

  readonly userOptions = signal<SelectOption[]>([]);
  readonly userLoading = signal(false);
  private readonly userMap = signal<Record<string, string>>({});

  private readonly alertId = this.route.snapshot.paramMap.get('id') ?? '';

  dispatchModel: Record<string, unknown> = {};
  progressModel: Record<string, unknown> = {};

  readonly dispatchFields = computed<FormField[]>(() => {
    const handlers: FormField = this.perm.can('account.user.manage')
      ? {
          key: 'handlers',
          label: '处理人',
          type: 'multiselect',
          required: true,
          span: 24,
          placeholder: '搜索并选择处理人（可多选）',
          options: this.userOptions(),
          loading: this.userLoading(),
        }
      : {
          key: 'handlers',
          label: '处理人 ID',
          type: 'textarea',
          required: true,
          span: 24,
          rows: 3,
          placeholder: '每行一个用户 ID（GUID）',
          help: '当前账号无用户查询权限，请手填处理人用户 ID（GUID）',
        };
    return [
      handlers,
      { key: 'plan', label: '处置方案', type: 'textarea', required: true, span: 24, rows: 3, maxLength: 500, placeholder: '处置步骤、资源投入与安全要求' },
      { key: 'deadlineAt', label: '处置时限', type: 'datetime', span: 12 },
    ];
  });

  readonly progressFields: FormField[] = [
    { key: 'note', label: '进展说明', type: 'textarea', required: true, span: 24, rows: 3, maxLength: 500, placeholder: '现场处置进展、遇到的问题等' },
    { key: 'status', label: '更新状态', type: 'select', span: 12, placeholder: '保持当前状态', options: [
      { value: EmergencyAlertStatus.Handling, label: '处理中' },
      { value: EmergencyAlertStatus.Resolved, label: '已解决' },
    ] },
    { key: 'attachments', label: '现场附件', type: 'textarea', span: 24, rows: 2, placeholder: '每行一个附件链接（可选）' },
  ];

  ngOnInit(): void {
    this.load();
    this.loadUsers('');
  }

  load(): void {
    if (!this.alertId) return;
    this.loading.set(true);
    this.api.get<EmergencyAlertDto>(`/support/emergency-alerts/${this.alertId}`).subscribe({
      next: (data) => {
        this.alert.set(data);
        this.loading.set(false);
        const handlers = data.handlers ?? [];
        if (handlers.length) this.loadUsers('');
      },
      error: () => {
        this.alert.set(null);
        this.loading.set(false);
      },
    });
  }

  back(): void {
    void this.router.navigateByUrl('/support/alerts');
  }

  time(value: unknown): string {
    return formatDateTime(value);
  }

  actionText(action: string): string {
    return TIMELINE_ACTION_TEXT[action] ?? action;
  }

  timelineColor(action: string): string {
    if (action === 'Close') return 'green';
    if (action === 'Dispatch') return 'orange';
    return 'blue';
  }

  levelTone(level: string): string {
    if (level === 'Critical') return 'error';
    if (level === 'Serious') return 'warning';
    return 'default';
  }

  userLabel(userId: string): string {
    if (!userId) return '-';
    return this.userMap()[userId] ?? userId;
  }

  canDispatch(item: EmergencyAlertDto): boolean {
    return !!item && item.status !== 'Closed' && this.perm.can('support.alert.handle');
  }

  canProgress(item: EmergencyAlertDto): boolean {
    return !!item && (item.status === 'Handling' || item.status === 'Resolved') && this.perm.can('support.alert.handle');
  }

  canClose(item: EmergencyAlertDto): boolean {
    return !!item && item.status !== 'Closed' && this.perm.can('support.alert.handle');
  }

  openDispatch(): void {
    this.dispatchModel = { handlers: [], plan: '', deadlineAt: null };
    this.loadUsers('');
    this.dispatchOpen.set(true);
  }

  submitDispatch(): void {
    const item = this.alert();
    if (!item) return;
    const raw = this.dispatchModel['handlers'];
    const handlers = Array.isArray(raw)
      ? raw.map((value) => String(value))
      : String(raw ?? '')
          .split(/[\s,，;；]+/)
          .map((value) => value.trim())
          .filter(Boolean);
    const plan = String(this.dispatchModel['plan'] ?? '').trim();
    if (!handlers.length) {
      this.message.warning('请至少选择一名处理人');
      return;
    }
    if (!plan) {
      this.message.warning('请填写处置方案');
      return;
    }
    const body: DispatchEmergencyRequest = {
      handlers,
      plan,
      deadlineAt: (this.dispatchModel['deadlineAt'] as string) || null,
    };
    this.saving.set(true);
    this.api.post<EmergencyAlertDto>(`/support/emergency-alerts/${item.id}/dispatch`, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.dispatchOpen.set(false);
        this.message.success('处置指令已下发');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  openProgress(): void {
    this.progressModel = { note: '', status: null, attachments: '' };
    this.progressOpen.set(true);
  }

  submitProgress(): void {
    const item = this.alert();
    if (!item) return;
    const note = String(this.progressModel['note'] ?? '').trim();
    if (!note) {
      this.message.warning('请填写处置进展说明');
      return;
    }
    const attachments = String(this.progressModel['attachments'] ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const body: ProgressEmergencyRequest = {
      note,
      attachments: attachments.length ? attachments : null,
      status: this.progressModel['status'] === null || this.progressModel['status'] === undefined
        ? null
        : Number(this.progressModel['status']),
    };
    this.saving.set(true);
    this.api.post<EmergencyAlertDto>(`/support/emergency-alerts/${item.id}/progress`, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.progressOpen.set(false);
        this.message.success('处置进展已记录');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  closeAlert(): void {
    const item = this.alert();
    if (!item) return;
    this.confirm
      .prompt({ title: `关闭归档：${item.title}`, placeholder: '请填写处置结果（必填）', required: true, multiline: true, danger: true })
      .subscribe((result) => {
        if (!result) return;
        this.api.post<EmergencyAlertDto>(`/support/emergency-alerts/${item.id}/close`, { result }).subscribe({
          next: () => {
            this.message.success('告警已关闭归档');
            this.load();
          },
          error: () => undefined,
        });
      });
  }

  private loadUsers(keyword: string): void {
    if (!this.perm.can('account.user.manage')) return;
    this.userLoading.set(true);
    this.api
      .get<Paged<UserListItemDto>>('/admin/users', { pageNum: 1, pageSize: 100, keyword: keyword || undefined })
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
