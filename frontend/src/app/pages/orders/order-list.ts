import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ApiService } from '../../core/api.service';
import {
  CrewDto,
  DroneDto,
  OrderDto,
  OrderListItemDto,
  OrderStatus,
  OrderStatusNameText,
  Paged,
} from '../../core/api-types';
import { ConfirmService } from '../../core/confirm.service';
import { PagedList } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent } from '../../shared/data-table';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';

type OrderRow = OrderListItemDto & Record<string, unknown>;

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzDatePickerModule,
    DataTableComponent,
    PageHeaderComponent,
    ModalComponent,
    SchemaFormComponent,
  ],
  template: `
    <app-page-header title="订单列表" subtitle="低空配送订单全流程跟踪：接单、调度、飞行、送达与评价">
      @if (perm.can('order.create')) {
        <button nz-button nzType="primary" (click)="goto('/orders/create')">
          <span nz-icon nzType="plus"></span> 新建订单
        </button>
        <button nz-button (click)="goto('/orders/import')"><span nz-icon nzType="upload"></span> 批量导入</button>
      }
      @if (perm.can('order.accept')) {
        <button nz-button (click)="goto('/orders/auto-accept')"><span nz-icon nzType="thunderbolt"></span> 自动接单</button>
      }
      <button nz-button (click)="list.reload()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="card">
      <div class="filter-bar">
        <nz-select
          style="width: 150px"
          nzPlaceHolder="全部状态"
          nzAllowClear
          [nzOptions]="statusOptions"
          [ngModel]="status()"
          (ngModelChange)="onStatus($event)"
        ></nz-select>
        <input nz-input style="width: 240px" placeholder="订单号 / 物品 / 收件人" [ngModel]="keyword()" (ngModelChange)="keyword.set($event)" (keyup.enter)="search()" />
        <nz-date-picker
          nzShowTime
          nzFormat="yyyy-MM-dd HH:mm"
          nzPlaceHolder="创建时间起"
          [ngModel]="from()"
          (ngModelChange)="from.set($event)"
        />
        <nz-date-picker
          nzShowTime
          nzFormat="yyyy-MM-dd HH:mm"
          nzPlaceHolder="创建时间止"
          [ngModel]="to()"
          (ngModelChange)="to.set($event)"
        />
        <button nz-button nzType="primary" (click)="search()"><span nz-icon nzType="search"></span> 查询</button>
        <button nz-button (click)="reset()">重置</button>
        <span class="filter-bar__spacer"></span>
        <span class="text-secondary">共 {{ list.total() }} 单</span>
      </div>

      <app-data-table
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [pageNum]="list.pageNum"
        [pageSize]="list.pageSize"
        [loading]="list.loading()"
        scrollX="1480px"
        (pageChange)="list.page($event)"
        (rowClick)="open($event)"
      >
        <ng-template #actions let-row>
          <button nz-button nzType="link" nzSize="small" (click)="open(row)">详情</button>
          @if (row.status === 'PendingAccept' && perm.can('order.accept')) {
            <button nz-button nzType="link" nzSize="small" (click)="accept(row)">接单</button>
            <button nz-button nzType="link" nzSize="small" nzDanger (click)="reject(row)">拒单</button>
          }
          @if (row.status === 'PendingDispatch' && perm.can('order.dispatch')) {
            <button nz-button nzType="link" nzSize="small" (click)="openDispatch(row)">派单</button>
          }
          @if ((row.status === 'PendingAccept' || row.status === 'PendingDispatch') && perm.can('order.read')) {
            <button nz-button nzType="link" nzSize="small" nzDanger (click)="cancel(row)">取消</button>
          }
        </ng-template>
      </app-data-table>
    </div>

    <app-modal
      [(open)]="dispatchOpen"
      title="订单调度"
      okText="下发调度"
      [loading]="saving()"
      [width]="680"
      (ok)="submitDispatch()"
    >
      <app-schema-form #dispatchForm [fields]="dispatchFields()" [(model)]="dispatchModel" />
    </app-modal>

  `,
})
export class OrderListPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  readonly perm = inject(PermissionService);

  readonly status = signal<number | null>(null);
  readonly keyword = signal('');
  readonly from = signal<Date | null>(null);
  readonly to = signal<Date | null>(null);
  readonly saving = signal(false);

  readonly dispatchOpen = signal(false);

  dispatchModel: Record<string, unknown> = { waypoints: [] };

  private current?: OrderListItemDto;
  private readonly drones = signal<DroneDto[]>([]);
  private readonly crew = signal<CrewDto[]>([]);

  readonly list = new PagedList<OrderRow>((query) =>
    this.api.get<Paged<OrderRow>>('/orders', {
      ...query,
      status: this.status() ?? undefined,
      keyword: this.keyword() || undefined,
      createdFrom: this.from() ? this.toIso(this.from()!) : undefined,
      createdTo: this.to() ? this.toIso(this.to()!) : undefined,
    }),
  );

  readonly columns: DataColumn<OrderRow>[] = [
    { key: 'orderNo', title: '订单号', width: '195px' },
    { key: 'status', title: '状态', width: '100px', type: 'status', map: OrderStatusNameText },
    {
      key: 'urgent',
      title: '加急',
      width: '70px',
      pipe: (row) => (row.isUrgent ? '加急' : '普通'),
      type: 'tag',
    },
    { key: 'itemName', title: '物品', width: '120px' },
    { key: 'receiverName', title: '收件人', width: '100px' },
    { key: 'receiverAddress', title: '收件地址', width: '230px', ellipsis: true },
    { key: 'merchantName', title: '运营商家', width: '140px', pipe: (row) => row.merchantName ?? '-' },
    { key: 'weightKg', title: '重量(kg)', width: '90px', align: 'right' },
    { key: 'totalAmount', title: '金额', width: '110px', type: 'money', align: 'right' },
    { key: 'createdAt', title: '创建时间', width: '150px', type: 'datetime' },
  ];

  readonly statusOptions = [
    { value: OrderStatus.PendingAccept, label: '待接单' },
    { value: OrderStatus.PendingDispatch, label: '待调度' },
    { value: OrderStatus.InFlight, label: '飞行中' },
    { value: OrderStatus.Delivered, label: '已送达' },
    { value: OrderStatus.Cancelled, label: '已取消' },
  ];



  readonly dispatchFields = computed<FormField[]>(() => [
    {
      key: 'droneId',
      label: '执行飞行器',
      type: 'select',
      required: true,
      span: 24,
      placeholder: '选择飞行器（仅闲置且维保正常）',
      options: this.drones().map((d) => ({ value: d.id, label: `${d.serialNo} · ${d.model} · 电量${d.batteryPercent}%` })),
    },
    {
      key: 'pilotId',
      label: '执行机长',
      type: 'select',
      span: 24,
      placeholder: '选择机长（可选）',
      options: this.crew()
        .filter((c) => c.role === 'Pilot')
        .map((c) => ({ value: c.id, label: c.name })),
    },
    { key: 'waypoints', label: '规划航点', type: 'waypoints', span: 24, help: '留空则由系统按起终点直连' },
    { key: 'remark', label: '调度备注', type: 'textarea', span: 24, maxLength: 200 },
  ]);

  ngOnInit(): void {
    this.list.reload();
    this.loadDispatchOptions();
  }

  search(): void {
    this.list.filter({});
  }

  reset(): void {
    this.status.set(null);
    this.keyword.set('');
    this.from.set(null);
    this.to.set(null);
    this.list.filter({});
  }

  onStatus(value: number | null): void {
    this.status.set(value);
    this.list.filter({});
  }

  goto(url: string): void {
    void this.router.navigateByUrl(url);
  }

  open(row: OrderListItemDto): void {
    void this.router.navigate(['/orders', row.id]);
  }

  accept(row: OrderListItemDto): void {
    this.api.post<OrderDto>(`/orders/${row.id}/accept`).subscribe(() => {
      this.message.success('已接单，订单进入待调度');
      this.list.reload();
    });
  }

  reject(row: OrderListItemDto): void {
    this.confirm.prompt({ title: `拒单：${row.orderNo}`, placeholder: '请填写拒单原因（将同步客户）', danger: true }).subscribe((reason) => {
      if (!reason) return;
      this.api.post<OrderDto>(`/orders/${row.id}/reject`, { reason }).subscribe(() => {
        this.message.success('已拒单');
        this.list.reload();
      });
    });
  }

  cancel(row: OrderListItemDto): void {
    this.confirm
      .open({ title: '取消订单', content: `确认取消订单 ${row.orderNo}？该操作不可撤销。`, danger: true })
      .subscribe((ok) => {
        if (!ok) return;
        this.confirm.prompt({ title: '取消原因', placeholder: '请填写取消原因', required: false }).subscribe((reason) => {
          this.api.post<OrderDto>(`/orders/${row.id}/cancel`, { reason: reason || 'PC 端手动取消' }).subscribe(() => {
            this.message.success('订单已取消');
            this.list.reload();
          });
        });
      });
  }

  openDispatch(row: OrderListItemDto): void {
    this.current = row;
    this.dispatchModel = { droneId: null, pilotId: null, waypoints: [], remark: '' };
    this.loadDispatchOptions();
    this.dispatchOpen.set(true);
  }

  submitDispatch(): void {
    if (!this.current) return;
    const droneId = this.dispatchModel['droneId'] as string | null;
    if (!droneId) {
      this.message.warning('请选择执行飞行器');
      return;
    }
    this.saving.set(true);
    this.api
      .post<OrderDto>(`/orders/${this.current.id}/dispatch`, {
        droneId,
        pilotId: (this.dispatchModel['pilotId'] as string) || null,
        waypoints: this.dispatchModel['waypoints'] ?? [],
        remark: (this.dispatchModel['remark'] as string) || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.dispatchOpen.set(false);
          this.message.success('调度已下发，可执行起飞');
          this.list.reload();
        },
        error: () => this.saving.set(false),
      });
  }


  private loadDispatchOptions(): void {
    if (!this.perm.can('resource.drone.read')) return;
    this.api.get<Paged<DroneDto>>('/resource/drones', { pageNum: 1, pageSize: 200, status: 1 }).subscribe({
      next: (page) => this.drones.set(page.items ?? []),
      error: () => undefined,
    });
    if (this.perm.can('resource.crew.manage')) {
      this.api.get<Paged<CrewDto>>('/resource/crew', { pageNum: 1, pageSize: 200, status: 1 }).subscribe({
        next: (page) => this.crew.set(page.items ?? []),
        error: () => undefined,
      });
    }
  }

  private toIso(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  }
}










