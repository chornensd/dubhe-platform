import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { OrderListItemDto, OrderStatus, Paged } from '../../core/api-types';
import { formatDateTime } from '../../shared/data-table';
import { PageHeaderComponent } from '../../shared/page-header';
import { StatCardComponent } from '../../shared/stat-card';

/** 客户/访客角色的轻量工作台（无专用报表接口时按订单统计） */
@Component({
  selector: 'app-customer-workbench',
  standalone: true,
  imports: [CommonModule, NzButtonModule, NzIconModule, PageHeaderComponent, StatCardComponent],
  template: `
    <app-page-header title="我的工作台" subtitle="订单进度、快捷下单与常用服务入口" />

    <div class="grid grid--4">
      <app-stat-card label="累计下单" [value]="total()" unit="单" />
      <app-stat-card label="进行中" [value]="inProgress()" unit="单" hint="待接单 / 待调度 / 飞行中" />
      <app-stat-card label="已完成" [value]="delivered()" unit="单" />
      <app-stat-card label="已取消" [value]="cancelled()" unit="单" />
    </div>

    <div class="grid grid--sidebar mt-16">
      <div class="card">
        <div class="card__title">
          最近订单
          <a class="card__subtitle" (click)="goto('/orders')">全部订单 →</a>
        </div>
        @if (orders().length) {
          <div class="work__orders">
            @for (order of orders(); track order.id) {
              <div class="work__order" (click)="goto('/orders/' + order.id)">
                <span class="mono">{{ order.orderNo }}</span>
                <span>{{ order.itemName }}</span>
                <span class="text-secondary">{{ order.receiverAddress }}</span>
                <span class="work__amount">¥ {{ order.totalAmount | number: '1.2-2' }}</span>
                <span class="text-secondary">{{ time(order.createdAt) }}</span>
              </div>
            }
          </div>
        } @else {
          <div class="text-secondary">暂无订单，点击右侧「下单寄件」创建第一单</div>
        }
      </div>

      <div class="card">
        <div class="card__title">快捷入口</div>
        <div class="work__links">
          <a (click)="goto('/orders/create')"><span nz-icon nzType="plus"></span> 下单寄件</a>
          <a (click)="goto('/orders')"><span nz-icon nzType="search"></span> 订单跟踪</a>
          <a (click)="goto('/finance/invoices')"><span nz-icon nzType="file-text"></span> 发票申请</a>
          <a (click)="goto('/support/tickets')"><span nz-icon nzType="customer-service"></span> 客服工单</a>
          <a (click)="goto('/support/help')"><span nz-icon nzType="question-circle"></span> 帮助中心</a>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .work__orders {
        display: flex;
        flex-direction: column;
      }
      .work__order {
        display: grid;
        grid-template-columns: 170px 1fr 1.4fr 110px 140px;
        gap: 10px;
        padding: 10px 4px;
        border-bottom: 1px solid #f2f4f8;
        font-size: 13px;
        cursor: pointer;
        align-items: center;
      }
      .work__order:hover {
        background: #f7faff;
      }
      .work__amount {
        color: #d4380d;
      }
      .work__links {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .work__links a {
        cursor: pointer;
        font-size: 13px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
    `,
  ],
})
export class CustomerWorkbenchPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly total = signal(0);
  readonly delivered = signal(0);
  readonly cancelled = signal(0);
  readonly inProgress = signal(0);
  readonly orders = signal<OrderListItemDto[]>([]);

  ngOnInit(): void {
    forkJoin({
      all: this.api.get<Paged<OrderListItemDto>>('/orders', { pageNum: 1, pageSize: 6 }),
      inFlight: this.api.get<Paged<OrderListItemDto>>('/orders', { pageNum: 1, pageSize: 1, status: OrderStatus.InFlight }),
      pendingAccept: this.api.get<Paged<OrderListItemDto>>('/orders', { pageNum: 1, pageSize: 1, status: OrderStatus.PendingAccept }),
      pendingDispatch: this.api.get<Paged<OrderListItemDto>>('/orders', { pageNum: 1, pageSize: 1, status: OrderStatus.PendingDispatch }),
      delivered: this.api.get<Paged<OrderListItemDto>>('/orders', { pageNum: 1, pageSize: 1, status: OrderStatus.Delivered }),
      cancelled: this.api.get<Paged<OrderListItemDto>>('/orders', { pageNum: 1, pageSize: 1, status: OrderStatus.Cancelled }),
    }).subscribe((r) => {
      this.orders.set(r.all.items ?? []);
      this.total.set(r.all.total ?? 0);
      this.inProgress.set((r.inFlight.total ?? 0) + (r.pendingAccept.total ?? 0) + (r.pendingDispatch.total ?? 0));
      this.delivered.set(r.delivered.total ?? 0);
      this.cancelled.set(r.cancelled.total ?? 0);
    });
  }

  goto(url: string): void {
    void this.router.navigateByUrl(url);
  }

  time(value: string): string {
    return formatDateTime(value);
  }
}
