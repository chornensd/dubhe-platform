import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { ApiService } from '../../core/api.service';
import { PaymentStatusNameText, SettlementItemDto, SettlementStatementDto, StatementStatusNameText } from '../../core/api-types';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { PermissionService } from '../../core/permission.service';
import { formatDateTime } from '../../shared/data-table';
import { PageHeaderComponent } from '../../shared/page-header';
import { StatCardComponent } from '../../shared/stat-card';
import { StatusTagComponent } from '../../shared/status-tag';

@Component({
  selector: 'app-settlement-detail',
  standalone: true,
  imports: [
    CommonModule,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzIconModule,
    NzSpinModule,
    NzTableModule,
    PageHeaderComponent,
    StatCardComponent,
    StatusTagComponent,
  ],
  template: `
    <app-page-header title="结算详情" [subtitle]="subtitle()">
      <button nz-button (click)="back()"><span nz-icon nzType="left"></span> 返回列表</button>
      @if (statement(); as s) {
        <button nz-button [nzLoading]="exporting()" (click)="exportStatement()"><span nz-icon nzType="download"></span> 导出结算单</button>
        @if (s.status === 'Draft' && perm.can('order.settle')) {
          <button nz-button nzType="primary" (click)="confirmStatement()"><span nz-icon nzType="check"></span> 商家确认</button>
        }
        @if (s.status === 'Confirmed' && isAdmin()) {
          <button nz-button nzType="primary" (click)="settle()"><span nz-icon nzType="dollar"></span> 平台结算</button>
        }
      }
    </app-page-header>

    @if (loading()) {
      <div class="page-loading"><nz-spin /></div>
    } @else {
      @if (statement(); as s) {
        <div class="grid grid--4">
          <app-stat-card label="结算订单数" [value]="s.orderCount" unit="单" />
          <app-stat-card label="订单总额" [value]="s.totalAmount" unit="元" />
          <app-stat-card
            label="平台佣金"
            [value]="s.commissionAmount"
            unit="元"
            [hint]="'佣金率 ' + (s.commissionRate * 100 | number: '1.1-2') + '%'"
          />
          <app-stat-card label="商家净额" [value]="s.netAmount" unit="元" [dark]="true" />
        </div>

        <div class="card">
          <div class="card__title">结算信息</div>
          <div class="desc-grid">
            <div class="desc-item">
              <span class="desc-item__label">结算单号</span>
              <span class="desc-item__value mono">{{ s.statementNo }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">结算状态</span>
              <span class="desc-item__value"><app-status-tag [value]="s.status" [map]="StatementStatusNameText" /></span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">商家 ID</span>
              <span class="desc-item__value mono">{{ s.merchantId }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">结算周期</span>
              <span class="desc-item__value">{{ date(s.periodStart) }} ~ {{ date(s.periodEnd) }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">佣金率</span>
              <span class="desc-item__value">{{ s.commissionRate * 100 | number: '1.1-2' }}%</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">生成时间</span>
              <span class="desc-item__value">{{ time(s.generatedAt) }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">确认时间</span>
              <span class="desc-item__value">{{ s.confirmedAt ? time(s.confirmedAt) : '-' }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">结算时间</span>
              <span class="desc-item__value">{{ s.settledAt ? time(s.settledAt) : '-' }}</span>
            </div>
            @if (s.remark) {
              <div class="desc-item">
                <span class="desc-item__label">备注</span>
                <span class="desc-item__value">{{ s.remark }}</span>
              </div>
            }
          </div>
        </div>

        <div class="card">
          <div class="card__title">对账差异</div>
          @if (s.reconciliation; as rec) {
            @if (rec.unpaidCount > 0) {
              <nz-alert
                nzType="warning"
                nzShowIcon
                [nzMessage]="'存在 ' + rec.unpaidCount + ' 笔未支付订单，未付金额 ¥ ' + (rec.unpaidAmount | number: '1.2-2') + '，请核实后再结算'"
              />
            }
            <div class="grid grid--5 mt-16">
              <app-stat-card label="已付笔数" [value]="rec.paidCount" />
              <app-stat-card label="未付笔数" [value]="rec.unpaidCount" [alert]="rec.unpaidCount > 0" />
              <app-stat-card label="已退款笔数" [value]="rec.refundedCount" />
              <app-stat-card label="未付金额" [value]="rec.unpaidAmount" unit="元" />
              <app-stat-card label="已退款金额" [value]="rec.refundedAmount" unit="元" />
            </div>
          } @else {
            <div class="text-secondary">暂无对账数据</div>
          }
        </div>

        <div class="card">
          <div class="card__title">
            <span>结算明细</span>
            <span class="card__subtitle">共 {{ items().length }} 笔，点击行可跳转订单详情</span>
          </div>
          @if (items().length) {
            <nz-table [nzData]="items()" [nzFrontPagination]="false" [nzShowPagination]="false" nzSize="small" [nzScroll]="{ x: '960px' }">
              <thead>
                <tr>
                  <th>订单号</th>
                  <th nzAlign="right">订单金额</th>
                  <th nzAlign="right">佣金</th>
                  <th nzAlign="right">净额</th>
                  <th>支付状态</th>
                  <th>送达时间</th>
                </tr>
              </thead>
              <tbody>
                @for (item of items(); track item.orderId) {
                  <tr class="row-link" (click)="openOrder(item.orderId)">
                    <td class="mono">{{ item.orderNo }}</td>
                    <td nzAlign="right">¥ {{ item.totalAmount | number: '1.2-2' }}</td>
                    <td nzAlign="right">¥ {{ item.commissionAmount | number: '1.2-2' }}</td>
                    <td nzAlign="right">¥ {{ item.netAmount | number: '1.2-2' }}</td>
                    <td><app-status-tag [value]="item.paymentStatus" [map]="PaymentStatusNameText" /></td>
                    <td>{{ item.deliveredAt ? time(item.deliveredAt) : '-' }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          } @else {
            <nz-empty nzNotFoundContent="暂无结算明细" />
          }
        </div>
      } @else {
        <div class="card"><nz-empty nzNotFoundContent="结算单不存在或无权查看" /></div>
      }
    }
  `,
  styles: [
    `
      .row-link {
        cursor: pointer;
      }
      .row-link:hover {
        background: #f7f9fc;
      }
    `,
  ],
})
export class SettlementDetailPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  readonly perm = inject(PermissionService);

  readonly id = input('');
  readonly statement = signal<SettlementStatementDto | null>(null);
  readonly loading = signal(true);
  readonly exporting = signal(false);

  readonly StatementStatusNameText = StatementStatusNameText;
  readonly PaymentStatusNameText = PaymentStatusNameText;

  readonly isAdmin = computed(() => this.auth.isAdmin());
  readonly items = computed<SettlementItemDto[]>(() => this.statement()?.items ?? []);
  readonly subtitle = computed(() => {
    const current = this.statement();
    return current ? `结算单 ${current.statementNo}：汇总、对账差异与订单明细` : '查看结算汇总、对账差异与订单明细';
  });

  ngOnInit(): void {
    this.load();
  }

  back(): void {
    void this.router.navigateByUrl('/finance/settlements');
  }

  openOrder(orderId: string): void {
    void this.router.navigate(['/orders', orderId]);
  }

  exportStatement(): void {
    const current = this.statement();
    if (!current) return;
    this.exporting.set(true);
    this.api.downloadGet(`/settlements/${current.id}/export`, `settlement-${current.statementNo}.xlsx`).subscribe({
      next: () => {
        this.exporting.set(false);
        this.message.success('结算单导出已开始');
      },
      error: () => this.exporting.set(false),
    });
  }

  confirmStatement(): void {
    const current = this.statement();
    if (!current) return;
    this.confirm
      .open({ title: '商家确认', content: `确认结算单 ${current.statementNo} 的对账结果？确认后进入平台结算流程。` })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.post<SettlementStatementDto>(`/settlements/${current.id}/confirm`).subscribe(() => {
          this.message.success('结算单已确认');
          this.load();
        });
      });
  }

  settle(): void {
    const current = this.statement();
    if (!current) return;
    this.confirm
      .open({ title: '平台结算', content: `确认完成结算单 ${current.statementNo} 的平台结算？该操作不可撤销。`, danger: true })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.post<SettlementStatementDto>(`/settlements/${current.id}/settle`).subscribe(() => {
          this.message.success('结算已完成');
          this.load();
        });
      });
  }

  date(value: unknown): string {
    return formatDateTime(value, 'YYYY-MM-DD');
  }

  time(value: unknown): string {
    return formatDateTime(value);
  }

  private load(): void {
    const id = this.id();
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.api.get<SettlementStatementDto>(`/settlements/${id}`).subscribe({
      next: (statement) => {
        this.statement.set(statement);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}

