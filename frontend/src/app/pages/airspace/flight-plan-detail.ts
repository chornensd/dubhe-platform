import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import {
  AirspaceConflictDto,
  AirspaceZoneDto,
  AirspaceZoneTypeNameText,
  ApprovalSuggestionDto,
  FlightPlanDto,
  FlightPlanStatusNameText,
  Paged,
  UserListItemDto,
} from '../../core/api-types';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { PermissionService } from '../../core/permission.service';
import { formatDateTime } from '../../shared/data-table';
import { MapCanvasComponent, MapZone } from '../../shared/map-canvas';
import { PageHeaderComponent } from '../../shared/page-header';
import { StatusTagComponent } from '../../shared/status-tag';

/** 飞行计划详情：航线与空域叠加、冲突提示、审批与操作日志 */
@Component({
  selector: 'app-flight-plan-detail',
  standalone: true,
  imports: [
    CommonModule,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzIconModule,
    NzSpinModule,
    PageHeaderComponent,
    MapCanvasComponent,
    StatusTagComponent,
  ],
  template: `
    <app-page-header [title]="pageTitle()" subtitle="申报信息、空域冲突校验与审批流转记录">
      <button nz-button (click)="back()"><span nz-icon nzType="left"></span> 返回列表</button>
      <button nz-button (click)="load()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    @if (loading()) {
      <div class="page-loading"><nz-spin /></div>
    } @else {
      @if (plan(); as p) {
        <div class="card">
          <div class="card__title">
            基本信息
            <app-status-tag [value]="p.status" [map]="FlightPlanStatusNameText" />
          </div>
          <div class="desc-grid">
            <div class="desc-item">
              <span class="desc-item__label">计划编号</span>
              <span class="desc-item__value">{{ p.planNo ?? '—' }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">商家</span>
              <span class="desc-item__value">{{ merchantText(p.merchantId) }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">飞行器</span>
              <span class="desc-item__value">{{ p.droneSerialNo ?? p.droneId }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">机长</span>
              <span class="desc-item__value">{{ p.pilotName ?? '未指定' }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">飞行用途</span>
              <span class="desc-item__value">{{ p.purpose }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">计划时段</span>
              <span class="desc-item__value">{{ fmt(p.startAt) }} ~ {{ fmt(p.endAt) }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">最大高度</span>
              <span class="desc-item__value">{{ p.maxAltitudeM }} m</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">航点数量</span>
              <span class="desc-item__value">{{ p.waypoints?.length ?? 0 }} 个</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">关联订单</span>
              <span class="desc-item__value">{{ p.orderId ?? '未关联' }}</span>
            </div>
            <div class="desc-item">
              <span class="desc-item__label">创建时间</span>
              <span class="desc-item__value">{{ fmt(p.createdAt) }}</span>
            </div>
          </div>
        </div>

        @if (conflicts().length) {
          <nz-alert
            class="mt-16"
            nzType="error"
            nzShowIcon
            [nzMessage]="'检测到 ' + conflicts().length + ' 处空域冲突，提交审批前请调整航线'"
            [nzDescription]="conflictTpl"
          />
          <ng-template #conflictTpl>
            <ul class="detail-list">
              @for (item of conflicts(); track item.code) {
                <li>{{ item.name }}（{{ conflictTypeText(item.type) }}）：{{ item.reason }}</li>
              }
            </ul>
          </ng-template>
        }

        <div class="grid grid--sidebar mt-16">
          <div class="card">
            <div class="card__title">航线与空域叠加</div>
            <app-map-canvas [height]="440" [zones]="mapZones()" [path]="p.waypoints" />
            <div class="text-secondary mt-8">蓝色虚线为申报航线，红色圆圈为存在冲突的空域，其余为生效中的空域与围栏。</div>
          </div>

          <div>
            <div class="card">
              <div class="card__title">审批与操作</div>
              @if (canApprove() && p.status === 'Submitted') {
                <button nz-button nzBlock [nzLoading]="suggestLoading()" (click)="loadSuggestion()">
                  <span nz-icon nzType="safety-certificate"></span> 审批建议
                </button>
                @if (suggestion(); as s) {
                  <nz-alert
                    class="mt-8"
                    [nzType]="suggestionTone(s.suggestion)"
                    nzShowIcon
                    [nzMessage]="suggestionLabel(s.suggestion)"
                    [nzDescription]="suggestionTpl"
                  />
                  <ng-template #suggestionTpl>
                    <ul class="detail-list">
                      @for (reason of s.reasons; track reason) {
                        <li>{{ reason }}</li>
                      }
                    </ul>
                  </ng-template>
                }
                <button nz-button nzType="primary" nzBlock class="mt-8" (click)="approve(p)">批准</button>
                <button nz-button nzBlock nzDanger class="mt-8" (click)="reject(p)">驳回</button>
              }
              @if (perm.can('airspace.plan.submit')) {
                @if (p.status === 'Draft' || p.status === 'Rejected') {
                  <button nz-button nzType="primary" nzBlock (click)="submitPlan(p)">提交申报</button>
                }
                @if (p.status === 'Approved') {
                  <button nz-button nzType="primary" nzBlock (click)="complete(p)">标记完成</button>
                }
                @if (p.status !== 'Cancelled' && p.status !== 'Completed') {
                  <button nz-button nzBlock nzDanger class="mt-8" (click)="cancel(p)">取消计划</button>
                }
              }
              @if (!hasActions()) {
                <div class="text-secondary">当前状态无需操作，或该账号无对应操作权限。</div>
              }
            </div>

            <div class="card mt-16">
              <div class="card__title">审批日志</div>
              <div class="log-list">
                <div><span>提交时间</span><b>{{ fmt(p.submittedAt) }}</b></div>
                <div><span>批准时间</span><b>{{ fmt(p.approvedAt) }}</b></div>
                <div><span>审批意见</span><b>{{ p.approvalComment || '-' }}</b></div>
                <div><span>驳回原因</span><b>{{ p.rejectReason || '-' }}</b></div>
                <div><span>取消时间</span><b>{{ fmt(p.cancelledAt) }}</b></div>
              </div>
            </div>
          </div>
        </div>
      } @else {
        <div class="card">
          <nz-empty nzNotFoundContent="未找到该飞行计划，可能已被删除或无权查看" />
          <div style="text-align: center; margin-top: 12px">
            <button nz-button nzType="primary" (click)="back()">返回列表</button>
          </div>
        </div>
      }
    }
  `,
  styles: [
    `
      .detail-list {
        margin: 6px 0 0;
        padding-left: 18px;
      }
      .detail-list li {
        line-height: 1.8;
      }
      .log-list div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 13px;
        padding: 4px 0;
      }
      .log-list span {
        color: #6b7688;
        flex: 0 0 72px;
      }
      .log-list b {
        font-weight: 500;
        text-align: right;
        word-break: break-all;
      }
    `,
  ],
})
export class FlightPlanDetailPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  readonly perm = inject(PermissionService);

  readonly id = input.required<string>();
  readonly loading = signal(true);
  readonly plan = signal<FlightPlanDto | null>(null);
  readonly zones = signal<AirspaceZoneDto[]>([]);
  readonly merchantNames = signal<Record<string, string>>({});
  readonly suggestion = signal<ApprovalSuggestionDto | null>(null);
  readonly suggestLoading = signal(false);

  readonly FlightPlanStatusNameText = FlightPlanStatusNameText;

  readonly conflicts = computed<AirspaceConflictDto[]>(() => this.plan()?.conflicts ?? []);

  readonly mapZones = computed<MapZone[]>(() => {
    const conflictIds = new Set(this.conflicts().map((item) => item.zoneId).filter((id): id is string => !!id));
    return this.zones().map((zone) => ({
      lat: zone.centerLat,
      lng: zone.centerLng,
      radiusKm: zone.radiusKm,
      type: conflictIds.has(zone.id) ? 'NoFly' : zone.source === 'MerchantFence' ? 'Fence' : zone.type,
      name: zone.name,
      code: zone.code,
      active: zone.isActive,
    }));
  });

  readonly pageTitle = computed(() => {
    const p = this.plan();
    return p?.planNo ? `飞行计划 ${p.planNo}` : '飞行计划详情';
  });

  readonly hasActions = computed(() => {
    const p = this.plan();
    if (!p) return false;
    const submit = this.perm.can('airspace.plan.submit');
    const submitVisible = submit && p.status !== 'Submitted' && p.status !== 'Cancelled' && p.status !== 'Completed';
    const approveVisible = this.canApprove() && p.status === 'Submitted';
    return submitVisible || approveVisible;
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.suggestion.set(null);
    this.api.get<FlightPlanDto>(`/airspace/flight-plans/${this.id()}`).subscribe({
      next: (plan) => {
        this.plan.set(plan);
        this.loading.set(false);
      },
      error: () => {
        this.plan.set(null);
        this.loading.set(false);
      },
    });
    this.loadZones();
    this.loadMerchantNames();
  }

  back(): void {
    void this.router.navigateByUrl('/airspace/flight-plans');
  }

  canApprove(): boolean {
    return this.perm.can('airspace.plan.approve');
  }

  fmt(value: unknown): string {
    return formatDateTime(value);
  }

  merchantText(id: string): string {
    return this.merchantNames()[id] ?? id.slice(0, 8);
  }

  conflictTypeText(type: string): string {
    if (type === 'PlanConflict') return '计划冲突';
    return AirspaceZoneTypeNameText[type] ?? type;
  }

  suggestionTone(suggestion: string): 'success' | 'error' | 'warning' | 'info' {
    if (suggestion === 'Approve') return 'success';
    if (suggestion === 'Reject') return 'error';
    if (suggestion === 'Review') return 'warning';
    return 'info';
  }

  suggestionLabel(suggestion: string): string {
    if (suggestion === 'Approve') return '审批建议：建议批准';
    if (suggestion === 'Reject') return '审批建议：建议驳回';
    if (suggestion === 'Review') return '审批建议：建议人工复核';
    return `审批建议：${suggestion}`;
  }

  loadSuggestion(): void {
    const p = this.plan();
    if (!p) return;
    this.suggestLoading.set(true);
    this.api.get<ApprovalSuggestionDto>(`/airspace/flight-plans/${p.id}/approval-suggestion`).subscribe({
      next: (result) => {
        this.suggestLoading.set(false);
        this.suggestion.set(result);
      },
      error: () => this.suggestLoading.set(false),
    });
  }

  approve(p: FlightPlanDto): void {
    this.confirm
      .prompt({ title: '批准飞行计划', placeholder: '审批意见（选填）', required: false })
      .subscribe((comment) => {
        if (comment === null) return;
        this.api.post<FlightPlanDto>(`/airspace/flight-plans/${p.id}/approve`, { comment: comment || null }).subscribe({
          next: () => {
            this.message.success('已批准该飞行计划');
            this.load();
          },
        });
      });
  }

  reject(p: FlightPlanDto): void {
    this.confirm
      .prompt({ title: '驳回飞行计划', placeholder: '请填写驳回原因（将通知申报商家）', danger: true })
      .subscribe((reason) => {
        if (!reason) return;
        this.api.post<FlightPlanDto>(`/airspace/flight-plans/${p.id}/reject`, { reason }).subscribe({
          next: () => {
            this.message.success('已驳回该飞行计划');
            this.load();
          },
        });
      });
  }

  submitPlan(p: FlightPlanDto): void {
    this.api.post<FlightPlanDto>(`/airspace/flight-plans/${p.id}/submit`).subscribe({
      next: () => {
        this.message.success('已提交审批');
        this.load();
      },
    });
  }

  complete(p: FlightPlanDto): void {
    this.confirm
      .open({ title: '完成飞行计划', content: '确认将该已批准计划标记为已完成？完成后不可再变更。' })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.post<FlightPlanDto>(`/airspace/flight-plans/${p.id}/complete`).subscribe({
          next: () => {
            this.message.success('计划已标记完成');
            this.load();
          },
        });
      });
  }

  cancel(p: FlightPlanDto): void {
    this.confirm
      .open({ title: '取消飞行计划', content: `确认取消计划「${p.planNo ?? p.purpose}」？取消后不可恢复。`, danger: true })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.post<FlightPlanDto>(`/airspace/flight-plans/${p.id}/cancel`).subscribe({
          next: () => {
            this.message.success('计划已取消');
            this.load();
          },
        });
      });
  }

  private loadZones(): void {
    this.api.get<Paged<AirspaceZoneDto>>('/airspace/zones', { pageNum: 1, pageSize: 200, activeOnly: true }).subscribe({
      next: (page) => this.zones.set(page.items ?? []),
      error: () => undefined,
    });
  }

  private loadMerchantNames(): void {
    const me = this.auth.user();
    if (me?.userType === 'Merchant') {
      this.merchantNames.update((map) => ({ ...map, [me.id]: me.companyName ?? me.displayName }));
    }
    if (!this.perm.can('account.user.manage')) return;
    this.api
      .get<Paged<UserListItemDto>>('/admin/users', { pageNum: 1, pageSize: 200, roleCode: 'Merchant' })
      .subscribe({
        next: (page) => {
          const map: Record<string, string> = {};
          for (const user of page.items ?? []) map[user.id] = user.displayName;
          this.merchantNames.update((prev) => ({ ...prev, ...map }));
        },
        error: () => undefined,
      });
  }
}

