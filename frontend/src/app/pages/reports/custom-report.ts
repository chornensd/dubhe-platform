import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { ApiService } from '../../core/api.service';
import {
  CreateReportTemplateRequest,
  OrderPaymentStatusNameText,
  OrderStatusNameText,
  Paged,
  ReportFieldDefDto,
  ReportFilterDto,
  ReportRunRequest,
  ReportRunResultDto,
  ReportTemplateDto,
} from '../../core/api-types';
import { dictOptions } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent } from '../../shared/data-table';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';

type ReportRow = Record<string, unknown>;
type TemplateRow = ReportTemplateDto & Record<string, unknown>;
type ColumnType = DataColumn<ReportRow>['type'];

@Component({
  selector: 'app-custom-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzEmptyModule,
    NzIconModule,
    NzSelectModule,
    NzSpinModule,
    PageHeaderComponent,
    DataTableComponent,
    ModalComponent,
    SchemaFormComponent,
  ],
  template: `
    <app-page-header title="自定义报表" subtitle="勾选字段与筛选条件生成订单报表，支持导出 Excel 与另存为模板">
      <button nz-button nzType="primary" [nzLoading]="running()" (click)="run()">
        <span nz-icon nzType="play-circle"></span> 运行
      </button>
      @if (perm.can('report.export')) {
        <button nz-button [nzLoading]="exporting()" [disabled]="!result()" (click)="exportExcel()">
          <span nz-icon nzType="download"></span> 导出 Excel
        </button>
      }
      <button nz-button [disabled]="!selectedFields().length" (click)="openSave()">
        <span nz-icon nzType="save"></span> 另存为模板
      </button>
    </app-page-header>

    @if (appliedTemplate()) {
      <div class="text-secondary mb-8">已载入模板：{{ appliedTemplate() }}，可调整字段与筛选后重新运行</div>
    }

    <div class="report-layout">
      <div class="card report-fields">
        <div class="card__title">
          字段选择
          <span class="card__subtitle">已选 {{ selectedFields().length }} / {{ fieldDefs().length }}</span>
        </div>
        @if (fieldLoading()) {
          <div class="page-loading"><nz-spin nzSimple /></div>
        } @else if (fieldDefs().length) {
          <div class="filter-bar">
            <button nz-button nzSize="small" (click)="selectAllFields()">全选</button>
            <button nz-button nzSize="small" (click)="clearFields()">清空</button>
          </div>
          <nz-checkbox-group
            [nzOptions]="fieldOptions()"
            [ngModel]="selectedFields()"
            (ngModelChange)="onFieldsChange($event)"
          />
        } @else {
          <nz-empty nzNotFoundContent="暂无可用字段" />
        }
      </div>

      <div>
        <div class="card">
          <div class="card__title">筛选条件</div>
          <div class="filter-bar">
            <nz-range-picker
              nzFormat="yyyy-MM-dd"
              nzPlaceHolder="订单创建时间范围"
              [ngModel]="range()"
              (ngModelChange)="onRangeChange($event)"
            />
            <nz-select
              style="width: 170px"
              nzPlaceHolder="全部状态"
              nzAllowClear
              [ngModel]="statusFilter()"
              (ngModelChange)="onStatusChange($event)"
            >
              @for (item of statusOptions; track item.value) {
                <nz-option [nzValue]="item.value" [nzLabel]="item.label" />
              }
            </nz-select>
            <button nz-button (click)="resetFilters()">重置</button>
            <span class="filter-bar__spacer"></span>
            <span class="text-secondary">业务类型：订单</span>
          </div>
        </div>

        <div class="card mt-16">
          <div class="card__title">
            结果预览
            @if (result(); as r) {
              <span class="card__subtitle">共 {{ r.total }} 行 · 合计金额 ¥ {{ r.totalAmount | number: '1.2-2' }}</span>
            }
          </div>
          @if (running()) {
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
            <div class="text-secondary">左侧勾选字段并设置筛选条件后，点击右上角「运行」生成报表。</div>
          }
        </div>
      </div>
    </div>

    <app-modal [(open)]="saveOpen" title="另存为模板" okText="保存模板" [loading]="saving()" (ok)="saveTemplate()">
      <app-schema-form [fields]="saveFields()" [(model)]="saveModel" />
    </app-modal>
  `,
  styles: [
    `
      .report-layout {
        display: grid;
        grid-template-columns: 300px minmax(0, 1fr);
        gap: 16px;
      }
      @media (max-width: 1100px) {
        .report-layout {
          grid-template-columns: 1fr;
        }
      }
      .report-fields {
        align-self: start;
      }
      .report-fields ::ng-deep .ant-checkbox-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 520px;
        overflow: auto;
      }
    `,
  ],
})
export class CustomReportPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  readonly perm = inject(PermissionService);

  readonly fieldDefs = signal<ReportFieldDefDto[]>([]);
  readonly fieldLoading = signal(false);
  readonly selectedFields = signal<string[]>([]);
  readonly statusFilter = signal<string | null>(null);
  readonly range = signal<Date[] | null>(null);
  readonly result = signal<ReportRunResultDto | null>(null);
  readonly running = signal(false);
  readonly exporting = signal(false);
  readonly saving = signal(false);
  readonly saveOpen = signal(false);
  readonly appliedTemplate = signal('');

  readonly statusOptions = dictOptions(OrderStatusNameText);

  saveModel: Record<string, unknown> = {};

  readonly fieldOptions = computed(() => this.fieldDefs().map((field) => ({ label: field.name, value: field.key })));

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

  readonly saveFields = computed<FormField[]>(() => {
    const fields: FormField[] = [
      { key: 'name', label: '模板名称', type: 'text', required: true, span: 24, maxLength: 60, placeholder: '如：近 7 天订单明细' },
    ];
    if (this.perm.can('report.share')) {
      fields.push({ key: 'isShared', label: '共享给其他用户', type: 'switch', span: 24 });
    }
    fields.push({ key: 'remark', label: '备注', type: 'textarea', span: 24, maxLength: 200 });
    return fields;
  });

  ngOnInit(): void {
    this.loadFields();
    const templateId = this.route.snapshot.queryParamMap.get('templateId');
    if (templateId) this.applyTemplate(templateId);
  }

  loadFields(): void {
    this.fieldLoading.set(true);
    this.api.get<ReportFieldDefDto[]>('/reports/fields', { businessType: 'order' }).subscribe({
      next: (fields) => {
        this.fieldDefs.set(fields ?? []);
        if (!this.selectedFields().length) {
          this.selectedFields.set((fields ?? []).map((field) => field.key));
        }
        this.fieldLoading.set(false);
      },
      error: () => this.fieldLoading.set(false),
    });
  }

  onFieldsChange(values: Array<string | number>): void {
    this.selectedFields.set((values ?? []).map(String));
  }

  onRangeChange(value: Date[] | null): void {
    this.range.set(value && value.length === 2 ? value : null);
  }

  onStatusChange(value: string | null): void {
    this.statusFilter.set(value ?? null);
  }

  selectAllFields(): void {
    this.selectedFields.set(this.fieldDefs().map((field) => field.key));
  }

  clearFields(): void {
    this.selectedFields.set([]);
  }

  resetFilters(): void {
    this.range.set(null);
    this.statusFilter.set(null);
  }

  run(): void {
    if (!this.selectedFields().length) {
      this.message.warning('请至少选择一个报表字段');
      return;
    }
    this.running.set(true);
    this.api.post<ReportRunResultDto>('/reports/run', this.buildRequest()).subscribe({
      next: (result) => {
        this.result.set(result);
        this.running.set(false);
        this.message.success('报表已生成');
      },
      error: () => this.running.set(false),
    });
  }

  exportExcel(): void {
    if (!this.result()) {
      this.message.warning('请先运行报表再导出');
      return;
    }
    this.exporting.set(true);
    this.api.downloadPost('/reports/export', this.buildRequest(), 'report.xlsx').subscribe({
      next: () => {
        this.exporting.set(false);
        this.message.success('导出文件已开始下载');
      },
      error: () => this.exporting.set(false),
    });
  }

  openSave(): void {
    if (!this.selectedFields().length) {
      this.message.warning('请至少选择一个报表字段');
      return;
    }
    this.saveModel = {
      name: this.appliedTemplate() ? `${this.appliedTemplate()} 副本` : '订单报表',
      isShared: false,
      remark: '',
    };
    this.saveOpen.set(true);
  }

  saveTemplate(): void {
    const name = String(this.saveModel['name'] ?? '').trim();
    if (!name) {
      this.message.warning('请填写模板名称');
      return;
    }
    this.saving.set(true);
    const body: CreateReportTemplateRequest = {
      name,
      businessType: 'order',
      fields: this.selectedFields(),
      filters: this.buildFilters(),
      isShared: this.perm.can('report.share') && !!this.saveModel['isShared'],
      remark: (this.saveModel['remark'] as string) || null,
    };
    this.api.post<ReportTemplateDto>('/reports/templates', body).subscribe({
      next: (template) => {
        this.saving.set(false);
        this.saveOpen.set(false);
        this.message.success(`模板「${template?.name ?? name}」已保存`);
      },
      error: () => this.saving.set(false),
    });
  }

  private applyTemplate(templateId: string): void {
    this.api
      .get<Paged<TemplateRow>>('/reports/templates', { pageNum: 1, pageSize: 100, includeShared: true })
      .subscribe({
        next: (page) => {
          const template = (page.items ?? []).find((item) => item.id === templateId);
          if (!template) {
            this.message.warning('未找到该模板，可能已被删除');
            return;
          }
          this.selectedFields.set([...(template.fields ?? [])]);
          this.statusFilter.set(template.filters?.status ?? null);
          this.range.set(this.toRange(template.filters));
          this.appliedTemplate.set(template.name);
        },
        error: () => undefined,
      });
  }

  private toRange(filters: ReportFilterDto | null | undefined): Date[] | null {
    const from = filters?.from ? new Date(filters.from) : null;
    const to = filters?.to ? new Date(filters.to) : null;
    if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
    return [from, to];
  }

  private buildRequest(): ReportRunRequest {
    return { businessType: 'order', fields: this.selectedFields(), filters: this.buildFilters() };
  }

  private buildFilters(): ReportFilterDto {
    const values = this.range();
    const from = values?.[0] ?? null;
    const to = values?.[1] ?? null;
    return {
      from: from ? this.toIso(from, false) : null,
      to: to ? this.toIso(to, true) : null,
      status: this.statusFilter(),
    };
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

  private toIso(date: Date, endOfDay: boolean): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    if (endOfDay) return `${day}T23:59:59`;
    return `${day}T00:00:00`;
  }
}
