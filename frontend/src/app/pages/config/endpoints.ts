import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ApiService } from '../../core/api.service';
import {
  CreateEndpointRequest,
  EndpointCallResult,
  EndpointDto,
  InterfaceCallLogDto,
  Paged,
  UpdateEndpointRequest,
} from '../../core/api-types';
import { PagedList } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent, formatDateTime } from '../../shared/data-table';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';

type EndpointRow = EndpointDto & Record<string, unknown>;
type EndpointLogRow = InterfaceCallLogDto & Record<string, unknown>;

/** 接口管理：外部接口配置、连通性测试与调用日志 */
@Component({
  selector: 'app-endpoints',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzEmptyModule,
    NzIconModule,
    NzTagModule,
    PageHeaderComponent,
    DataTableComponent,
    SchemaFormComponent,
    ModalComponent,
  ],
  template: `
    <app-page-header title="接口管理" subtitle="维护外部接口地址与超时重试策略，支持连通性测试与调用日志追溯">
      @if (perm.can('config.interface.manage')) {
        <button nz-button nzType="primary" (click)="openCreate()">
          <span nz-icon nzType="plus"></span> 新增接口
        </button>
      }
      <button nz-button (click)="list.reload()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="card">
      <app-data-table
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [pageNum]="list.pageNum"
        [pageSize]="list.pageSize"
        [loading]="list.loading()"
        emptyText="暂无接口配置，请点击「新增接口」"
        scrollX="1280px"
        (pageChange)="list.page($event)"
      >
        <ng-template #actions let-row>
          <button nz-button nzType="link" nzSize="small" [nzLoading]="testingId() === row.id" (click)="runTest(row)">测试</button>
          <button nz-button nzType="link" nzSize="small" (click)="openLogs(row)">调用日志</button>
          @if (perm.can('config.interface.manage')) {
            <button nz-button nzType="link" nzSize="small" (click)="openEdit(row)">编辑</button>
          }
        </ng-template>
      </app-data-table>
    </div>

    <app-modal
      [(open)]="formOpen"
      [title]="editing() ? '编辑接口' : '新增接口'"
      okText="保存"
      [loading]="saving()"
      [width]="640"
      (ok)="submitForm()"
    >
      <app-schema-form [fields]="formFields" [(model)]="model" />
    </app-modal>

    <app-modal [(open)]="testOpen" title="连通性测试结果" okText="关闭" [width]="640" (ok)="testOpen.set(false)">
      @if (testResult(); as result) {
        <div class="test-result">
          <div class="test-result__head">
            <nz-tag [nzColor]="result.succeeded ? 'success' : 'error'">{{ result.succeeded ? '调用成功' : '调用失败' }}</nz-tag>
            <span class="text-secondary">接口：{{ testedName() }}</span>
          </div>
          <div class="desc-grid mt-8">
            <div class="desc-item">
              <span class="desc-item__label">状态码</span>
              <span class="desc-item__value">{{ result.statusCode ?? '-' }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">耗时</span>
              <span class="desc-item__value">{{ result.durationMs }} ms</span>
            </div>
          </div>
          @if (result.error) {
            <div class="mt-16">
              <div class="card__subtitle mb-8">错误信息</div>
              <pre class="code-block text-danger">{{ result.error }}</pre>
            </div>
          }
          @if (result.responseSnippet) {
            <div class="mt-16">
              <div class="card__subtitle mb-8">响应片段</div>
              <pre class="code-block">{{ result.responseSnippet }}</pre>
            </div>
          }
        </div>
      }
    </app-modal>

    <app-modal
      [(open)]="logOpen"
      [title]="'调用日志 · ' + (logEndpoint()?.name ?? '')"
      okText="关闭"
      [width]="960"
      (ok)="logOpen.set(false)"
    >
      <app-data-table
        [columns]="logColumns"
        [rows]="logs.rows()"
        [total]="logs.total()"
        [pageNum]="logs.pageNum"
        [pageSize]="logs.pageSize"
        [loading]="logs.loading()"
        emptyText="该接口暂无调用记录"
        scrollX="1100px"
        (pageChange)="logs.page($event)"
      />
    </app-modal>
  `,
  styles: [
    `
      .code-block {
        margin: 0;
        padding: 10px 12px;
        background: #f7f9fc;
        border: 1px solid #eef1f6;
        border-radius: 6px;
        font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
        font-size: 12.5px;
        white-space: pre-wrap;
        word-break: break-all;
        max-height: 260px;
        overflow: auto;
      }
      .test-result__head {
        display: flex;
        align-items: center;
        gap: 10px;
      }
    `,
  ],
})
export class EndpointPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  readonly perm = inject(PermissionService);

  readonly list = new PagedList<EndpointRow>((query) => this.api.get<Paged<EndpointRow>>('/admin/config/endpoints', query));

  readonly logs = new PagedList<EndpointLogRow>((query) =>
    this.api.get<Paged<EndpointLogRow>>('/admin/config/endpoints/logs', {
      ...query,
      endpointId: this.logEndpoint()?.id,
    }),
  );

  readonly columns: DataColumn<EndpointRow>[] = [
    { key: 'name', title: '名称', width: '150px' },
    { key: 'url', title: '接口地址', ellipsis: true },
    { key: 'method', title: '方法', width: '80px', type: 'tag' },
    { key: 'isEnabled', title: '启用', width: '70px', type: 'boolean' },
    { key: 'timeoutSeconds', title: '超时(秒)', width: '90px', align: 'right' },
    { key: 'maxRetries', title: '重试', width: '70px', align: 'right' },
    {
      key: 'successRate',
      title: '成功率',
      width: '110px',
      type: 'status',
      pipe: (row) => this.rateText(row),
      tone: (row) => this.rateTone(row),
    },
    { key: 'totalCalls', title: '总调用', width: '80px', align: 'right' },
    { key: 'failedCalls', title: '失败', width: '70px', align: 'right' },
  ];

  readonly logColumns: DataColumn<EndpointLogRow>[] = [
    { key: 'endpointName', title: '接口', width: '130px' },
    { key: 'method', title: '方法', width: '70px', type: 'tag' },
    { key: 'statusCode', title: '状态码', width: '80px', align: 'right' },
    { key: 'succeeded', title: '结果', width: '80px', type: 'status', map: { true: '成功', false: '失败' } },
    { key: 'durationMs', title: '耗时(ms)', width: '90px', align: 'right' },
    { key: 'error', title: '错误信息', ellipsis: true },
    { key: 'createdAt', title: '调用时间', width: '160px', type: 'datetime' },
  ];

  readonly formFields: FormField[] = [
    { key: 'name', label: '接口名称', type: 'text', required: true, span: 12, maxLength: 100 },
    {
      key: 'method',
      label: '请求方法',
      type: 'select',
      required: true,
      span: 12,
      options: [
        { value: 'GET', label: 'GET' },
        { value: 'POST', label: 'POST' },
      ],
    },
    { key: 'url', label: '接口地址', type: 'text', required: true, span: 24, placeholder: 'https://example.com/api/path' },
    { key: 'isEnabled', label: '启用调用', type: 'switch', span: 12, help: '停用后平台不再主动调用该接口' },
    { key: 'timeoutSeconds', label: '超时(秒)', type: 'number', span: 12, min: 1, max: 60 },
    { key: 'maxRetries', label: '重试次数', type: 'number', span: 12, min: 0, max: 5 },
    {
      key: 'headers',
      label: '请求头(JSON)',
      type: 'textarea',
      span: 24,
      rows: 4,
      placeholder: '{"Authorization": "Bearer xxx"}',
      help: '留空表示不附加自定义请求头；填写时必须为合法 JSON',
    },
  ];

  readonly formOpen = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<EndpointRow | null>(null);
  readonly testingId = signal<string | null>(null);
  readonly testOpen = signal(false);
  readonly testResult = signal<EndpointCallResult | null>(null);
  readonly testedName = signal('');
  readonly logOpen = signal(false);
  readonly logEndpoint = signal<EndpointDto | null>(null);

  model: Record<string, unknown> = {};

  ngOnInit(): void {
    this.list.reload();
  }

  openCreate(): void {
    this.editing.set(null);
    this.model = { name: '', method: 'GET', url: '', isEnabled: true, timeoutSeconds: 10, maxRetries: 0, headers: '' };
    this.formOpen.set(true);
  }

  openEdit(row: EndpointRow): void {
    this.editing.set(row);
    this.model = {
      name: row.name,
      method: row.method,
      url: row.url,
      isEnabled: row.isEnabled,
      timeoutSeconds: row.timeoutSeconds,
      maxRetries: row.maxRetries,
      headers: row.headers ?? '',
    };
    this.formOpen.set(true);
  }

  submitForm(): void {
    const name = String(this.model['name'] ?? '').trim();
    const url = String(this.model['url'] ?? '').trim();
    const method = String(this.model['method'] ?? 'GET');
    if (!name || !url) {
      this.message.warning('请填写接口名称与地址');
      return;
    }
    const headers = String(this.model['headers'] ?? '').trim();
    if (headers) {
      try {
        JSON.parse(headers);
      } catch {
        this.message.error('请求头必须是合法的 JSON 文本');
        return;
      }
    }

    const body: CreateEndpointRequest = {
      name,
      url,
      method,
      isEnabled: !!this.model['isEnabled'],
      timeoutSeconds: Number(this.model['timeoutSeconds'] ?? 10),
      maxRetries: Number(this.model['maxRetries'] ?? 0),
      headers: headers,
    };

    this.saving.set(true);
    const current = this.editing();
    const request = current
      ? this.api.put<EndpointDto>(`/admin/config/endpoints/${current.id}`, body as UpdateEndpointRequest)
      : this.api.post<EndpointDto>('/admin/config/endpoints', body);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.message.success(current ? '接口已更新' : '接口已创建');
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  runTest(row: EndpointRow): void {
    this.testingId.set(row.id);
    this.api.post<EndpointCallResult>(`/admin/config/endpoints/${row.id}/test`).subscribe({
      next: (result) => {
        this.testingId.set(null);
        this.testedName.set(row.name);
        this.testResult.set(result);
        this.testOpen.set(true);
        this.list.reload();
      },
      error: () => this.testingId.set(null),
    });
  }

  openLogs(row: EndpointRow): void {
    this.logEndpoint.set(row);
    this.logOpen.set(true);
    this.logs.filter({});
  }

  private rateText(row: EndpointRow): string {
    if (!row.totalCalls) return '暂无调用';
    return `${(Number(row.successRate) * 100).toFixed(2)}%`;
  }

  private rateTone(row: EndpointRow): string {
    if (!row.totalCalls) return 'default';
    return Number(row.successRate) < 0.95 ? 'error' : 'success';
  }
}

