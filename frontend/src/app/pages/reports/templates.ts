import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { ApiService } from '../../core/api.service';
import {
  OrderPaymentStatusNameText,
  OrderStatusNameText,
  Paged,
  ReportFieldDefDto,
  ReportFilterDto,
  ReportRunRequest,
  ReportRunResultDto,
  ReportTemplateDto,
  UpdateReportTemplateRequest,
} from '../../core/api-types';
import { ConfirmService } from '../../core/confirm.service';
import { dictOptions, PagedList } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent } from '../../shared/data-table';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';

type TemplateRow = ReportTemplateDto & Record<string, unknown>;
type ReportRow = Record<string, unknown>;
type ColumnType = DataColumn<ReportRow>['type'];

@Component({
  selector: 'app-templates',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDrawerModule,
    NzEmptyModule,
    NzIconModule,
    NzSpinModule,
    PageHeaderComponent,
    DataTableComponent,
    ModalComponent,
    SchemaFormComponent,
  ],
  template: `
    <app-page-header title="报表模板" subtitle="保存的字段与筛选组合，可运行查看、编辑、删除或应用到自定义报表">
      <label nz-checkbox [ngModel]="includeShared()" (ngModelChange)="onIncludeShared($event)">包含共享模板</label>
      <button nz-button (click)="list.reload()" [nzLoading]="list.loading()">
        <span nz-icon nzType="reload"></span> 刷新
      </button>
    </app-page-header>

    <div class="card">
      <app-data-table
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [pageNum]="list.pageNum"
        [pageSize]="list.pageSize"
        [loading]="list.loading()"
        scrollX="1080px"
        emptyText="暂无报表模板，可前往「自定义报表」运行后另存为模板"
        (pageChange)="list.page($event)"
      >
        <ng-template #actions let-row>
          <button nz-button nzType="link" nzSize="small" (click)="runTemplate(row)">运行</button>
          <button nz-button nzType="link" nzSize="small" (click)="apply(row)">应用</button>
          <button nz-button nzType="link" nzSize="small" (click)="openEdit(row)">编辑</button>
          <button nz-button nzType="link" nzSize="small" nzDanger (click)="remove(row)">删除</button>
        </ng-template>
      </app-data-table>
    </div>

    <app-modal [(open)]="editOpen" title="编辑模板" okText="保存" [loading]="saving()" [width]="720" (ok)="submitEdit()">
      <app-schema-form [fields]="editFields()" [(model)]="editModel" />
    </app-modal>

    <nz-drawer [nzVisible]="drawerOpen()" [nzWidth]="900" [nzTitle]="runTitle()" (nzOnClose)="drawerOpen.set(false)">
      <ng-container *nzDrawerContent>
        <div class="filter-bar">
          @if (perm.can('report.export')) {
            <button nz-button [disabled]="!result()" (click)="exportResult()">
              <span nz-icon nzType="download"></span> 导出 Excel
            </button>
          }
          <button nz-button [nzLoading]="runLoading()" (click)="executeRun()">
            <span nz-icon nzType="reload"></span> 重新运行
          </button>
          <span class="filter-bar__spacer"></span>
          @if (result(); as r) {
            <span class="text-secondary">共 {{ r.total }} 行 · 合计金额 ¥ {{ r.totalAmount | number: '1.2-2' }}</span>
          }
        </div>
        @if (runLoading()) {
          <div class="page-loading"><nz-spin nzSimple /></div>
        } @else if (result(); as r) {
          <app-data-table
            [columns]="resultColumns()"
            [rows]="r.rows"
            [total]="r.rows.length"
            [pageNum]="1"
            [pageSize]="r.rows.length || 10"
            emptyText="当前条件下没有数据"
          />
        } @else {
          <div class="card"><nz-empty nzNotFoundContent="暂无运行结果" /></div>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class ReportTemplatePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  readonly perm = inject(PermissionService);

  readonly includeShared = signal(false);
  readonly fieldDefs = signal<ReportFieldDefDto[]>([]);
  readonly editOpen = signal(false);
  readonly saving = signal(false);
  readonly drawerOpen = signal(false);
  readonly runLoading = signal(false);
  readonly runTitle = signal('');
  readonly result = signal<ReportRunResultDto | null>(null);

  readonly statusOptions = dictOptions(OrderStatusNameText);

  editModel: Record<string, unknown> = {};
  private editing: TemplateRow | null = null;
  private runBody: ReportRunRequest | null = null;

  readonly list = new PagedList<TemplateRow>((query) =>
    this.api.get<Paged<TemplateRow>>('/reports/templates', { ...query, includeShared: this.includeShared() }),
  );

  readonly columns: DataColumn<TemplateRow>[] = [
    { key: 'name', title: '模板名称', ellipsis: true },
    { key: 'businessType', title: '业务类型', width: '110px', pipe: (row) => this.businessText(row.businessType) },
    { key: 'fieldCount', title: '字段数', width: '90px', align: 'right', pipe: (row) => row.fields?.length ?? 0 },
    { key: 'isShared', title: '共享', width: '80px', type: 'boolean' },
    { key: 'remark', title: '备注', width: '180px', ellipsis: true, pipe: (row) => row.remark ?? '-' },
    { key: 'createdAt', title: '创建时间', width: '150px', type: 'datetime' },
    { key: 'updatedAt', title: '更新时间', width: '150px', type: 'datetime' },
  ];

  readonly fieldOptions = computed(() => this.fieldDefs().map((field) => ({ label: field.name, value: field.key })));

  readonly editFields = computed<FormField[]>(() => {
    const fields: FormField[] = [
      { key: 'name', label: '模板名称', type: 'text', required: true, span: 24, maxLength: 60 },
      { key: 'fields', label: '包含字段', type: 'multiselect', required: true, span: 24, options: this.fieldOptions() },
    ];
    if (this.perm.can('report.share')) {
      fields.push({ key: 'isShared', label: '共享给其他用户', type: 'switch', span: 24 });
    }
    fields.push(
      { key: 'filters.from', label: '开始时间', type: 'datetime', span: 12 },
      { key: 'filters.to', label: '结束时间', type: 'datetime', span: 12 },
      { key: 'filters.status', label: '订单状态', type: 'select', span: 12, options: this.statusOptions, placeholder: '全部状态' },
      { key: 'remark', label: '备注', type: 'textarea', span: 24, maxLength: 200 },
    );
    return fields;
  });

  readonly resultColumns = computed<DataColumn<ReportRow>[]>(() =>
    (this.result()?.columns ?? []).map((column) => {
      const type = this.columnType(column.key, column.type);
      return {
        key: column.key,
        title: column.name,
        type,
        align: type === 'money' ? 'right' : 'left',
        map: this.statusMap(column.key, type),
      };
    }),
  );

  ngOnInit(): void {
    this.list.reload();
    this.loadFields();
  }

  onIncludeShared(value: boolean): void {
    this.includeShared.set(value);
    this.list.filter({});
  }

  runTemplate(row: TemplateRow): void {
    this.runTitle.set(`模板运行：${row.name}`);
    this.runBody = { businessType: row.businessType, fields: [...(row.fields ?? [])], filters: row.filters ?? {} };
    this.result.set(null);
    this.drawerOpen.set(true);
    this.executeRun();
  }

  executeRun(): void {
    if (!this.runBody) return;
    this.runLoading.set(true);
    this.api.post<ReportRunResultDto>('/reports/run', this.runBody).subscribe({
      next: (result) => {
        this.result.set(result);
        this.runLoading.set(false);
        this.message.success('报表已生成');
      },
      error: () => this.runLoading.set(false),
    });
  }

  exportResult(): void {
    if (!this.runBody) return;
    this.api.downloadPost('/reports/export', this.runBody, 'report.xlsx').subscribe({
      next: () => this.message.success('导出文件已开始下载'),
      error: () => undefined,
    });
  }

  apply(row: TemplateRow): void {
    void this.router.navigate(['/reports/custom'], { queryParams: { templateId: row.id } });
  }

  openEdit(row: TemplateRow): void {
    this.editing = row;
    this.editModel = {
      name: row.name,
      fields: [...(row.fields ?? [])],
      isShared: row.isShared,
      filters: {
        from: row.filters?.from ?? null,
        to: row.filters?.to ?? null,
        status: row.filters?.status ?? null,
      },
      remark: row.remark ?? '',
    };
    this.editOpen.set(true);
  }

  submitEdit(): void {
    const editing = this.editing;
    if (!editing) return;
    const model = this.editModel;
    const filters = (model['filters'] ?? {}) as ReportFilterDto;
    const body: UpdateReportTemplateRequest = {
      name: String(model['name'] ?? '').trim(),
      fields: (model['fields'] as string[]) ?? [],
      filters: { from: filters.from ?? null, to: filters.to ?? null, status: filters.status ?? null },
      remark: (model['remark'] as string) || null,
    };
    if (this.perm.can('report.share')) body.isShared = !!model['isShared'];
    this.saving.set(true);
    this.api.put<ReportTemplateDto>(`/reports/templates/${editing.id}`, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.editOpen.set(false);
        this.message.success('模板已更新');
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  remove(row: TemplateRow): void {
    this.confirm
      .open({ title: '删除模板', content: `确认删除模板「${row.name}」？删除后不可恢复。`, danger: true })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.del<void>(`/reports/templates/${row.id}`).subscribe({
          next: () => {
            this.message.success('模板已删除');
            this.list.reload();
          },
          error: () => undefined,
        });
      });
  }

  private loadFields(): void {
    this.api.get<ReportFieldDefDto[]>('/reports/fields', { businessType: 'order' }).subscribe({
      next: (fields) => this.fieldDefs.set(fields ?? []),
      error: () => undefined,
    });
  }

  private businessText(type: string): string {
    return type === 'order' ? '订单' : type;
  }

  private columnType(key: string, type: string): ColumnType {
    const value = (type ?? '').toLowerCase();
    if (['money', 'amount', 'decimal', 'currency'].includes(value)) return 'money';
    if (['datetime', 'timestamp'].includes(value)) return 'datetime';
    if (value === 'date') return 'date';
    if (['percent', 'percentage'].includes(value)) return 'percent';
    if (['boolean', 'bool'].includes(value)) return 'boolean';
    if (['status', 'enum'].includes(value) || /status|method/.test(key.toLowerCase())) return 'status';
    return 'text';
  }

  private statusMap(key: string, type: ColumnType): Record<string, string> | undefined {
    if (type !== 'status') return undefined;
    if (/payment/i.test(key)) return OrderPaymentStatusNameText;
    return OrderStatusNameText;
  }
}
