import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRateModule } from 'ng-zorro-antd/rate';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { ApiService } from '../../core/api.service';
import {
  CrewDto,
  DroneDto,
  ItemCategories,
  OrderDto,
  OrderPaymentStatusNameText,
  OrderStatusHistoryDto,
  OrderStatusNameText,
  Paged,
  PaymentDto,
  PaymentMethodNameText,
  PaymentMethods,
  PaymentStatusNameText,
  WaypointDto,
} from '../../core/api-types';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { PermissionService } from '../../core/permission.service';
import { formatDateTime } from '../../shared/data-table';
import { MapCanvasComponent, MapMarker } from '../../shared/map-canvas';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { FormField, SchemaFormComponent } from '../../shared/schema-form';
import { StatusTagComponent } from '../../shared/status-tag';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDividerModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzRateModule,
    NzSpinModule,
    NzStepsModule,
    NzTableModule,
    NzTimelineModule,
    MapCanvasComponent,
    ModalComponent,
    PageHeaderComponent,
    SchemaFormComponent,
    StatusTagComponent,
  ],
  template: `
    <app-page-header title="订单详情" subtitle="查看订单全流程信息，并按状态执行接单、调度、送达、支付与退款操作">
      <button nz-button (click)="back()"><span nz-icon nzType="left"></span> 返回列表</button>
      @if (order(); as o) {
        @if (o.status === 'PendingAccept' && perm.can('order.accept')) {
          <button nz-button nzType="primary" (click)="accept()"><span nz-icon nzType="check"></span> 接单</button>
          <button nz-button nzDanger (click)="reject()"><span nz-icon nzType="close"></span> 拒单</button>
        }
        @if (o.status === 'PendingDispatch' && perm.can('order.dispatch')) {
          <button nz-button nzType="primary" (click)="openDispatch()"><span nz-icon nzType="send"></span> 派单</button>
          <button nz-button (click)="startFlight()"><span nz-icon nzType="rocket"></span> 开始飞行</button>
        }
        @if ((o.status === 'PendingAccept' || o.status === 'PendingDispatch') && perm.can('order.read')) {
          <button nz-button nzDanger (click)="cancel()"><span nz-icon nzType="close-circle"></span> 取消订单</button>
        }
        @if (o.status === 'InFlight' && perm.can('order.dispatch')) {
          <button nz-button nzType="primary" (click)="complete()"><span nz-icon nzType="check-circle"></span> 确认送达</button>
        }
        @if (o.status === 'Delivered' && !o.rating && canReview(o)) {
          <button nz-button nzType="primary" (click)="openReview()"><span nz-icon nzType="star"></span> 评价订单</button>
        }
        @if (o.paymentStatus === 'Unpaid' && o.status !== 'Cancelled' && canPay(o)) {
          <button nz-button nzType="primary" (click)="openPay()"><span nz-icon nzType="credit-card"></span> 支付</button>
        }
        @if (o.paymentStatus === 'Paid' && canRefund()) {
          <button nz-button nzDanger (click)="refund()"><span nz-icon nzType="dollar"></span> 退款</button>
        }
      }
    </app-page-header>

    @if (loading()) {
      <div class="page-loading"><nz-spin /></div>
    } @else {
      @if (order(); as o) {
        <div class="card">
          <div class="card__title">
            <span>订单 {{ o.orderNo }} <app-status-tag [value]="o.status" [map]="OrderStatusNameText" /></span>
            <span class="card__subtitle">支付状态：<app-status-tag [value]="o.paymentStatus" [map]="OrderPaymentStatusNameText" /></span>
          </div>
          @if (o.status === 'Cancelled') {
            <nz-alert nzType="error" nzShowIcon nzMessage="订单已取消" [nzDescription]="o.cancelReason || '未填写取消原因'" />
          } @else {
            <nz-steps [nzCurrent]="stepIndex(o)" nzSize="small">
              <nz-step nzTitle="待接单" [nzDescription]="o.acceptedAt ? time(o.acceptedAt) : ''"></nz-step>
              <nz-step nzTitle="待调度" [nzDescription]="o.dispatchedAt ? time(o.dispatchedAt) : ''"></nz-step>
              <nz-step nzTitle="飞行中" [nzDescription]="o.inFlightAt ? time(o.inFlightAt) : ''"></nz-step>
              <nz-step nzTitle="已送达" [nzDescription]="o.deliveredAt ? time(o.deliveredAt) : ''"></nz-step>
            </nz-steps>
          }
        </div>

        <div class="grid grid--3 mt-16">
          <div class="card">
            <div class="card__title">寄件信息</div>
            <div class="desc-grid">
              <div class="desc-item">
                <span class="desc-item__label">寄件人</span>
                <span class="desc-item__value">{{ o.sender.name }}</span>
              </div>
              <div class="desc-item">
                <span class="desc-item__label">联系电话</span>
                <span class="desc-item__value">{{ o.sender.phone }}</span>
              </div>
              <div class="desc-item">
                <span class="desc-item__label">寄件地址</span>
                <span class="desc-item__value">{{ o.sender.address }}</span>
              </div>
              <div class="desc-item">
                <span class="desc-item__label">坐标</span>
                <span class="desc-item__value mono">{{ o.sender.lat | number: '1.4-6' }}, {{ o.sender.lng | number: '1.4-6' }}</span>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card__title">收件信息</div>
            <div class="desc-grid">
              <div class="desc-item">
                <span class="desc-item__label">收件人</span>
                <span class="desc-item__value">{{ o.receiver.name }}</span>
              </div>
              <div class="desc-item">
                <span class="desc-item__label">联系电话</span>
                <span class="desc-item__value">{{ o.receiver.phone }}</span>
              </div>
              <div class="desc-item">
                <span class="desc-item__label">收件地址</span>
                <span class="desc-item__value">{{ o.receiver.address }}</span>
              </div>
              <div class="desc-item">
                <span class="desc-item__label">坐标</span>
                <span class="desc-item__value mono">{{ o.receiver.lat | number: '1.4-6' }}, {{ o.receiver.lng | number: '1.4-6' }}</span>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card__title">物品与费用</div>
            <div class="desc-grid">
              <div class="desc-item">
                <span class="desc-item__label">物品类型</span>
                <span class="desc-item__value">{{ categoryName() }}</span>
              </div>
              <div class="desc-item">
                <span class="desc-item__label">物品名称</span>
                <span class="desc-item__value">{{ o.itemName }}</span>
              </div>
              <div class="desc-item">
                <span class="desc-item__label">重量 / 体积</span>
                <span class="desc-item__value">{{ o.weightKg | number: '1.2-2' }} kg / {{ o.volumeM3 | number: '1.2-2' }} m³</span>
              </div>
              <div class="desc-item">
                <span class="desc-item__label">数量 / 时效</span>
                <span class="desc-item__value">{{ o.quantity }} 件 / {{ o.isUrgent ? '加急' : '普通' }}</span>
              </div>
              <div class="desc-item">
                <span class="desc-item__label">预约时间</span>
                <span class="desc-item__value">{{ o.scheduledAt ? time(o.scheduledAt) : '尽快配送' }}</span>
              </div>
              <div class="desc-item">
                <span class="desc-item__label">订单备注</span>
                <span class="desc-item__value">{{ o.remark || '-' }}</span>
              </div>
            </div>
            <nz-divider />
            <div class="fee">
              <div class="fee__row"><span>飞行距离</span><b>{{ o.fee.distanceKm | number: '1.2-2' }} km</b></div>
              <div class="fee__row"><span>基础费</span><b>¥ {{ o.fee.baseFee | number: '1.2-2' }}</b></div>
              <div class="fee__row"><span>距离费</span><b>¥ {{ o.fee.distanceFee | number: '1.2-2' }}</b></div>
              <div class="fee__row"><span>重量费</span><b>¥ {{ o.fee.weightFee | number: '1.2-2' }}</b></div>
              <div class="fee__row"><span>空域费</span><b>¥ {{ o.fee.airspaceFee | number: '1.2-2' }}</b></div>
              <div class="fee__row"><span>加急费</span><b>¥ {{ o.fee.urgentFee | number: '1.2-2' }}</b></div>
              <div class="fee__row"><span>优惠金额</span><b class="text-success">- ¥ {{ o.fee.discountAmount | number: '1.2-2' }}</b></div>
              <nz-divider />
              <div class="fee__row fee__row--total"><span>订单合计</span><b>¥ {{ o.fee.totalAmount | number: '1.2-2' }}</b></div>
            </div>
          </div>
        </div>

        <div class="grid grid--sidebar mt-16">
          <div>
            <div class="card">
              <div class="card__title">调度与飞行</div>
              <div class="desc-grid">
                <div class="desc-item">
                  <span class="desc-item__label">执行飞行器</span>
                  <span class="desc-item__value">{{ droneText() }}</span>
                </div>
                <div class="desc-item">
                  <span class="desc-item__label">执行机长</span>
                  <span class="desc-item__value">{{ pilotText() }}</span>
                </div>
                <div class="desc-item">
                  <span class="desc-item__label">调度时间</span>
                  <span class="desc-item__value">{{ o.dispatchedAt ? time(o.dispatchedAt) : '-' }}</span>
                </div>
                <div class="desc-item">
                  <span class="desc-item__label">规划航点</span>
                  <span class="desc-item__value">{{ o.plannedRoute?.length ? o.plannedRoute.length + ' 个航点' : '系统直连航线' }}</span>
                </div>
                <div class="desc-item">
                  <span class="desc-item__label">调度备注</span>
                  <span class="desc-item__value">{{ o.dispatchRemark || '-' }}</span>
                </div>
                <div class="desc-item">
                  <span class="desc-item__label">送达时间</span>
                  <span class="desc-item__value">{{ o.deliveredAt ? time(o.deliveredAt) : '-' }}</span>
                </div>
                @if (o.reviewedAt) {
                  <div class="desc-item">
                    <span class="desc-item__label">评价</span>
                    <span class="desc-item__value">{{ o.rating }} 分 {{ o.reviewComment || '' }}</span>
                  </div>
                }
              </div>
              <app-map-canvas class="mt-16" [height]="320" [path]="o.plannedRoute ?? null" [markers]="markers()" />
            </div>
          </div>

          <div>
            <div class="card">
              <div class="card__title">状态历史</div>
              @if (o.history.length) {
                <nz-timeline>
                  @for (item of o.history; track $index) {
                    <nz-timeline-item [nzColor]="historyColor(item.toStatus)">
                      <div>{{ historyText(item) }}</div>
                      <div class="timeline-note">{{ item.remark || '无备注' }}</div>
                      <div class="timeline-note">{{ time(item.at) }}</div>
                    </nz-timeline-item>
                  }
                </nz-timeline>
              } @else {
                <div class="text-secondary">暂无状态变更记录</div>
              }
            </div>

            <div class="card">
              <div class="card__title">
                <span>支付流水</span>
                <span class="card__subtitle">{{ o.paidAt ? '支付时间 ' + time(o.paidAt) : '暂无支付时间' }}</span>
              </div>
              @if (payments().length) {
                <nz-table [nzData]="payments()" [nzFrontPagination]="false" [nzShowPagination]="false" nzSize="small" [nzScroll]="{ x: '520px' }">
                  <thead>
                    <tr>
                      <th>支付方式</th>
                      <th>金额</th>
                      <th>状态</th>
                      <th>交易号</th>
                      <th>时间</th>
                      <th>说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (payment of payments(); track payment.id) {
                      <tr>
                        <td>{{ methodText(payment.method) }}</td>
                        <td>¥ {{ payment.amount | number: '1.2-2' }}</td>
                        <td><app-status-tag [value]="payment.status" [map]="PaymentStatusNameText" /></td>
                        <td class="mono">{{ payment.transactionNo || '-' }}</td>
                        <td>{{ time(payment.paidAt || payment.refundedAt || payment.createdAt) }}</td>
                        <td>{{ payment.failureReason || payment.refundReason || '-' }}</td>
                      </tr>
                    }
                  </tbody>
                </nz-table>
              } @else {
                <div class="text-secondary">暂无支付流水</div>
              }
            </div>
          </div>
        </div>
      } @else {
        <div class="card"><nz-empty nzNotFoundContent="订单不存在或无权查看" /></div>
      }
    }

    <app-modal [(open)]="dispatchOpen" title="订单派单" okText="下发调度" [loading]="saving()" [width]="720" (ok)="submitDispatch()">
      <app-schema-form [fields]="dispatchFields()" [(model)]="dispatchModel" />
    </app-modal>

    <app-modal [(open)]="reviewOpen" title="评价订单" okText="提交评价" [loading]="saving()" (ok)="submitReview()">
      <div class="review">
        <div class="review__label">服务评分</div>
        <nz-rate [(ngModel)]="reviewModel.rating" [nzCount]="5" />
        <div class="review__label mt-16">评价内容</div>
        <textarea nz-input rows="3" maxlength="200" placeholder="请填写评价内容（可选）" [(ngModel)]="reviewModel.comment"></textarea>
      </div>
    </app-modal>

    <app-modal [(open)]="payOpen" title="订单支付（模拟）" okText="确认支付" [loading]="saving()" (ok)="submitPay()">
      <app-schema-form [fields]="payFields" [(model)]="payModel" />
    </app-modal>
  `,
  styles: [
    `
      .fee__row {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        padding: 4px 0;
        color: #4a5568;
      }
      .fee__row--total b {
        color: #d4380d;
        font-size: 18px;
      }
      .review__label {
        font-size: 13px;
        color: #4a5568;
        margin-bottom: 8px;
      }
    `,
  ],
})
export class OrderDetailPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  readonly perm = inject(PermissionService);

  readonly id = input('');
  readonly order = signal<OrderDto | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly payments = signal<PaymentDto[]>([]);
  readonly drones = signal<DroneDto[]>([]);
  readonly crew = signal<CrewDto[]>([]);

  readonly dispatchOpen = signal(false);
  readonly reviewOpen = signal(false);
  readonly payOpen = signal(false);

  dispatchModel: Record<string, unknown> = { droneId: null, pilotId: null, waypoints: [], remark: '' };
  reviewModel = { rating: 5, comment: '' };
  payModel: Record<string, unknown> = { method: 1, simulateFailure: false, failureReason: '' };

  readonly OrderStatusNameText = OrderStatusNameText;
  readonly OrderPaymentStatusNameText = OrderPaymentStatusNameText;
  readonly PaymentStatusNameText = PaymentStatusNameText;

  readonly payFields: FormField[] = [
    {
      key: 'method',
      label: '支付方式',
      type: 'select',
      required: true,
      span: 24,
      options: PaymentMethods.map((m) => ({ value: m.value, label: m.label })),
    },
    {
      key: 'simulateFailure',
      label: '模拟支付失败',
      type: 'switch',
      span: 24,
      help: '演示用：开启后本次支付将记为失败，订单保持未支付状态',
    },
    {
      key: 'failureReason',
      label: '失败原因',
      type: 'text',
      span: 24,
      showWhen: (model) => !!model['simulateFailure'],
      placeholder: '如：余额不足（模拟）',
    },
  ];

  readonly dispatchFields = computed<FormField[]>(() => [
    {
      key: 'droneId',
      label: '执行飞行器',
      type: 'select',
      required: true,
      span: 24,
      placeholder: '仅可选择闲置且维保正常的飞行器',
      options: this.drones().map((d) => ({
        value: d.id,
        label: `${d.serialNo} · ${d.model} · 载重 ${d.maxPayloadKg}kg · 电量 ${d.batteryPercent}%`,
      })),
    },
    {
      key: 'pilotId',
      label: '执行机长',
      type: 'select',
      span: 24,
      placeholder: this.crewOptions().length ? '选择机长（可选）' : '暂无可选机长',
      options: this.crewOptions(),
    },
    { key: 'waypoints', label: '规划航点', type: 'waypoints', span: 24, help: '留空则按寄收地址直连航线' },
    { key: 'remark', label: '调度备注', type: 'textarea', span: 24, maxLength: 200 },
  ]);

  readonly crewOptions = computed(() =>
    this.crew()
      .filter((c) => c.role === 'Pilot' && !!c.userId)
      .map((c) => ({ value: c.userId as string, label: `${c.name} · ${c.phone}` })),
  );

  readonly categoryName = computed(() => {
    const code = this.order()?.itemCategory;
    if (!code) return '-';
    return ItemCategories.find((c) => c.code === code)?.name ?? code;
  });

  readonly droneText = computed(() => {
    const order = this.order();
    if (!order?.droneId) return '-';
    const drone = this.drones().find((d) => d.id === order.droneId);
    return drone ? `${drone.serialNo} · ${drone.model}` : order.droneId;
  });

  readonly pilotText = computed(() => {
    const order = this.order();
    if (!order?.pilotId) return '-';
    const member = this.crew().find((c) => c.userId === order.pilotId || c.id === order.pilotId);
    return member ? member.name : order.pilotId;
  });

  readonly markers = computed<MapMarker[]>(() => {
    const order = this.order();
    if (!order) return [];
    return [
      { lat: order.sender.lat, lng: order.sender.lng, label: '寄件', tone: 'blue' },
      { lat: order.receiver.lat, lng: order.receiver.lng, label: '收件', tone: 'green' },
    ];
  });

  ngOnInit(): void {
    this.load();
  }

  back(): void {
    void this.router.navigateByUrl('/orders');
  }

  canPay(order: OrderDto): boolean {
    return this.perm.can('order.pay') && (this.auth.isAdmin() || this.auth.user()?.id === order.customerId);
  }

  canRefund(): boolean {
    const me = this.auth.user();
    return (
      this.perm.can('order.settle') &&
      (this.auth.isAdmin() || me?.userType === 'Merchant' || me?.userType === 'MerchantStaff')
    );
  }

  canReview(order: OrderDto): boolean {
    return this.perm.can('order.review') && this.auth.user()?.id === order.customerId;
  }

  accept(): void {
    const order = this.order();
    if (!order) return;
    this.api.post<OrderDto>(`/orders/${order.id}/accept`).subscribe(() => {
      this.message.success('已接单，订单进入待调度');
      this.load();
    });
  }

  reject(): void {
    const order = this.order();
    if (!order) return;
    this.confirm
      .prompt({ title: `拒单：${order.orderNo}`, placeholder: '请填写拒单原因（将同步客户）', danger: true })
      .subscribe((reason) => {
        if (!reason) return;
        this.api.post<OrderDto>(`/orders/${order.id}/reject`, { reason }).subscribe(() => {
          this.message.success('已拒单，订单已取消');
          this.load();
        });
      });
  }

  cancel(): void {
    const order = this.order();
    if (!order) return;
    this.confirm
      .open({ title: '取消订单', content: `确认取消订单 ${order.orderNo}？该操作不可撤销。`, danger: true })
      .subscribe((ok) => {
        if (!ok) return;
        this.confirm
          .prompt({ title: '取消原因', placeholder: '请填写取消原因（可留空）', required: false })
          .subscribe((reason) => {
            if (reason === null) return;
            this.api.post<OrderDto>(`/orders/${order.id}/cancel`, { reason: reason || 'PC 端手动取消' }).subscribe(() => {
              this.message.success('订单已取消');
              this.load();
            });
          });
      });
  }

  openDispatch(): void {
    this.dispatchModel = { droneId: null, pilotId: null, waypoints: [], remark: '' };
    this.loadResourceOptions();
    this.dispatchOpen.set(true);
  }

  submitDispatch(): void {
    const order = this.order();
    if (!order) return;
    const droneId = this.dispatchModel['droneId'] as string | null;
    if (!droneId) {
      this.message.warning('请选择执行飞行器');
      return;
    }
    const waypoints = Array.isArray(this.dispatchModel['waypoints']) ? (this.dispatchModel['waypoints'] as WaypointDto[]) : [];
    this.saving.set(true);
    this.api
      .post<OrderDto>(`/orders/${order.id}/dispatch`, {
        droneId,
        pilotId: (this.dispatchModel['pilotId'] as string) || null,
        waypoints,
        remark: (this.dispatchModel['remark'] as string) || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.dispatchOpen.set(false);
          this.message.success('派单已下发，可开始飞行');
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }

  startFlight(): void {
    const order = this.order();
    if (!order) return;
    if (!order.droneId) {
      this.message.warning('请先完成派单，再开始飞行');
      return;
    }
    this.confirm.open({ title: '开始飞行', content: `确认订单 ${order.orderNo} 开始执行飞行任务？` }).subscribe((ok) => {
      if (!ok) return;
      this.api.post<OrderDto>(`/orders/${order.id}/start`).subscribe(() => {
        this.message.success('飞行任务已开始');
        this.load();
      });
    });
  }

  complete(): void {
    const order = this.order();
    if (!order) return;
    this.confirm
      .prompt({ title: '确认送达', placeholder: '请填写送达备注（可选）', required: false, multiline: true })
      .subscribe((remark) => {
        if (remark === null) return;
        this.api.post<OrderDto>(`/orders/${order.id}/complete`, { remark: remark || null }).subscribe(() => {
          this.message.success('订单已送达');
          this.load();
        });
      });
  }

  openReview(): void {
    this.reviewModel = { rating: 5, comment: '' };
    this.reviewOpen.set(true);
  }

  submitReview(): void {
    const order = this.order();
    if (!order) return;
    const rating = Number(this.reviewModel.rating);
    if (!rating || rating < 1 || rating > 5) {
      this.message.warning('请选择 1-5 分的服务评分');
      return;
    }
    this.saving.set(true);
    this.api
      .post<OrderDto>(`/orders/${order.id}/review`, { rating, comment: this.reviewModel.comment || null })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.reviewOpen.set(false);
          this.message.success('评价已提交');
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }

  openPay(): void {
    this.payModel = { method: 1, simulateFailure: false, failureReason: '' };
    this.payOpen.set(true);
  }

  submitPay(): void {
    const order = this.order();
    if (!order) return;
    const method = Number(this.payModel['method'] ?? 1);
    const simulateFailure = !!this.payModel['simulateFailure'];
    this.saving.set(true);
    this.api
      .post<PaymentDto>(`/orders/${order.id}/pay`, {
        method,
        simulateFailure,
        failureReason: simulateFailure ? (this.payModel['failureReason'] as string) || '模拟支付失败' : null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.payOpen.set(false);
          if (simulateFailure) this.message.warning('已模拟支付失败，可在支付流水中查看失败记录');
          else this.message.success('支付成功，订单支付状态已更新');
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }

  refund(): void {
    const order = this.order();
    if (!order) return;
    this.confirm.prompt({ title: '订单退款', placeholder: '请填写退款原因', danger: true }).subscribe((reason) => {
      if (!reason) return;
      this.api.post<PaymentDto>(`/orders/${order.id}/refund`, { reason }).subscribe(() => {
        this.message.success('退款已完成，订单支付状态更新为已退款');
        this.load();
      });
    });
  }

  stepIndex(order: OrderDto): number {
    switch (order.status) {
      case 'PendingDispatch':
        return 1;
      case 'InFlight':
        return 2;
      case 'Delivered':
        return 3;
      default:
        return 0;
    }
  }

  historyColor(status: string): string {
    if (status === 'Delivered') return 'green';
    if (status === 'Cancelled') return 'red';
    if (status === 'InFlight') return 'blue';
    return 'gray';
  }

  historyText(item: OrderStatusHistoryDto): string {
    const from = item.fromStatus ? this.statusText(item.fromStatus) : '创建订单';
    return `${from} → ${this.statusText(item.toStatus)}`;
  }

  time(value: unknown): string {
    return formatDateTime(value);
  }

  methodText(method: string): string {
    return PaymentMethodNameText[method] ?? method;
  }

  private statusText(status: string): string {
    return (OrderStatusNameText as Record<string, string>)[status] ?? status;
  }

  private load(): void {
    const id = this.id();
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.api.get<OrderDto>(`/orders/${id}`).subscribe({
      next: (order) => {
        this.order.set(order);
        this.loading.set(false);
        this.loadResourceOptions();
        this.loadPayments();
      },
      error: () => this.loading.set(false),
    });
  }

  private loadPayments(): void {
    const id = this.id();
    if (!id) return;
    this.api.get<PaymentDto[]>(`/orders/${id}/payments`).subscribe({
      next: (rows) => this.payments.set(rows ?? []),
      error: () => this.payments.set([]),
    });
  }

  private loadResourceOptions(): void {
    if (this.perm.can('resource.drone.read')) {
      this.api.get<Paged<DroneDto>>('/resource/drones', { pageNum: 1, pageSize: 200, status: 1 }).subscribe({
        next: (page) => this.drones.set(page.items ?? []),
        error: () => this.drones.set([]),
      });
    }
    if (this.perm.can('resource.crew.manage')) {
      this.api.get<Paged<CrewDto>>('/resource/crew', { pageNum: 1, pageSize: 200, role: 1, status: 1 }).subscribe({
        next: (page) => this.crew.set(page.items ?? []),
        error: () => this.crew.set([]),
      });
    }
  }
}

