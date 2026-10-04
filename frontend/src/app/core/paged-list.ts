import { Observable } from 'rxjs';
import { Paged } from './api-types';
import { PageChange } from '../shared/data-table';
import { signal } from '@angular/core';

export type QueryParams = Record<string, unknown>;

/** 分页列表状态封装：查询条件 + 分页 + 加载态，统一 reload/page 语义 */
export class PagedList<T> {
  readonly rows = signal<T[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly query = signal<QueryParams>({ pageNum: 1, pageSize: 20 });

  constructor(private readonly loader: (query: QueryParams) => Observable<Paged<T>>) {}

  /** 当前页码（模板直接用 list.pageNum） */
  get pageNum(): number {
    return Number(this.query()['pageNum'] ?? 1);
  }

  /** 当前每页条数 */
  get pageSize(): number {
    return Number(this.query()['pageSize'] ?? 20);
  }

  /** 修改筛选条件并回到第一页 */
  filter(patch: QueryParams): void {
    this.query.update((q) => ({ ...q, ...patch, pageNum: 1 }));
    this.reload();
  }

  /** 仅修改查询条件（不触发请求） */
  setQuery(patch: QueryParams): void {
    this.query.update((q) => ({ ...q, ...patch }));
  }

  page(change: PageChange): void {
    this.query.update((q) => ({ ...q, pageNum: change.pageNum, pageSize: change.pageSize }));
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loader(this.query()).subscribe({
      next: (page) => {
        this.rows.set(page?.items ?? []);
        this.total.set(page?.total ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.rows.set([]);
        this.total.set(0);
        this.loading.set(false);
      },
    });
  }
}

export interface SelectOptionLike {
  label: string;
  value: string | number | null;
}

/** 字典 → 下拉选项 */
export function dictOptions(map: Record<string | number, string>): SelectOptionLike[] {
  return Object.entries(map).map(([value, label]) => ({ label, value: /^\d+$/.test(value) ? Number(value) : value }));
}

/** 列表 → 下拉选项 */
export function toOptions<T>(items: T[], label: (item: T) => string, value: (item: T) => string | number | null): SelectOptionLike[] {
  return items.map((item) => ({ label: label(item), value: value(item) }));
}

/** 实体名缓存（id → 名称），用于列表展示关联对象 */
export function nameMap<T>(items: T[], id: (item: T) => string, name: (item: T) => string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of items) map[id(item)] = name(item);
  return map;
}
