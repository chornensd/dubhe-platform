# Dubhe PC Web（frontend/）— 实现约定（已随 Angular 22 + NG-ZORRO 22 实编译验证）

> 所有页面必须遵循本文件；`src/app/core/api-types.ts` 与 `API.md` 是接口契约的唯一来源。

## 0 已就绪的基础设施（不要修改）

| 文件 | 作用 |
| --- | --- |
| `src/app/core/api-types.ts` | 全部 DTO/枚举/中文字典（数字枚举 + 字符串枚举字典 `XxxNameText`） |
| `src/app/core/api.service.ts` | `inject(ApiService)`：`get/post/put/del/upload/downloadGet/downloadPost`，自动解包 `data`、弹错误提示 |
| `src/app/core/auth.service.ts` | 登录态 signals：`user() / roles() / permissions() / isLoggedIn()` |
| `src/app/core/permission.service.ts` | `perm.can('order.dispatch')`（Admin 通配 `*`） |
| `src/app/core/paged-list.ts` | `PagedList<T>`：`rows() total() loading() query() pageNum pageSize filter() page() reload()` |
| `src/app/core/confirm.service.ts` | `confirm.open({title,content,danger})` → `Observable<boolean>`；`confirm.prompt({title,placeholder,danger})` → `Observable<string|null>` |
| `src/app/shared/data-table.ts` | `<app-data-table [columns] [rows] [total] [pageNum]="list.pageNum" [pageSize]="list.pageSize" [loading] (pageChange)="list.page($event)" (rowClick)>` + `<ng-template #actions let-row>` |
| `src/app/shared/schema-form.ts` | `<app-schema-form [fields] [(model)] />`（必填校验由 `app-modal` 自动触发） |
| `src/app/shared/modal.ts` | `<app-modal [(open)]="open" title okText [loading] (ok)="submit()">表单内容</app-modal>` |
| `src/app/shared/status-tag.ts` | `<app-status-tag [value]="row.status" [map]="OrderStatusNameText" />` |
| `src/app/shared/stat-card.ts` | `<app-stat-card label value unit hint trend alert dark />` |
| `src/app/shared/chart.ts` | `<app-chart [option]="echartsOption" [height]="320" [dark]="true" />`（ECharts 按需注册：bar/line/pie/gauge/radar/scatter + grid/tooltip/legend/title/toolbox/dataZoom/dataset/visualMap/markLine） |
| `src/app/shared/map-canvas.ts` | `<app-map-canvas [zones] [markers] [path] [heat] [height] [pickable] (pick)="onPick($event)" />`（自绘经纬度地图，无需 Key） |
| `src/app/shared/page-header.ts` | `<app-page-header title subtitle>右侧按钮</app-page-header>` |

## 1 页面骨架（复制此模式）

```ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { ApiService } from '../../core/api.service';
import { PagedList } from '../../core/paged-list';
import { PermissionService } from '../../core/permission.service';
import { PageHeaderComponent } from '../../shared/page-header';
import { DataTableComponent, DataColumn } from '../../shared/data-table';

type Row = XxxDto & Record<string, unknown>;

@Component({
  selector: 'app-xxx', standalone: true,
  imports: [CommonModule, FormsModule, NzButtonModule, PageHeaderComponent, DataTableComponent],
  template: `...`,
})
export class XxxPage implements OnInit {
  private readonly api = inject(ApiService);
  readonly perm = inject(PermissionService);
  readonly list = new PagedList<Row>((q) => this.api.get<Paged<Row>>('/resource/drones', { ...q, ...this.filters() }));
  readonly columns: DataColumn<Row>[] = [ { key: 'serialNo', title: '编号' }, { key: 'status', title: '状态', type: 'status', map: DroneStatusNameText } ];
  ngOnInit(): void { this.list.reload(); }
}
```

`DataColumn.type`：`text | status | money | datetime | date | tag | boolean | percent`；`map` 传字符串枚举字典；`pipe:(row)=>value` 自定义取值；`align`/`width`/`ellipsis`。

## 2 NG-ZORRO v22 注意（实测）

- 输入框前缀：用 `<nz-input-wrapper><span nz-icon nzType="user" nzInputPrefix></span><input nz-input /></nz-input-wrapper>`（`nz-input-group` 已无 `nzPrefix`）。
- `nz-input-number` 占位符是 **`nzPlaceHolder`**（不是 placeholder）。
- 下拉：`<nz-select nzShowSearch nzAllowClear [nzOptions]="opts" [ngModel] (ngModelChange)>`；多选加 `nzMode="multiple"`。
- 日期：`<nz-date-picker nzShowTime nzFormat="yyyy-MM-dd HH:mm" [(ngModel)]="dateObj" />`（值为 `Date`）。
- 表格：`nzShowTotal` 只能传 `TemplateRef`；`nzScroll` 传对象 `{ x: '1280px' }`；`[nzAlign]` 传 `null` 而非 `undefined`。本项目统一用 `app-data-table` 封装，无需直接写 nz-table。
- 下拉菜单（顶栏那种）：触发器元素上加 `nz-dropdown [nzDropdownMenu]="menu"`，菜单是 `<nz-dropdown-menu #menu="nzDropdownMenu">`。
- 弹窗内容必须包在 `<ng-container *nzModalContent>`（`app-modal` 已封装，直接用即可）。
- 图标需已注册（`src/app/icons.ts`）：常用 `user/lock/plus/edit/delete/eye/search/reload/download/upload/send/check/close/clock-circle/calendar/file-text/alert/bell/setting/tool/team/rocket/global/bar-chart/safety-certificate/shopping-cart/car/gateway/api/protection` 等；
  如需未注册图标，改用文字或已注册图标（不要改 icons.ts）。

## 3 权限与角色

- 按钮级：`@if (perm.can('order.dispatch')) { ... }`；无权限不渲染。
- 数据作用域由后端控制（商家/客户/机长只看自己数据），前端不做额外过滤。
- 商家/客户/机长页面要容忍空列表并给出引导文案。

## 4 视觉

- 页面根：`<app-page-header>` + `.card` / `.grid.grid--2|3|4|5|6` + `.card__title`。
- 详情页用 `.desc-grid > .desc-item > .desc-item__label + .desc-item__value`。
- 表格页筛选放 `.filter-bar`；危险操作用 `confirm.open({danger:true})`。
- 金额 `| number:'1.2-2'`；时间列统一 `type:'datetime'`；不要自造状态颜色（用 `app-status-tag`）。
- 不用 emoji；中文文案；不写英文界面词。

## 5 硬性红线

1. 只能改自己负责的页面文件；**不要动** `core/`、`shared/`、`layout/`、`app.*`、`icons.ts`、`angular.json`、`package.json`。
2. 不要执行 `npm install` / `ng build` / `ng serve`（由主流程统一构建验收）；可用 `npx tsc --noEmit -p tsconfig.app.json` 自检，忽略不属于自己的文件报错。
3. 组件类名与文件路径必须与 `app.routes.ts` 中的 `loadComponent` 完全一致。
4. 每个页面必须有：加载态、空态、错误容忍（`error: () => void 0` 或交由拦截器提示）、权限控制、二次确认。
5. 单文件建议 < 500 行，组件 `styles` 数组 < 8kB；复杂页面拆分同目录子组件。
