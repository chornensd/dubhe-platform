import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { ApiService } from '../../core/api.service';
import { OrderImportResultDto, Paged, UserListItemDto } from '../../core/api-types';
import { AuthService } from '../../core/auth.service';
import { ConfirmService } from '../../core/confirm.service';
import { PermissionService } from '../../core/permission.service';
import { PageHeaderComponent } from '../../shared/page-header';
import { SearchSelectComponent, SelectOption } from '../../shared/search-select';
import { StatCardComponent } from '../../shared/stat-card';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Component({
  selector: 'app-order-import',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzTableModule,
    NzUploadModule,
    PageHeaderComponent,
    SearchSelectComponent,
    StatCardComponent,
  ],
  template: `
    <app-page-header title="订单批量导入" subtitle="使用 Excel 模板一次性创建多笔订单，单次最多 500 行">
      <button nz-button (click)="back()"><span nz-icon nzType="left"></span> 返回列表</button>
      <button nz-button [nzLoading]="downloading()" (click)="downloadTemplate()">
        <span nz-icon nzType="download"></span> 下载导入模板
      </button>
    </app-page-header>

    <div class="grid grid--sidebar">
      <div>
        <div class="card">
          <div class="card__title">上传文件</div>
          <div class="filter-bar">
            <span class="filter-bar__label">运营商家</span>
            @if (canPickMerchant()) {
              <app-search-select
                style="flex: 1; max-width: 380px"
                [options]="merchantOptions()"
                placeholder="输入商家名称/手机号搜索"
                [ngModel]="merchantId()"
                (ngModelChange)="onMerchantChange($event)"
                (search)="loadMerchants($event)"
              />
            } @else if (merchantHint()) {
              <span class="text-secondary">{{ merchantHint() }}</span>
            } @else {
              <input nz-input style="max-width: 380px" placeholder="商家 ID（当前账号未绑定商家时手动填写）" [ngModel]="merchantId()" (ngModelChange)="onMerchantChange($event)" />
            }
          </div>

          <nz-upload
            nzType="drag"
            nzAccept=".xlsx"
            [nzMultiple]="false"
            [nzShowUploadList]="false"
            [nzDisabled]="importing()"
            [nzBeforeUpload]="beforeUpload"
          >
            <p class="upload-icon"><span nz-icon nzType="file-excel"></span></p>
            <p class="upload-text">点击或拖拽 .xlsx 文件到此处</p>
            <p class="upload-hint">仅支持 .xlsx 格式，文件大小不超过 10MB，单次最多 500 行</p>
          </nz-upload>

          <div class="filter-bar mt-16">
            @if (file(); as selected) {
              <span class="text-secondary">已选择：{{ selected.name }}（{{ selected.size / 1024 | number: '1.0-1' }} KB）</span>
            } @else {
              <span class="text-secondary">尚未选择文件</span>
            }
            <span class="filter-bar__spacer"></span>
            <button nz-button [disabled]="!file() || importing()" (click)="clearFile()">清空</button>
            <button nz-button nzType="primary" [nzLoading]="importing()" [disabled]="!file() || !merchantId()" (click)="startImport()">
              <span nz-icon nzType="upload"></span> 开始导入
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card__title">导入结果</div>
          @if (result(); as res) {
            <div class="grid grid--3">
              <app-stat-card label="总行数" [value]="res.total" />
              <app-stat-card label="成功" [value]="res.succeeded" />
              <app-stat-card label="失败" [value]="res.failed" [alert]="res.failed > 0" />
            </div>
            @if (res.errors.length) {
              <div class="card__subtitle mt-16">失败明细（修正后可重新导入对应行）</div>
              <nz-table [nzData]="res.errors" [nzFrontPagination]="false" [nzShowPagination]="false" nzSize="small">
                <thead>
                  <tr>
                    <th style="width: 120px">行号</th>
                    <th>失败原因</th>
                  </tr>
                </thead>
                <tbody>
                  @for (err of res.errors; track err.rowNumber) {
                    <tr>
                      <td>第 {{ err.rowNumber }} 行</td>
                      <td class="text-danger">{{ err.message }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            }
            @if (res.orderIds.length) {
              <div class="card__subtitle mt-16">成功订单（共 {{ res.orderIds.length }} 单，点击序号跳转详情）</div>
              <div class="order-links">
                @for (id of res.orderIds; track id; let index = $index) {
                  <a class="order-links__item" [title]="id" (click)="openOrder(id)">{{ index + 1 }}</a>
                }
              </div>
            }
          } @else {
            <div class="text-secondary">尚未执行导入。选择模板文件并点击「开始导入」后，这里将展示成功与失败明细。</div>
          }
        </div>
      </div>

      <div>
        <div class="card">
          <div class="card__title">填写说明</div>
          <ul class="tips">
            <li>请下载并使用平台模板，勿修改表头名称，数据从第 2 行开始填写。</li>
            <li>单次最多导入 500 行，文件须为 .xlsx 且不超过 10MB。</li>
            <li>
              必填列：寄件人姓名、寄件人电话、寄件地址、寄件纬度、寄件经度、收件人姓名、收件人电话、收件地址、收件纬度、收件经度、物品类型、物品名称、重量(kg)。
            </li>
            <li>可选列：体积(m³)、数量、加急、预约时间、优惠金额、备注。</li>
            <li>物品类型可填编码或中文名（如 documents / 文件票据），禁运品将被拒绝。</li>
            <li>坐标使用十进制度（如 30.2730），加急填“是/否”，预约时间格式为 yyyy-MM-dd HH:mm。</li>
            <li>失败行会返回行号与原因，可修正后重新导入。</li>
          </ul>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .upload-icon {
        font-size: 40px;
        color: #1677ff;
        margin: 8px 0 4px;
      }
      .upload-text {
        font-size: 15px;
        color: #1f2637;
        margin: 0 0 4px;
      }
      .upload-hint {
        font-size: 12px;
        color: #98a2b3;
        margin: 0;
      }
      .tips {
        margin: 0;
        padding-left: 18px;
        font-size: 13px;
        line-height: 1.9;
        color: #4a5568;
      }
      .order-links {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        max-height: 180px;
        overflow: auto;
        margin-top: 8px;
      }
      .order-links__item {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 30px;
        height: 24px;
        padding: 0 6px;
        border: 1px solid #adc6ff;
        background: #f0f5ff;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
      }
    `,
  ],
})
export class OrderImportPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  private readonly perm = inject(PermissionService);

  readonly downloading = signal(false);
  readonly importing = signal(false);
  readonly file = signal<File | null>(null);
  readonly result = signal<OrderImportResultDto | null>(null);
  readonly merchantId = signal('');
  readonly merchantHint = signal('');
  readonly merchantOptions = signal<SelectOption[]>([]);

  readonly canPickMerchant = computed(() => this.perm.can('account.user.manage'));

  constructor() {
    const me = this.auth.user();
    if (me?.userType === 'Merchant' || me?.userType === 'MerchantStaff') {
      this.merchantId.set(me.id);
      this.merchantHint.set(`已绑定商家：${me.companyName ?? me.displayName}`);
    } else if (this.canPickMerchant()) {
      this.loadMerchants('');
    }
  }

  back(): void {
    void this.router.navigateByUrl('/orders');
  }

  downloadTemplate(): void {
    this.downloading.set(true);
    this.api.downloadGet('/orders/import/template', 'order-import-template.xlsx').subscribe({
      next: () => {
        this.downloading.set(false);
        this.message.success('模板已开始下载');
      },
      error: () => this.downloading.set(false),
    });
  }

  beforeUpload = (file: NzUploadFile): boolean => {
    const name = file.name ?? '';
    if (!name.toLowerCase().endsWith('.xlsx')) {
      this.message.error('仅支持 .xlsx 格式的模板文件');
      return false;
    }
    if ((file.size ?? 0) > MAX_FILE_SIZE) {
      this.message.error('文件大小不能超过 10MB');
      return false;
    }
    this.file.set(file.originFileObj ?? (file as unknown as File));
    this.result.set(null);
    return false;
  };

  clearFile(): void {
    this.file.set(null);
  }

  onMerchantChange(value: string | number | null): void {
    this.merchantId.set(value === null || value === undefined ? '' : String(value));
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

  startImport(): void {
    const file = this.file();
    if (!file) {
      this.message.warning('请先选择 .xlsx 文件');
      return;
    }
    const merchantId = this.merchantId();
    if (!merchantId) {
      this.message.warning('请先选择运营商家');
      return;
    }
    this.confirm
      .open({ title: '开始导入', content: `将按模板批量创建订单，文件：${file.name}。确认开始导入？` })
      .subscribe((ok) => {
        if (!ok) return;
        this.importing.set(true);
        this.api.upload<OrderImportResultDto>('/orders/import', file, 'file', { merchantId }).subscribe({
          next: (res) => {
            this.importing.set(false);
            this.result.set(res);
            if (res.failed > 0) this.message.warning(`导入完成：成功 ${res.succeeded} 行，失败 ${res.failed} 行`);
            else this.message.success(`导入完成：共 ${res.total} 行，全部成功`);
          },
          error: () => this.importing.set(false),
        });
      });
  }

  openOrder(id: string): void {
    void this.router.navigate(['/orders', id]);
  }
}

