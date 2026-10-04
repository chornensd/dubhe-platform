import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ApiService } from '../../core/api.service';
import { NotificationDto, NotificationTypeNameText, Paged } from '../../core/api-types';
import { PagedList } from '../../core/paged-list';
import { DataColumn, DataTableComponent } from '../../shared/data-table';
import { PageHeaderComponent } from '../../shared/page-header';

type NotificationRow = NotificationDto & Record<string, unknown>;

/** 消息通知：平台消息列表与已读管理 */
@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, NzButtonModule, NzCheckboxModule, NzIconModule, PageHeaderComponent, DataTableComponent],
  template: `
    <app-page-header title="消息通知" subtitle="订单、告警、工单等业务提醒集中查看">
      <button nz-button [disabled]="list.loading()" (click)="markAllRead()">
        <span nz-icon nzType="check-circle"></span> 全部已读
      </button>
      <button nz-button (click)="list.reload()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    <div class="card">
      <div class="filter-bar">
        <label nz-checkbox [ngModel]="unreadOnly()" (ngModelChange)="onUnreadOnly($event)">仅看未读</label>
        <span class="filter-bar__spacer"></span>
        <span class="text-secondary">共 {{ list.total() }} 条消息</span>
      </div>

      <app-data-table
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [pageNum]="list.pageNum"
        [pageSize]="list.pageSize"
        [loading]="list.loading()"
        emptyText="暂无消息通知"
        scrollX="1100px"
        (pageChange)="list.page($event)"
      >
        <ng-template #actions let-row>
          @if (!row.isRead) {
            <button nz-button nzType="link" nzSize="small" (click)="markRead(row)">标记已读</button>
          } @else {
            <span class="text-secondary">已读</span>
          }
        </ng-template>
      </app-data-table>
    </div>
  `,
})
export class NotificationPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly message = inject(NzMessageService);

  readonly unreadOnly = signal(false);

  readonly list = new PagedList<NotificationRow>((query) =>
    this.api.get<Paged<NotificationRow>>('/notifications', {
      ...query,
      unreadOnly: this.unreadOnly() ? true : undefined,
    }),
  );

  readonly columns: DataColumn<NotificationRow>[] = [
    { key: 'type', title: '类型', width: '110px', type: 'status', map: NotificationTypeNameText },
    { key: 'title', title: '标题', width: '220px' },
    { key: 'content', title: '内容', ellipsis: true },
    { key: 'createdAt', title: '时间', width: '170px', type: 'datetime' },
    {
      key: 'isRead',
      title: '状态',
      width: '90px',
      type: 'status',
      pipe: (row) => (row.isRead ? '已读' : '未读'),
    },
  ];

  ngOnInit(): void {
    this.list.reload();
  }

  onUnreadOnly(value: boolean): void {
    this.unreadOnly.set(value);
    this.list.filter({});
  }

  markRead(row: NotificationRow): void {
    this.api.post<void>(`/notifications/${row.id}/read`).subscribe(() => {
      this.message.success('已标记为已读');
      this.list.reload();
    });
  }

  markAllRead(): void {
    this.api.post<{ marked: number }>('/notifications/read-all').subscribe((result) => {
      this.message.success(`已标记 ${result?.marked ?? 0} 条消息为已读`);
      this.list.reload();
    });
  }
}
