import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzLayoutModule } from 'ng-zorro-antd/layout';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { filter, interval } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { NotificationDto, Paged, RoleText } from '../core/api-types';
import { NAV_GROUPS, NavItem, defaultHome } from '../core/nav.config';
import { PermissionService } from '../core/permission.service';
import { RealtimeService } from '../core/realtime.service';
import { formatDateTime } from '../shared/data-table';
import { NzListModule } from 'ng-zorro-antd/list';

interface FlatMenu {
  label: string;
  path?: string;
  icon?: string;
  perm?: string[];
  children?: FlatMenu[];
}

/** 主框架：侧边菜单 + 顶栏（通知/会话/用户） */
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    NzLayoutModule,
    NzMenuModule,
    NzIconModule,
    NzDropdownModule,
    NzBadgeModule,
    NzAvatarModule,
    NzButtonModule,
    NzTooltipModule,
    NzEmptyModule,
    NzListModule,
  ],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.scss',
})
export class AppLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly perm = inject(PermissionService);
  private readonly realtime = inject(RealtimeService);
  private readonly message = inject(NzMessageService);

  readonly collapsed = signal(false);
  readonly currentUrl = signal(this.router.url);
  /** 展开的菜单分组（默认只展开当前路由所在分组，其余折叠） */
  readonly openGroups = signal<Set<string>>(new Set());
  readonly notifications = signal<NotificationDto[]>([]);
  readonly unreadCount = signal(0);
  readonly realtimeOn = this.realtime.connected;

  readonly user = this.auth.user;
  readonly rolesText = computed(() => (this.auth.roles().length ? this.auth.roles().map((r) => RoleText[r] ?? r).join(' / ') : '—'));
  readonly menus = computed<FlatMenu[]>(() => this.filterMenus(NAV_GROUPS));

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed()).subscribe(() => {
      this.currentUrl.set(this.router.url);
      this.syncActiveGroup();
      this.closeMobileMenu();
    });

    interval(60000).pipe(takeUntilDestroyed()).subscribe(() => this.checkIdle());

    // 记录活跃 + 会话超时（30 分钟无操作）
    ['click', 'keydown', 'mousemove', 'scroll'].forEach((evt) =>
      document.addEventListener(evt, () => this.auth.touch(), { passive: true }),
    );

    effect(() => {
      const event = this.realtime.lastEvent();
      if (event) this.loadNotifications();
    });

    this.realtime.start();
    this.loadNotifications();
    this.syncActiveGroup();
    interval(45000).pipe(takeUntilDestroyed()).subscribe(() => this.loadNotifications());
  }

  readonly breadcrumbs = computed(() => {
    const url = this.currentUrl().split('?')[0];
    // 取匹配最深（路径最长）的菜单项，避免父项与子项同时命中
    let bestPath = '';
    let bestTrail: string[] = [];
    const walk = (items: FlatMenu[], parents: string[]): void => {
      for (const item of items) {
        if (item.path && item.path !== '/' && url.startsWith(item.path) && item.path.length > bestPath.length) {
          bestPath = item.path;
          bestTrail = [...parents, item.label];
        }
        if (item.children) walk(item.children, [...parents, item.label]);
      }
    };
    walk(this.menus(), []);
    return bestTrail;
  });

  closeMobileMenu(): void {
    if (window.innerWidth < 1200) this.collapsed.set(true);
  }

  onGroupOpen(label: string, open: boolean): void {
    const next = new Set(this.openGroups());
    if (open) next.add(label);
    else next.delete(label);
    this.openGroups.set(next);
  }

  /** 当前路由所在分组默认展开 */
  private syncActiveGroup(): void {
    const url = this.currentUrl().split('?')[0];
    const next = new Set(this.openGroups());
    for (const item of this.menus()) {
      if (item.children?.some((child) => child.path && url.startsWith(child.path))) next.add(item.label);
    }
    this.openGroups.set(next);
  }

  toggle(): void {
    this.collapsed.set(!this.collapsed());
  }

  home(): void {
    void this.router.navigateByUrl(defaultHome(this.auth.roles(), this.auth.permissions()));
  }

  logout(): void {
    this.realtime.stop();
    this.auth.logout(true);
  }

  markRead(item: NotificationDto, event: MouseEvent): void {
    event.stopPropagation();
    this.api.post<void>(`/notifications/${item.id}/read`).subscribe(() => this.loadNotifications());
  }

  markAllRead(): void {
    this.api.post<{ marked: number }>('/notifications/read-all').subscribe((r) => {
      this.message.success(`已标记 ${r.marked ?? 0} 条消息为已读`);
      this.loadNotifications();
    });
  }

  loadNotifications(): void {
    if (!this.auth.isLoggedIn()) return;
    this.api
      .get<Paged<NotificationDto>>('/notifications', { pageNum: 1, pageSize: 5, unreadOnly: true })
      .subscribe({
        next: (page) => {
          this.notifications.set(page.items ?? []);
          this.unreadCount.set(page.total ?? 0);
        },
        error: () => undefined,
      });
  }

  time(value: string): string {
    return formatDateTime(value);
  }

  visible(item: FlatMenu): boolean {
    return item.perm ? this.perm.canAny(item.perm) : true;
  }

  private filterMenus(groups: { label: string; items: NavItem[] }[]): FlatMenu[] {
    const result: FlatMenu[] = [];
    for (const group of groups) {
      const items: FlatMenu[] = [];
      for (const item of group.items) {
        if (item.children) {
          const children = item.children.filter((child) => (child.perm ? this.perm.canAny(child.perm) : true));
          if (children.length) items.push({ ...item, children: children as FlatMenu[] });
        } else if (!item.perm || this.perm.canAny(item.perm)) {
          items.push(item as FlatMenu);
        }
      }
      if (items.length) result.push(...items);
    }
    return result;
  }

  private checkIdle(): void {
    if (!this.auth.isLoggedIn()) return;
    if (this.auth.idleMinutes() >= 30) {
      this.message.warning('会话已超时，请重新登录');
      this.realtime.stop();
      this.auth.logout(false);
    }
  }
}

