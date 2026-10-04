import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ApiService } from '../../core/api.service';
import {
  InvoiceDto,
  InvoiceStatus,
  InvoiceStatusNameText,
  OrderListItemDto,
  Paged,
} from '../../core/api-types';
import { ConfirmService } from '../../core/confirm.service';
import { PagedList } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent } from '../../shared/data-table';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';

type InvoiceRow = InvoiceDto & Record<string, unknown>;

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzSelectModule,
    DataTableComponent,
    ModalComponent,
    PageHeaderComponent,
    SchemaFormComponent,
  ],
  template: `
    <app-page-header title="发票管理" subtitle="基于已送达并已支付的订单申请开票，平台管理员可开具或驳回">
      @if (perm.can('order.invoice.apply')) {
        <button nz-button nzType="primary" (click)="openApply()"><span nz-icon nzType="plus"></span> 申请开票</button>
      }
      <button nz-button (click)="list.reload()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="card">
      <div class="filter-bar">
        <nz-select style="width: 150px" nzPlaceHolder="全部状态" nzAllowClear [ngModel]="status()" (ngModelChange)="onStatus($event)">
          @for (item of statusOptions; track item.value) {
            <nz-option [nzValue]="item.value" [nzLabel]="item.label" />
          }
        </nz-select>
        <span class="filter-bar__spacer"></span>
        <span class="text-secondary">共 {{ list.total() }} 条申请</span>
      </div>

      <app-data-table
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [pageNum]="list.pageNum"
        [pageSize]="list.pageSize"
        [loading]="list.loading()"
        emptyText="暂无发票申请"
        scrollX="1280px"
        (pageChange)="list.page($event)"
      >
        <ng-template #actions let-row>
          @if (row.fileUrl) {
            <a nz-button nzType="link" nzSize="small" [href]="row.fileUrl" target="_blank" rel="noopener noreferrer">查看文件</a>
          }
          @if (row.status === 'Submitted' && perm.can('order.invoice.manage')) {
            <button nz-button nzType="link" nzSize="small" (click)="openIssue(row)">开具</button>
            <button nz-button nzType="link" nzSize="small" nzDanger (click)="reject(row)">驳回</button>
          }
        </ng-template>
      </app-data-table>
    </div>

    <app-modal [(open)]="applyOpen" title="申请开票" okText="提交申请" [loading]="saving()" [width]="720" (ok)="submitApply()">
      <app-schema-form [fields]="applyFields()" [(model)]="applyModel" />
      <div class="text-secondary">
        已选 {{ selectedCount() }} 单，开票金额合计 ¥ {{ selectedAmount() | number: '1.2-2' }}；仅已送达且已支付的订单可通过平台校验。
      </div>
    </app-modal>

    <app-modal [(open)]="issueOpen" title="开具发票" okText="确认开具" [loading]="saving()" (ok)="submitIssue()">
      <app-schema-form [fields]="issueFields" [(model)]="issueModel" />
    </app-modal>
  `,
})
export class InvoiceListPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  readonly perm = inject(PermissionService);

  readonly status = signal<number | null>(null);
  readonly applyOpen = signal(false);
  readonly issueOpen = signal(false);
  readonly saving = signal(false);
  readonly deliveredOrders = signal<OrderListItemDto[]>([]);

  private current?: InvoiceDto;

  applyModel: Record<string, unknown> = { orderIds: [], title: '', taxNo: '', remark: '' };
  issueModel: Record<string, unknown> = { invoiceNo: '', fileUrl: '' };

  readonly statusOptions = [
    { value: InvoiceStatus.Submitted, label: '已提交' },
    { value: InvoiceStatus.Issued, label: '已开具' },
    { value: InvoiceStatus.Rejected, label: '已驳回' },
  ];

  readonly issueFields: FormField[] = [
    { key: 'invoiceNo', label: '发票编号', type: 'text', required: true, span: 24, placeholder: '请输入发票号码', maxLength: 50 },
    { key: 'fileUrl', label: '文件链接', type: 'text', span: 24, placeholder: '发票文件链接（可选）', maxLength: 500 },
  ];

  readonly applyFields = computed<FormField[]>(() => [
    {
      key: 'orderIds',
      label: '关联订单',
      type: 'multiselect',
      required: true,
      span: 24,
      placeholder: '选择需要开票的已送达订单',
      options: this.deliveredOrders().map((order) => ({
        value: order.id,
        label: `${order.orderNo} · ${order.receiverName} · ¥ ${order.totalAmount}`,
      })),
    },
    { key: 'title', label: '发票抬头', type: 'text', required: true, span: 24, placeholder: '请输入发票抬头', maxLength: 100 },
    { key: 'taxNo', label: '税号', type: 'text', required: true, span: 24, placeholder: '请输入纳税人识别号', maxLength: 50 },
    { key: 'remark', label: '备注', type: 'textarea', span: 24, maxLength: 200 },
  ]);

  selectedCount(): number {
    const ids = this.applyModel['orderIds'];
    return Array.isArray(ids) ? ids.length : 0;
  }

  selectedAmount(): number {
    const ids = this.applyModel['orderIds'];
    if (!Array.isArray(ids)) return 0;
    return this.deliveredOrders()
      .filter((order) => ids.includes(order.id))
      .reduce((sum, order) => sum + Number(order.totalAmount ?? 0), 0);
  }

  readonly list = new PagedList<InvoiceRow>((query) =>
    this.api.get<Paged<InvoiceRow>>('/invoices', { ...query, status: this.status() ?? undefined }),
  );

  readonly columns: DataColumn<InvoiceRow>[] = [
    { key: 'title', title: '发票抬头', width: '180px', ellipsis: true },
    { key: 'taxNo', title: '税号', width: '180px' },
    { key: 'amount', title: '开票金额', width: '120px', type: 'money', align: 'right' },
    { key: 'orderCount', title: '关联订单数', width: '110px', align: 'right', pipe: (row) => (row.orderIds ?? []).length },
    { key: 'status', title: '状态', width: '100px', type: 'status', map: InvoiceStatusNameText },
    { key: 'invoiceNo', title: '发票编号', width: '160px', pipe: (row) => row.invoiceNo || '-' },
    { key: 'createdAt', title: '申请时间', width: '150px', type: 'datetime' },
  ];

  ngOnInit(): void {
    this.list.reload();
  }

  onStatus(value: number | null): void {
    this.status.set(value);
    this.list.filter({});
  }

  openApply(): void {
    this.applyModel = { orderIds: [], title: '', taxNo: '', remark: '' };
    this.loadDeliveredOrders();
    this.applyOpen.set(true);
  }

  submitApply(): void {
    const ids = this.applyModel['orderIds'];
    const orderIds = Array.isArray(ids) ? (ids as string[]) : [];
    if (!orderIds.length) {
      this.message.warning('请选择需要开票的订单');
      return;
    }
    if (orderIds.length > 50) {
      this.message.warning('单次最多为 50 个订单申请开票');
      return;
    }
    const title = String(this.applyModel['title'] ?? '').trim();
    const taxNo = String(this.applyModel['taxNo'] ?? '').trim();
    if (!title || !taxNo) {
      this.message.warning('请填写发票抬头与税号');
      return;
    }
    this.saving.set(true);
    this.api
      .post<InvoiceDto>('/invoices', {
        orderIds,
        title,
        taxNo,
        remark: (this.applyModel['remark'] as string) || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.applyOpen.set(false);
          this.message.success('发票申请已提交，等待平台办理');
          this.list.reload();
        },
        error: () => this.saving.set(false),
      });
  }

  openIssue(row: InvoiceRow): void {
    this.current = row;
    this.issueModel = { invoiceNo: '', fileUrl: '' };
    this.issueOpen.set(true);
  }

  submitIssue(): void {
    if (!this.current) return;
    const invoiceNo = String(this.issueModel['invoiceNo'] ?? '').trim();
    if (!invoiceNo) {
      this.message.warning('请填写发票编号');
      return;
    }
    this.saving.set(true);
    this.api
      .post<InvoiceDto>(`/invoices/${this.current.id}/issue`, {
        invoiceNo,
        fileUrl: (this.issueModel['fileUrl'] as string) || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.issueOpen.set(false);
          this.message.success('发票已开具');
          this.list.reload();
        },
        error: () => this.saving.set(false),
      });
  }

  reject(row: InvoiceRow): void {
    this.confirm
      .prompt({ title: `驳回发票申请：${row.title}`, placeholder: '请填写驳回原因', danger: true })
      .subscribe((reason) => {
        if (!reason) return;
        this.api.post<InvoiceDto>(`/invoices/${row.id}/reject`, { reason }).subscribe(() => {
          this.message.success('发票申请已驳回');
          this.list.reload();
        });
      });
  }

  private loadDeliveredOrders(): void {
    this.api.get<Paged<OrderListItemDto>>('/orders', { status: 4, pageNum: 1, pageSize: 100 }).subscribe({
      next: (page) => this.deliveredOrders.set(page.items ?? []),
      error: () => this.deliveredOrders.set([]),
    });
  }
}

