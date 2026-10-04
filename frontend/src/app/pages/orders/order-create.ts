import { CommonModule } from '@angular/common';
import { Component, inject, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { ApiService } from '../../core/api.service';
import { ItemCategories, OrderCreateRequest, OrderDto, OrderEstimateDto, Paged, UserListItemDto } from '../../core/api-types';
import { AuthService } from '../../core/auth.service';
import { PermissionService } from '../../core/permission.service';
import { LatLng, MapCanvasComponent, MapMarker } from '../../shared/map-canvas';
import { PageHeaderComponent } from '../../shared/page-header';
import { SearchSelectComponent, SelectOption } from '../../shared/search-select';

type Side = 'sender' | 'receiver';

@Component({
  selector: 'app-order-create',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDividerModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSwitchModule,
    PageHeaderComponent,
    MapCanvasComponent,
    SearchSelectComponent,
  ],
  template: `
    <app-page-header title="新建订单" subtitle="填写寄收地址、物品信息后可先预估费用，再提交订单">
      <button nz-button (click)="back()">返回列表</button>
    </app-page-header>

    <div class="grid grid--sidebar">
      <div>
        <div class="card">
          <div class="card__title">运营商家</div>
          <div class="filter-bar">
            @if (canPickMerchant()) {
              <app-search-select
                style="flex: 1"
                [options]="merchantOptions()"
                [placeholder]="'输入商家名称/手机号搜索'"
                [ngModel]="model.merchantId"
                (ngModelChange)="model.merchantId = $event; refreshEstimate()"
                (search)="loadMerchants($event)"
              />
            } @else {
              <input nz-input placeholder="商家 ID（当前账号已绑定商家时自动使用）" [(ngModel)]="model.merchantId" (ngModelChange)="refreshEstimate()" />
            }
            @if (merchantHint()) {
              <span class="text-secondary">{{ merchantHint() }}</span>
            }
          </div>
        </div>

        <div class="card mt-16">
          <div class="card__title">
            寄件信息
            <button nz-button nzSize="small" [nzType]="pickMode() === 'sender' ? 'primary' : 'default'" (click)="togglePick('sender')">
              <span nz-icon nzType="environment"></span> 地图选点
            </button>
          </div>
          <div nz-row [nzGutter]="16">
            <div nz-col [nzSpan]="12">
              <nz-form-item>
                <nz-form-label nzRequired>寄件人</nz-form-label>
                <nz-form-control><input nz-input [(ngModel)]="model.senderName" placeholder="联系人姓名" /></nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="12">
              <nz-form-item>
                <nz-form-label nzRequired>联系电话</nz-form-label>
                <nz-form-control><input nz-input [(ngModel)]="model.senderPhone" maxlength="11" placeholder="手机号" /></nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="24">
              <nz-form-item>
                <nz-form-label nzRequired>寄件地址</nz-form-label>
                <nz-form-control><input nz-input [(ngModel)]="model.senderAddress" placeholder="详细地址" /></nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="12">
              <nz-form-item>
                <nz-form-label nzRequired>纬度</nz-form-label>
                <nz-form-control>
                  <nz-input-number style="width:100%" [nzMin]="-90" [nzMax]="90" [nzStep]="0.0001" [(ngModel)]="model.senderLat" />
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="12">
              <nz-form-item>
                <nz-form-label nzRequired>经度</nz-form-label>
                <nz-form-control>
                  <nz-input-number style="width:100%" [nzMin]="-180" [nzMax]="180" [nzStep]="0.0001" [(ngModel)]="model.senderLng" />
                </nz-form-control>
              </nz-form-item>
            </div>
          </div>
        </div>

        <div class="card mt-16">
          <div class="card__title">
            收件信息
            <button nz-button nzSize="small" [nzType]="pickMode() === 'receiver' ? 'primary' : 'default'" (click)="togglePick('receiver')">
              <span nz-icon nzType="environment"></span> 地图选点
            </button>
          </div>
          <div nz-row [nzGutter]="16">
            <div nz-col [nzSpan]="12">
              <nz-form-item>
                <nz-form-label nzRequired>收件人</nz-form-label>
                <nz-form-control><input nz-input [(ngModel)]="model.receiverName" placeholder="联系人姓名" /></nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="12">
              <nz-form-item>
                <nz-form-label nzRequired>联系电话</nz-form-label>
                <nz-form-control><input nz-input [(ngModel)]="model.receiverPhone" maxlength="11" placeholder="手机号" /></nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="24">
              <nz-form-item>
                <nz-form-label nzRequired>收件地址</nz-form-label>
                <nz-form-control><input nz-input [(ngModel)]="model.receiverAddress" placeholder="详细地址" /></nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="12">
              <nz-form-item>
                <nz-form-label nzRequired>纬度</nz-form-label>
                <nz-form-control>
                  <nz-input-number style="width:100%" [nzMin]="-90" [nzMax]="90" [nzStep]="0.0001" [(ngModel)]="model.receiverLat" />
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="12">
              <nz-form-item>
                <nz-form-label nzRequired>经度</nz-form-label>
                <nz-form-control>
                  <nz-input-number style="width:100%" [nzMin]="-180" [nzMax]="180" [nzStep]="0.0001" [(ngModel)]="model.receiverLng" />
                </nz-form-control>
              </nz-form-item>
            </div>
          </div>
        </div>

        <div class="card mt-16">
          <div class="card__title">物品与时效</div>
          <div nz-row [nzGutter]="16">
            <div nz-col [nzSpan]="8">
              <nz-form-item>
                <nz-form-label nzRequired>物品类型</nz-form-label>
                <nz-form-control>
                  <nz-select style="width:100%" nzPlaceHolder="选择物品类型" [(ngModel)]="model.itemCategory" (ngModelChange)="onCategory($event)">
                    @for (item of categories; track item.code) {
                      <nz-option [nzValue]="item.code" [nzLabel]="item.name" [nzDisabled]="item.prohibited" />
                    }
                  </nz-select>
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="16">
              <nz-form-item>
                <nz-form-label nzRequired>物品名称</nz-form-label>
                <nz-form-control><input nz-input [(ngModel)]="model.itemName" placeholder="如：文件、药品" /></nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="8">
              <nz-form-item>
                <nz-form-label nzRequired>重量(kg)</nz-form-label>
                <nz-form-control>
                  <nz-input-number style="width:100%" [nzMin]="0.1" [nzMax]="500" [nzStep]="0.1" [(ngModel)]="model.weightKg" />
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="8">
              <nz-form-item>
                <nz-form-label>体积(m³)</nz-form-label>
                <nz-form-control>
                  <nz-input-number style="width:100%" [nzMin]="0" [nzStep]="0.01" [(ngModel)]="model.volumeM3" />
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="8">
              <nz-form-item>
                <nz-form-label>数量</nz-form-label>
                <nz-form-control>
                  <nz-input-number style="width:100%" [nzMin]="1" [nzStep]="1" [(ngModel)]="model.quantity" />
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="8">
              <nz-form-item>
                <nz-form-label>加急配送</nz-form-label>
                <nz-form-control><nz-switch [(ngModel)]="model.isUrgent" (ngModelChange)="refreshEstimate()" /></nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="8">
              <nz-form-item>
                <nz-form-label>预约时间</nz-form-label>
                <nz-form-control>
                  <nz-date-picker style="width:100%" nzShowTime nzFormat="yyyy-MM-dd HH:mm" [(ngModel)]="scheduledAt" />
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="8">
              <nz-form-item>
                <nz-form-label>优惠金额</nz-form-label>
                <nz-form-control>
                  <nz-input-number style="width:100%" [nzMin]="0" [nzStep]="1" [(ngModel)]="model.couponAmount" (ngModelChange)="refreshEstimate()" />
                </nz-form-control>
              </nz-form-item>
            </div>
            <div nz-col [nzSpan]="24">
              <nz-form-item>
                <nz-form-label>备注</nz-form-label>
                <nz-form-control><textarea nz-input rows="2" [(ngModel)]="model.remark" maxlength="200"></textarea></nz-form-control>
              </nz-form-item>
            </div>
          </div>
        </div>

        <div class="card mt-16">
          <div class="card__title">空域与航线预览</div>
          <app-map-canvas
            [height]="360"
            [markers]="mapMarkers()"
            [pickable]="!!pickMode()"
            (pick)="onPick($event)"
          />
          @if (pickMode()) {
            <div class="text-secondary mt-8">正在拾取{{ pickMode() === 'sender' ? '寄件' : '收件' }}坐标，点击地图任意位置即可写入经纬度</div>
          }
        </div>
      </div>

      <div>
        <div class="card">
          <div class="card__title">费用预估</div>
          <button nz-button nzType="primary" nzBlock [nzLoading]="estimating()" (click)="estimate()">
            <span nz-icon nzType="calculator"></span> 预估费用
          </button>
          @if (estimateResult(); as result) {
            <div class="fee mt-16">
              <div class="fee__row"><span>飞行距离</span><b>{{ result.distanceKm | number: '1.2-2' }} km</b></div>
              <div class="fee__row"><span>基础费</span><b>¥ {{ result.fee.baseFee | number: '1.2-2' }}</b></div>
              <div class="fee__row"><span>距离费</span><b>¥ {{ result.fee.distanceFee | number: '1.2-2' }}</b></div>
              <div class="fee__row"><span>重量费</span><b>¥ {{ result.fee.weightFee | number: '1.2-2' }}</b></div>
              <div class="fee__row"><span>空域费</span><b>¥ {{ result.fee.airspaceFee | number: '1.2-2' }}</b></div>
              <div class="fee__row"><span>加急费</span><b>¥ {{ result.fee.urgentFee | number: '1.2-2' }}</b></div>
              <div class="fee__row"><span>优惠</span><b class="text-success">- ¥ {{ result.fee.discountAmount | number: '1.2-2' }}</b></div>
              <nz-divider />
              <div class="fee__row fee__row--total"><span>预估合计</span><b>¥ {{ result.fee.totalAmount | number: '1.2-2' }}</b></div>
              <div class="text-secondary mt-8">
                {{ result.serviceAreaChecked ? '地址已通过服务区域校验' : '该商家未配置服务区域，跳过区域校验' }}
              </div>
            </div>
          } @else {
            <div class="text-secondary mt-16">填写地址与重量后点击「预估费用」，费用明细将在此展示。</div>
          }
        </div>

        <div class="card mt-16">
          <div class="card__title">下单校验</div>
          <ul class="checklist">
            <li [class.ok]="valid().merchant">运营商家已选择</li>
            <li [class.ok]="valid().sender">寄件信息完整（含坐标）</li>
            <li [class.ok]="valid().receiver">收件信息完整（含坐标）</li>
            <li [class.ok]="valid().item">物品信息完整且非禁运品</li>
          </ul>
          <button nz-button nzType="primary" nzBlock [nzLoading]="submitting()" [disabled]="!canSubmit()" (click)="submit()">
            提交订单
          </button>
        </div>
      </div>
    </div>
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
      .fee__row--total {
        font-size: 15px;
      }
      .fee__row--total b {
        color: #d4380d;
        font-size: 20px;
      }
      .checklist {
        list-style: none;
        padding: 0;
        margin: 0 0 14px;
        font-size: 13px;
        color: #98a2b3;
      }
      .checklist li::before {
        content: '○ ';
      }
      .checklist li.ok {
        color: #52c41a;
      }
      .checklist li.ok::before {
        content: '● ';
      }
    `,
  ],
})
export class OrderCreatePage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly perm = inject(PermissionService);
  private readonly auth = inject(AuthService);

  readonly categories = ItemCategories;
  readonly estimating = signal(false);
  readonly submitting = signal(false);
  readonly pickMode = signal<Side | null>(null);
  readonly estimateResult = signal<OrderEstimateDto | null>(null);
  readonly merchants = signal<UserListItemDto[]>([]);
  readonly merchantOptions = signal<SelectOption[]>([]);
  readonly merchantHint = signal('');

  scheduledAt: Date | null = null;

  model = {
    merchantId: '',
    senderName: '',
    senderPhone: '',
    senderAddress: '',
    senderLat: 30.2741,
    senderLng: 120.1551,
    receiverName: '',
    receiverPhone: '',
    receiverAddress: '',
    receiverLat: 30.2841,
    receiverLng: 120.1651,
    itemCategory: 'documents',
    itemName: '',
    weightKg: 1,
    volumeM3: 0.01,
    quantity: 1,
    isUrgent: false,
    couponAmount: 0,
    complianceProofUrl: null as string | null,
    remark: '',
  };

  readonly canPickMerchant = computed(() => this.perm.can('account.user.manage'));

  readonly valid = computed(() => {
    const m = this.model;
    return {
      merchant: !!m.merchantId,
      sender: !!m.senderName && /^1\d{10}$/.test(m.senderPhone) && !!m.senderAddress && !!m.senderLat && !!m.senderLng,
      receiver: !!m.receiverName && /^1\d{10}$/.test(m.receiverPhone) && !!m.receiverAddress && !!m.receiverLat && !!m.receiverLng,
      item: !!m.itemCategory && !!m.itemName && m.weightKg > 0 && !this.categories.find((c) => c.code === m.itemCategory)?.prohibited,
    };
  });

  readonly canSubmit = computed(() => Object.values(this.valid()).every(Boolean));

  readonly mapMarkers = computed<MapMarker[]>(() => {
    const markers: MapMarker[] = [];
    if (this.model.senderLat && this.model.senderLng) {
      markers.push({ lat: this.model.senderLat, lng: this.model.senderLng, label: '寄件', tone: 'blue' });
    }
    if (this.model.receiverLat && this.model.receiverLng) {
      markers.push({ lat: this.model.receiverLat, lng: this.model.receiverLng, label: '收件', tone: 'green' });
    }
    return markers;
  });

  constructor() {
    const me = this.auth.user();
    if (me?.userType === 'Merchant' || me?.userType === 'MerchantStaff') {
      this.model.merchantId = me.id;
      this.merchantHint.set(`已绑定商家：${me.companyName ?? me.displayName}`);
    }
    if (this.canPickMerchant()) this.loadMerchants('');
  }

  back(): void {
    void this.router.navigateByUrl('/orders');
  }

  togglePick(side: Side): void {
    this.pickMode.set(this.pickMode() === side ? null : side);
  }

  onPick(point: LatLng): void {
    const side = this.pickMode();
    if (!side) return;
    if (side === 'sender') {
      this.model.senderLat = Number(point.lat.toFixed(6));
      this.model.senderLng = Number(point.lng.toFixed(6));
    } else {
      this.model.receiverLat = Number(point.lat.toFixed(6));
      this.model.receiverLng = Number(point.lng.toFixed(6));
    }
    this.pickMode.set(null);
    this.refreshEstimate();
  }

  onCategory(code: string): void {
    const category = this.categories.find((c) => c.code === code);
    if (category?.prohibited) {
      this.message.error(`「${category.name}」属禁运品，无法下单`);
      this.model.itemCategory = 'documents';
    }
    this.refreshEstimate();
  }

  loadMerchants(keyword: string): void {
    if (!this.canPickMerchant()) return;
    this.api
      .get<Paged<UserListItemDto>>('/admin/users', { pageNum: 1, pageSize: 30, roleCode: 'Merchant', status: 1, keyword: keyword || undefined })
      .subscribe({
        next: (page) => {
          this.merchants.set(page.items ?? []);
          this.merchantOptions.set(
            (page.items ?? []).map((u) => ({ value: u.id, label: `${u.displayName}（${u.phone}）` })),
          );
        },
        error: () => undefined,
      });
  }

  refreshEstimate(): void {
    this.estimateResult.set(null);
  }

  estimate(): void {
    if (!this.canSubmit()) {
      this.message.warning('请先补全寄收信息与物品信息');
      return;
    }
    this.estimating.set(true);
    this.api.post<OrderEstimateDto>('/orders/estimate', this.buildRequest()).subscribe({
      next: (result) => {
        this.estimating.set(false);
        this.estimateResult.set(result);
      },
      error: () => this.estimating.set(false),
    });
  }

  submit(): void {
    if (!this.canSubmit()) {
      this.message.warning('请先补全寄收信息与物品信息');
      return;
    }
    this.submitting.set(true);
    this.api.post<OrderDto>('/orders', this.buildRequest()).subscribe({
      next: (order) => {
        this.submitting.set(false);
        this.message.success(`订单已创建：${order.orderNo}`);
        void this.router.navigate(['/orders', order.id]);
      },
      error: () => this.submitting.set(false),
    });
  }

  private buildRequest(): OrderCreateRequest {
    const m = this.model;
    return {
      merchantId: m.merchantId,
      senderName: m.senderName,
      senderPhone: m.senderPhone,
      senderAddress: m.senderAddress,
      senderLat: Number(m.senderLat),
      senderLng: Number(m.senderLng),
      receiverName: m.receiverName,
      receiverPhone: m.receiverPhone,
      receiverAddress: m.receiverAddress,
      receiverLat: Number(m.receiverLat),
      receiverLng: Number(m.receiverLng),
      itemCategory: m.itemCategory,
      itemName: m.itemName,
      weightKg: Number(m.weightKg),
      volumeM3: Number(m.volumeM3),
      quantity: Number(m.quantity),
      isUrgent: !!m.isUrgent,
      scheduledAt: this.scheduledAt ? this.toIso(this.scheduledAt) : null,
      couponAmount: Number(m.couponAmount ?? 0),
      complianceProofUrl: m.complianceProofUrl,
      remark: m.remark || null,
    };
  }

  private toIso(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  }

  goToOrders(): void {
    void this.router.navigateByUrl('/orders');
  }
}

