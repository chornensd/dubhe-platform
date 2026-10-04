import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { ApiService } from '../../core/api.service';
import { AgentInfoDto, AgentTaskTypeNameText } from '../../core/api-types';
import { PermissionService } from '../../core/permission.service';
import { PageHeaderComponent } from '../../shared/page-header';

/** 智能体信息：骨架实现的能力说明与路线图 */
@Component({
  selector: 'app-info',
  standalone: true,
  imports: [
    CommonModule,
    NzButtonModule,
    NzEmptyModule,
    NzIconModule,
    NzSpinModule,
    NzTagModule,
    NzTimelineModule,
    PageHeaderComponent,
  ],
  template: `
    <app-page-header title="智能体信息" subtitle="智能体实现形态、支持的任务类型与演进路线">
      <button nz-button (click)="load()"><span nz-icon nzType="reload"></span> 刷新</button>
    </app-page-header>

    @if (!perm.canAny(['agent.use', 'agent.manage'])) {
      <div class="card">
        <nz-empty nzNotFoundContent="当前账号无智能体使用权限" />
      </div>
    } @else {
      <div class="card skeleton-notice">
        <span nz-icon nzType="experiment" class="skeleton-notice__icon"></span>
        <div>
          <div class="skeleton-notice__title">骨架实现（未接入 LLM）</div>
          <div class="skeleton-notice__text">
            当前智能体仅提供知识库、任务、协定的持久化与 API 形态，任务执行为模拟输出，未接入真实大模型与向量检索。
          </div>
        </div>
      </div>

      @if (loading()) {
        <div class="card"><div class="page-loading"><nz-spin nzTip="智能体信息加载中" /></div></div>
      } @else if (!info()) {
        <div class="card"><nz-empty nzNotFoundContent="智能体信息暂不可用" /></div>
      } @else {
        <div class="card">
          <div class="card__title">实现形态</div>
          <div class="impl">
            <span class="impl__name mono">{{ info()!.implementation }}</span>
            @if (isStub()) {
              <nz-tag nzColor="orange">stub</nz-tag>
            } @else {
              <nz-tag nzColor="green">已接入</nz-tag>
            }
          </div>
          <div class="text-secondary mt-8">{{ info()!.description }}</div>
        </div>

        <div class="card">
          <div class="card__title">支持的任务类型</div>
          @if (info()!.supportedTaskTypes.length) {
            <div class="type-tags">
              @for (type of info()!.supportedTaskTypes; track type) {
                <nz-tag nzColor="blue">{{ taskTypeText(type) }}</nz-tag>
              }
            </div>
          } @else {
            <nz-empty nzNotFoundContent="暂无支持的任务类型" />
          }
        </div>

        <div class="card">
          <div class="card__title">演进路线</div>
          @if (info()!.roadmap.length) {
            <nz-timeline>
              @for (item of info()!.roadmap; track item) {
                <nz-timeline-item>{{ item }}</nz-timeline-item>
              }
            </nz-timeline>
          } @else {
            <nz-empty nzNotFoundContent="暂无路线图信息" />
          }
        </div>
      }
    }
  `,
  styles: [
    `
      .skeleton-notice {
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }
      .skeleton-notice__icon {
        color: #faad14;
        font-size: 18px;
        margin-top: 2px;
      }
      .skeleton-notice__title {
        font-weight: 600;
        margin-bottom: 4px;
      }
      .skeleton-notice__text {
        font-size: 13px;
        color: #6b7688;
        line-height: 1.7;
      }
      .impl {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .impl__name {
        font-size: 14px;
        color: #1f2637;
      }
      .type-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
    `,
  ],
})
export class AgentInfoPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly perm = inject(PermissionService);

  readonly info = signal<AgentInfoDto | null>(null);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (!this.perm.canAny(['agent.use', 'agent.manage'])) return;
    this.loading.set(true);
    this.api.get<AgentInfoDto>('/agent/info').subscribe({
      next: (info) => {
        this.loading.set(false);
        this.info.set(info ?? null);
      },
      error: () => {
        this.loading.set(false);
        this.info.set(null);
      },
    });
  }

  isStub(): boolean {
    return /stub/i.test(this.info()?.implementation ?? '');
  }

  taskTypeText(type: string): string {
    return AgentTaskTypeNameText[type] ?? type;
  }
}
