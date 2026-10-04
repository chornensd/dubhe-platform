import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { ApiService } from '../../core/api.service';
import { AgentProtocolDto, CreateAgentProtocolRequest } from '../../core/api-types';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent } from '../../shared/data-table';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';

type ProtocolRow = AgentProtocolDto & Record<string, unknown>;

/** 团队协定：智能体协作约定的版本化记录 */
@Component({
  selector: 'app-protocols',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzEmptyModule,
    NzIconModule,
    NzSpinModule,
    PageHeaderComponent,
    DataTableComponent,
    SchemaFormComponent,
    ModalComponent,
  ],
  template: `
    <app-page-header title="团队协定" subtitle="沉淀智能体与研发协作的约定（JSON 结构版本化保存）">
      @if (perm.can('agent.manage')) {
        <button nz-button nzType="primary" (click)="openCreate()">
          <span nz-icon nzType="plus"></span> 新增协定
        </button>
      }
      <button nz-button (click)="load()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    @if (!perm.canAny(['agent.use', 'agent.manage'])) {
      <div class="card">
        <nz-empty nzNotFoundContent="当前账号无智能体使用权限" />
      </div>
    } @else if (loading()) {
      <div class="card"><div class="page-loading"><nz-spin nzTip="协定加载中" /></div></div>
    } @else {
      <div class="card">
        <app-data-table
          [columns]="columns"
          [rows]="rows()"
          [total]="rows().length"
          [pageNum]="1"
          [pageSize]="pageSize()"
          [loading]="false"
          emptyText="暂无团队协定，点击「新增协定」创建"
          scrollX="1000px"
        >
          <ng-template #actions let-row>
            <button nz-button nzType="link" nzSize="small" (click)="openView(row)">查看内容</button>
          </ng-template>
        </app-data-table>
      </div>
    }

    <app-modal [(open)]="viewOpen" [title]="'协定内容 · ' + (viewRow()?.name ?? '')" okText="关闭" [width]="760" (ok)="viewOpen.set(false)">
      @if (viewRow(); as row) {
        <div class="desc-grid mb-16">
          <div class="desc-item">
            <span class="desc-item__label">版本</span>
            <span class="desc-item__value">{{ row.version }}</span>
          </div>
          <div class="desc-item">
            <span class="desc-item__label">状态</span>
            <span class="desc-item__value">{{ row.isActive ? '启用' : '停用' }}</span>
          </div>
          <div class="desc-item">
            <span class="desc-item__label">创建时间</span>
            <span class="desc-item__value">{{ row.createdAt | date: 'yyyy-MM-dd HH:mm' }}</span>
          </div>
          <div class="desc-item">
            <span class="desc-item__label">描述</span>
            <span class="desc-item__value">{{ row.description || '-' }}</span>
          </div>
        </div>
        <pre class="code-block">{{ prettyContent() }}</pre>
      }
    </app-modal>

    <app-modal [(open)]="createOpen" title="新增团队协定" okText="保存" [loading]="saving()" [width]="720" (ok)="submitCreate()">
      <app-schema-form [fields]="createFields" [(model)]="createModel" />
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
        max-height: 420px;
        overflow: auto;
      }
    `,
  ],
})
export class ProtocolPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  readonly perm = inject(PermissionService);

  readonly rows = signal<ProtocolRow[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly viewOpen = signal(false);
  readonly viewRow = signal<ProtocolRow | null>(null);
  readonly createOpen = signal(false);

  createModel: Record<string, unknown> = { name: '', version: 'v1', description: '', content: '' };

  readonly createFields: FormField[] = [
    { key: 'name', label: '协定名称', type: 'text', required: true, span: 16, maxLength: 100 },
    { key: 'version', label: '版本', type: 'text', span: 8, placeholder: '如 v1' },
    { key: 'description', label: '描述', type: 'textarea', span: 24, rows: 2, maxLength: 200 },
    {
      key: 'content',
      label: '协定内容(JSON)',
      type: 'textarea',
      required: true,
      span: 24,
      rows: 10,
      placeholder: '{"rules": ["约定一", "约定二"]}',
      help: '请填写合法的 JSON 文本，保存后以原始字符串存储',
    },
  ];

  readonly columns: DataColumn<ProtocolRow>[] = [
    { key: 'name', title: '名称', width: '220px' },
    { key: 'version', title: '版本', width: '90px' },
    { key: 'description', title: '描述', ellipsis: true, pipe: (row) => row.description || '-' },
    { key: 'isActive', title: '启用', width: '80px', type: 'boolean' },
    { key: 'createdAt', title: '创建时间', width: '170px', type: 'datetime' },
  ];

  ngOnInit(): void {
    this.load();
  }

  pageSize(): number {
    return Math.max(10, this.rows().length);
  }

  load(): void {
    if (!this.perm.canAny(['agent.use', 'agent.manage'])) return;
    this.loading.set(true);
    this.api.get<AgentProtocolDto[]>('/agent/protocols').subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.rows.set((rows ?? []) as ProtocolRow[]);
      },
      error: () => {
        this.loading.set(false);
        this.rows.set([]);
      },
    });
  }

  openView(row: ProtocolRow): void {
    this.viewRow.set(row);
    this.viewOpen.set(true);
  }

  prettyContent(): string {
    const content = this.viewRow()?.content ?? '';
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return content;
    }
  }

  openCreate(): void {
    this.createModel = { name: '', version: 'v1', description: '', content: '' };
    this.createOpen.set(true);
  }

  submitCreate(): void {
    const name = String(this.createModel['name'] ?? '').trim();
    const content = String(this.createModel['content'] ?? '').trim();
    if (!name || !content) {
      this.message.warning('请填写协定名称与内容');
      return;
    }
    try {
      JSON.parse(content);
    } catch {
      this.message.error('协定内容必须是合法的 JSON 文本');
      return;
    }
    const body: CreateAgentProtocolRequest = {
      name,
      version: String(this.createModel['version'] ?? '').trim() || 'v1',
      description: String(this.createModel['description'] ?? '').trim() || null,
      content,
    };
    this.saving.set(true);
    this.api.post<AgentProtocolDto>('/agent/protocols', body).subscribe({
      next: () => {
        this.saving.set(false);
        this.createOpen.set(false);
        this.message.success('团队协定已创建');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
