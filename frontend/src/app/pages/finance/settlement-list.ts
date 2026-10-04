import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ApiService } from '../../core/api.service';
import {
  Paged,
  StatementStatus,
  StatementStatusNameText,
  SettlementStatementDto,
  UserListItemDto,
} from '../../core/api-types';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { PagedList } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { DataColumn, DataTableComponent, formatDateTime } from '../../shared/data-table';
import { ModalComponent } from '../../shared/modal';
import { PageHeaderComponent } from '../../shared/page-header';
import { SearchSelectComponent, SelectOption } from '../../shared/search-select';

type SettlementRow = SettlementStatementDto & Record<string, unknown>;

@Component({
  selector: 'app-settlement-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzDatePickerModule,
    NzFormModule,
    NzIconModule,
    NzSelectModule,
    DataTableComponent,
    ModalComponent,
    PageHeaderComponent,
    SearchSelectComponent,
  ],
  template: `
    <app-page-header title="结算单" subtitle="按周期生成并核对商家结算单，支持商家确认与平台结算">
      <button nz-button nzType="primary" (click)="openGenerate()"><span nz-icon nzType="plus"></span> 生成结算单</button>
      <button nz-button (click)="list.reload()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="card">
      <div class="filter-bar">
        <nz-select style="width: 150px" nzPlaceHolder="全部状态" nzAllowClear [ngModel]="status()" (ngModelChange)="onStatus($event)">
          @for (item of statusOptions; track item.value) {
            <nz-option [nzValue]="item.value" [nzLabel]="item.label" />
          }
        </nz-select>
        <nz-range-picker
          nzFormat="yyyy-MM-dd"
          [nzPlaceHolder]="['周期起', '周期止']"
          [ngModel]="range()"
          (ngModelChange)="range.set($event)"
        ></nz-range-picker>
        @if (canPickMerchant()) {
          <app-search-select
            style="width: 220px"
            [options]="merchantOptions()"
            placeholder="搜索商家"
            [ngModel]="merchantId()"
            (ngModelChange)="onMerchantChange($event)"
            (search)="loadMerchants($event)"
          />
        }
        <button nz-button nzType="primary" (click)="search()"><span nz-icon nzType="search"></span> 查询</button>
        <button nz-button (click)="reset()">重置</button>
        <span class="filter-bar__spacer"></span>
        <span class="text-secondary">共 {{ list.total() }} 张结算单</span>
      </div>

      <app-data-table
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [pageNum]="list.pageNum"
        [pageSize]="list.pageSize"
        [loading]="list.loading()"
        emptyText="暂无结算单，可按周期生成"
        scrollX="1400px"
        (pageChange)="list.page($event)"
      >
        <ng-template #actions let-row>
          <button nz-button nzType="link" nzSize="small" (click)="open(row)">详情</button>
          <button nz-button nzType="link" nzSize="small" (click)="exportRow(row)">导出</button>
          @if (row.status === 'Draft' && perm.can('order.settle')) {
            <button nz-button nzType="link" nzSize="small" (click)="confirmStatement(row)">商家确认</button>
          }
          @if (row.status === 'Confirmed' && isAdmin()) {
            <button nz-button nzType="link" nzSize="small" (click)="settle(row)">平台结算</button>
          }
        </ng-template>
      </app-data-table>
    </div>

    <app-modal [(open)]="generateOpen" title="生成结算单" okText="生成" [loading]="generating()" (ok)="submitGenerate()">
      <nz-form-item>
        <nz-form-label nzRequired>结算周期</nz-form-label>
        <nz-form-control>
          <nz-range-picker style="width: 100%" nzFormat="yyyy-MM-dd" [(ngModel)]="generateRange"></nz-range-picker>
        </nz-form-control>
      </nz-form-item>
      @if (canPickMerchant()) {
        <nz-form-item>
          <nz-form-label>运营商家</nz-form-label>
          <nz-form-control>
            <app-search-select
              [options]="merchantOptions()"
              placeholder="不选择则按当前账号所属商家生成"
              [ngModel]="generateMerchantId()"
              (ngModelChange)="onGenerateMerchant($event)"
              (search)="loadMerchants($event)"
            />
          </nz-form-control>
        </nz-form-item>
      }
      <div class="text-secondary">按订单送达时间统计周期内已送达且未结算过的订单，确认结算后不可撤销。</div>
    </app-modal>
  `,
})
export class SettlementListPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  readonly perm = inject(PermissionService);

  readonly status = signal<number | null>(null);
  readonly range = signal<Date[] | null>(null);
  readonly merchantId = signal('');
  readonly merchantOptions = signal<SelectOption[]>([]);

  readonly generateOpen = signal(false);
  readonly generating = signal(false);
  readonly generateMerchantId = signal('');
  generateRange: Date[] | null = null;

  readonly canPickMerchant = computed(() => this.perm.can('account.user.manage'));
  readonly isAdmin = computed(() => this.auth.isAdmin());

  readonly statusOptions = [
    { value: StatementStatus.Draft, label: '草稿' },
    { value: StatementStatus.Confirmed, label: '已确认' },
    { value: StatementStatus.Settled, label: '已结算' },
  ];

  readonly list = new PagedList<SettlementRow>((query) =>
    this.api.get<Paged<SettlementRow>>('/settlements', {
      ...query,
      status: this.status() ?? undefined,
      merchantId: this.merchantId() || undefined,
      from: this.range() && this.range()![0] ? this.toIso(this.range()![0], false) : undefined,
      to: this.range() && this.range()![1] ? this.toIso(this.range()![1], true) : undefined,
    }),
  );

  readonly columns: DataColumn<SettlementRow>[] = [
    { key: 'statementNo', title: '结算单号', width: '190px' },
    {
      key: 'period',
      title: '结算周期',
      width: '210px',
      pipe: (row) => `${formatDateTime(row.periodStart, 'YYYY-MM-DD')} ~ ${formatDateTime(row.periodEnd, 'YYYY-MM-DD')}`,
    },
    { key: 'orderCount', title: '订单数', width: '90px', align: 'right' },
    { key: 'totalAmount', title: '总金额', width: '120px', type: 'money', align: 'right' },
    { key: 'commissionAmount', title: '佣金', width: '110px', type: 'money', align: 'right' },
    { key: 'netAmount', title: '净额', width: '120px', type: 'money', align: 'right' },
    { key: 'status', title: '状态', width: '100px', type: 'status', map: StatementStatusNameText },
    { key: 'generatedAt', title: '生成时间', width: '150px', type: 'datetime' },
  ];

  ngOnInit(): void {
    this.list.reload();
    if (this.canPickMerchant()) this.loadMerchants('');
  }

  search(): void {
    this.list.filter({});
  }

  reset(): void {
    this.status.set(null);
    this.range.set(null);
    this.merchantId.set('');
    this.list.filter({});
  }

  onStatus(value: number | null): void {
    this.status.set(value);
    this.list.filter({});
  }

  onMerchantChange(value: string | number | null): void {
    this.merchantId.set(value === null || value === undefined ? '' : String(value));
    this.list.filter({});
  }

  onGenerateMerchant(value: string | number | null): void {
    this.generateMerchantId.set(value === null || value === undefined ? '' : String(value));
  }

  loadMerchants(keyword: string): void {
    if (!this.canPickMerchant()) return;
    this.api
      .get<Paged<UserListItemDto>>('/admin/users', { pageNum: 1, pageSize: 30, roleCode: 'Merchant', status: 1, keyword: keyword || undefined })
      .subscribe({
        next: (page) => {
          this.merchantOptions.set(
            (page.items ?? []).map((user) => ({ value: user.id, label: `${user.displayName}（${user.phone}）` })),
          );
        },
        error: () => undefined,
      });
  }

  open(row: SettlementRow): void {
    void this.router.navigate(['/finance/settlements', row.id]);
  }

  exportRow(row: SettlementRow): void {
    this.api.downloadGet(`/settlements/${row.id}/export`, `settlement-${row.statementNo}.xlsx`).subscribe(() => {
      this.message.success('结算单导出已开始');
    });
  }

  confirmStatement(row: SettlementRow): void {
    this.confirm
      .open({ title: '商家确认', content: `确认结算单 ${row.statementNo} 的对账结果？确认后进入平台结算流程。` })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.post<SettlementStatementDto>(`/settlements/${row.id}/confirm`).subscribe(() => {
          this.message.success('结算单已确认');
          this.list.reload();
        });
      });
  }

  settle(row: SettlementRow): void {
    this.confirm
      .open({ title: '平台结算', content: `确认完成结算单 ${row.statementNo} 的平台结算？该操作不可撤销。`, danger: true })
      .subscribe((ok) => {
        if (!ok) return;
        this.api.post<SettlementStatementDto>(`/settlements/${row.id}/settle`).subscribe(() => {
          this.message.success('结算已完成');
          this.list.reload();
        });
      });
  }

  openGenerate(): void {
    this.generateRange = null;
    this.generateMerchantId.set('');
    this.generateOpen.set(true);
  }

  submitGenerate(): void {
    if (!this.generateRange || this.generateRange.length < 2) {
      this.message.warning('请选择结算周期');
      return;
    }
    this.generating.set(true);
    this.api
      .post<SettlementStatementDto>('/settlements/generate', {
        merchantId: this.canPickMerchant() ? this.generateMerchantId() || null : null,
        periodStart: this.toIso(this.generateRange[0], false),
        periodEnd: this.toIso(this.generateRange[1], true),
      })
      .subscribe({
        next: (statement) => {
          this.generating.set(false);
          this.generateOpen.set(false);
          this.message.success(`结算单已生成：${statement.statementNo}`);
          this.list.reload();
        },
        error: () => this.generating.set(false),
      });
  }

  private toIso(date: Date, endOfDay: boolean): string {
    const target = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
    );
    return target.toISOString();
  }
}

