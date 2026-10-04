import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ApiService } from '../../core/api.service';
import {
  AgentTaskDto,
  AgentTaskStatusNameText,
  AgentTaskTypeNameText,
  AgentTaskTypeText,
  CreateAgentTaskRequest,
  Paged,
} from '../../core/api-types';
import { PagedList } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent, formatDateTime } from '../../shared/data-table';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';

type AgentTaskRow = AgentTaskDto & Record<string, unknown>;

/** 智能体任务：创建骨架任务并查看模拟输出 */
@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
    PageHeaderComponent,
    DataTableComponent,
    SchemaFormComponent,
    ModalComponent,
  ],
  template: `
    <app-page-header title="智能体任务" subtitle="提交需求解析、代码生成等任务，查看骨架实现的结构化输出">
      @if (perm.can('agent.use')) {
        <button nz-button nzType="primary" (click)="openCreate()">
          <span nz-icon nzType="plus"></span> 创建任务
        </button>
      }
      <button nz-button (click)="list.reload()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="card">
      <div class="filter-bar">
        <nz-select style="width: 170px" nzPlaceHolder="全部任务类型" nzAllowClear [ngModel]="type()" (ngModelChange)="onType($event)">
          <nz-option [nzValue]="1" nzLabel="需求解析" />
          <nz-option [nzValue]="2" nzLabel="代码生成" />
          <nz-option [nzValue]="3" nzLabel="规范校验" />
          <nz-option [nzValue]="4" nzLabel="问题排查" />
          <nz-option [nzValue]="5" nzLabel="文档生成" />
        </nz-select>
        <nz-select style="width: 150px" nzPlaceHolder="全部状态" nzAllowClear [ngModel]="status()" (ngModelChange)="onStatus($event)">
          <nz-option [nzValue]="0" nzLabel="待执行" />
          <nz-option [nzValue]="1" nzLabel="执行中" />
          <nz-option [nzValue]="2" nzLabel="成功" />
          <nz-option [nzValue]="3" nzLabel="失败" />
        </nz-select>
        <button nz-button (click)="reset()">重置</button>
        <span class="filter-bar__spacer"></span>
        <span class="text-secondary">共 {{ list.total() }} 个任务</span>
      </div>

      <app-data-table
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [pageNum]="list.pageNum"
        [pageSize]="list.pageSize"
        [loading]="list.loading()"
        emptyText="暂无智能体任务，点击「创建任务」开始"
        scrollX="1100px"
        (pageChange)="list.page($event)"
      >
        <ng-template #actions let-row>
          <button nz-button nzType="link" nzSize="small" (click)="openDetail(row.id)">查看输出</button>
        </ng-template>
      </app-data-table>
    </div>

    <app-modal [(open)]="createOpen" title="创建智能体任务" okText="提交任务" [loading]="creating()" [width]="680" (ok)="submitCreate()">
      <app-schema-form [fields]="createFields" [(model)]="createModel" />
    </app-modal>

    <app-modal [(open)]="detailOpen" [title]="detail()?.title ?? '任务详情'" okText="关闭" [width]="760" (ok)="detailOpen.set(false)">
      @if (detailLoading()) {
        <div class="page-loading"><nz-spin nzTip="任务详情加载中" /></div>
      } @else if (detail(); as task) {
        <div class="detail-head">
          <nz-tag nzColor="blue">{{ typeText(task.type) }}</nz-tag>
          <nz-tag [nzColor]="statusColor(task.status)">{{ statusText(task.status) }}</nz-tag>
          <span class="text-secondary">耗时 {{ task.durationMs }} ms · 创建于 {{ format(task.createdAt) }}</span>
        </div>

        <div class="card__subtitle mt-16 mb-8">任务输入</div>
        <pre class="code-block">{{ task.input }}</pre>

        @if (task.error) {
          <div class="card__subtitle mt-16 mb-8">错误信息</div>
          <pre class="code-block text-danger">{{ task.error }}</pre>
        }

        <div class="card__subtitle mt-16 mb-8">任务输出</div>
        @if (task.output) {
          <pre class="code-block">{{ task.output }}</pre>
        } @else {
          <div class="text-secondary">该任务暂无输出（骨架实现仅返回模拟内容）</div>
        }
      }
    </app-modal>
  `,
  styles: [
    `
      .code-block {
        margin: 0;
        padding: 12px;
        background: #f7f9fc;
        border: 1px solid #eef1f6;
        border-radius: 6px;
        font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
        font-size: 12.5px;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 360px;
        overflow: auto;
      }
      .detail-head {
        display: flex;
        align-items: center;
        gap: 10px;
      }
    `,
  ],
})
export class AgentTaskPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  readonly perm = inject(PermissionService);

  readonly type = signal<number | null>(null);
  readonly status = signal<number | null>(null);

  readonly createOpen = signal(false);
  readonly creating = signal(false);
  readonly detailOpen = signal(false);
  readonly detailLoading = signal(false);
  readonly detail = signal<AgentTaskDto | null>(null);

  createModel: Record<string, unknown> = { type: 1, title: '', input: '' };

  readonly createFields: FormField[] = [
    {
      key: 'type',
      label: '任务类型',
      type: 'select',
      required: true,
      span: 24,
      options: Object.entries(AgentTaskTypeText).map(([value, label]) => ({ value: Number(value), label })),
    },
    { key: 'title', label: '任务标题', type: 'text', required: true, span: 24, maxLength: 200 },
    {
      key: 'input',
      label: '任务输入',
      type: 'textarea',
      required: true,
      span: 24,
      rows: 8,
      placeholder: '描述需求背景、代码片段或问题现象',
    },
  ];

  readonly list = new PagedList<AgentTaskRow>((query) =>
    this.api.get<Paged<AgentTaskRow>>('/agent/tasks', {
      ...query,
      type: this.type() === null ? undefined : this.type()!,
      status: this.status() === null ? undefined : this.status()!,
    }),
  );

  readonly columns: DataColumn<AgentTaskRow>[] = [
    { key: 'type', title: '类型', width: '110px', type: 'status', map: AgentTaskTypeNameText, tone: () => 'processing' },
    { key: 'title', title: '标题', ellipsis: true },
    { key: 'status', title: '状态', width: '100px', type: 'status', map: AgentTaskStatusNameText },
    { key: 'durationMs', title: '耗时(ms)', width: '100px', align: 'right' },
    { key: 'createdAt', title: '创建时间', width: '170px', type: 'datetime' },
  ];

  ngOnInit(): void {
    this.list.reload();
  }

  onType(value: number | null): void {
    this.type.set(value);
    this.list.filter({});
  }

  onStatus(value: number | null): void {
    this.status.set(value);
    this.list.filter({});
  }

  reset(): void {
    this.type.set(null);
    this.status.set(null);
    this.list.filter({});
  }

  openCreate(): void {
    this.createModel = { type: 1, title: '', input: '' };
    this.createOpen.set(true);
  }

  submitCreate(): void {
    const title = String(this.createModel['title'] ?? '').trim();
    const input = String(this.createModel['input'] ?? '').trim();
    if (!title || !input) {
      this.message.warning('请填写任务标题与输入');
      return;
    }
    const body: CreateAgentTaskRequest = { type: Number(this.createModel['type'] ?? 1), title, input };
    this.creating.set(true);
    this.api.post<AgentTaskDto>('/agent/tasks', body).subscribe({
      next: (task) => {
        this.creating.set(false);
        this.createOpen.set(false);
        this.message.success('任务已创建，正在打开输出');
        this.list.reload();
        if (task?.id) this.openDetail(task.id);
      },
      error: () => this.creating.set(false),
    });
  }

  openDetail(id: string): void {
    this.detail.set(null);
    this.detailOpen.set(true);
    this.detailLoading.set(true);
    this.api.get<AgentTaskDto>(`/agent/tasks/${id}`).subscribe({
      next: (task) => {
        this.detailLoading.set(false);
        this.detail.set(task ?? null);
      },
      error: () => this.detailLoading.set(false),
    });
  }

  typeText(value: string): string {
    return AgentTaskTypeNameText[value] ?? value;
  }

  statusText(value: string): string {
    return AgentTaskStatusNameText[value] ?? value;
  }

  statusColor(value: string): string {
    if (value === 'Succeeded') return 'success';
    if (value === 'Failed') return 'error';
    if (value === 'Running') return 'processing';
    return 'default';
  }

  format(value: string | null | undefined): string {
    return formatDateTime(value);
  }
}
