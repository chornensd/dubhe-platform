# 天枢 · 低空智能运营管控平台 — PC Web 端（frontend）

Angular 22 + NG-ZORRO 22 + ECharts 6 实现的 PC 管理端，对接本仓库 `backend/`（ASP.NET Core WebAPI + PostgreSQL）。
覆盖需求文档中的 M1—M7 全部模块与选做智能体（骨架），以及双端适配中的 PC 侧约定（`Device-Type: PC`、8 小时令牌、完整字段与批量/导出操作）。

| 项 | 内容 |
| --- | --- |
| 版本 | V1.0（2026-09-15） |
| 技术栈 | Angular 22（standalone + signals）· NG-ZORRO 22 · ECharts 6 · RxJS 7 · TypeScript 6 |
| 依赖接口 | 后端 `http://localhost:5180`（开发环境经 dev-server 代理） |
| 相关文档 | `API.md`（接口清单）· `CONVENTIONS.md`（实现约定）· 仓库根 `前端说明文档.md`（交付总结）· `测试账号文档.md`（测试角色与数据）· `后端说明文档.md` / `需求分析文档.md` / `技术选型文档.md` |

---

## 1 快速开始

前置：Node.js ≥ 22、npm ≥ 10；后端已按《后端说明文档》完成建库与迁移（PostgreSQL，默认 `localhost:5432/dubhe`）。

```powershell
# 1) 安装依赖
cd frontend
npm install                 # 如网络受限：npm config set proxy/http-proxy，或指定镜像 registry

# 2) 启动后端（另一个终端）
cd ..\backend
dotnet run --project src/Dubhe.Api          # http://localhost:5180

# 3) 启动前端（默认 4200，已配置代理到 5180）
cd ..\frontend
npm start                                   # http://localhost:4200
```

- 本地演示账号：由后端种子创建（用户名 `admin` / 手机号 `13800000000`）。初始口令通过用户机密或环境变量 `Seed__AdminPassword` 设置；未配置时后端首次启动随机生成并仅在日志打印一次。任何对外可访问的部署都必须先更换该口令（见 §6 限制 #7）。
- 代理规则见 `proxy.conf.json`：`/api`、`/hubs`、`/health` → `http://localhost:5180`。
- 生产构建：`npm run build` → 产物 `dist/dubhe-web/browser`。
- 提示：本机若开启代理/加速器，PowerShell 的 `Invoke-WebRequest` 访问 localhost 需加 `-NoProxy`（浏览器与 `npm` 的代理配置不受影响）。

### Nginx 部署示例

```nginx
server {
  listen 80;
  root /usr/share/nginx/html/dubhe-web;      # dist/dubhe-web/browser 内容
  index index.html;
  location / { try_files $uri $uri/ /index.html; }
  location /api/ { proxy_pass http://dubhe-api:5180; proxy_set_header Host $host; }
  location /hubs/ {                            # SignalR（启用实时通道时需要）
    proxy_pass http://dubhe-api:5180;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
  }
}
```

---

## 2 目录结构

```
frontend/
├── proxy.conf.json                 # 开发代理（/api /hubs /health → 5180）
├── API.md                          # 后端接口清单（方法/路径/参数/权限/错误码）
├── CONVENTIONS.md                  # 页面与组件实现约定（含 NG-ZORRO v22 注意事项）
├── src/
│   ├── styles.scss                 # 全局主题：卡片、栅格、筛选栏、详情描述、登录页等
│   └── app/
│       ├── app.config.ts           # 应用级 providers（Http/拦截器/i18n/图标/日期适配器/弹窗服务）
│       ├── app.routes.ts           # 全量路由（懒加载 + 鉴权/权限守卫）
│       ├── icons.ts                # 注册的 NG-ZORRO 图标集
│       ├── core/                   # 基础设施
│       │   ├── api-types.ts        # 全部 DTO/枚举/中文字典（与后端 DTO 一一对应）
│       │   ├── api.service.ts      # 统一 HTTP：解包 {success,code,message,data}、空参过滤、Excel 下载
│       │   ├── auth.service.ts     # 登录态 signals + localStorage + 刷新令牌
│       │   ├── auth.interceptor.ts # Bearer / Device-Type: PC / 401 自动刷新重放 / 统一错误提示
│       │   ├── guards.ts           # authGuard / guestGuard / permGuard
│       │   ├── permission.service.ts
│       │   ├── confirm.service.ts  # 二次确认与"填写原因"弹窗
│       │   ├── paged-list.ts       # 分页列表状态封装（查询/分页/加载/错误）
│       │   ├── nav.config.ts       # 菜单树（按权限过滤）与角色默认首页
│       │   └── realtime.service.ts # SignalR 通道（默认关闭，见 §6）
│       ├── shared/                 # 可复用组件
│       │   ├── data-table.ts       # 服务端分页表格（列定义 + 操作列插槽）
│       │   ├── schema-form.ts      # Schema 驱动表单（含航点编辑器/远程搜索下拉）
│       │   ├── modal.ts            # 弹窗（自动触发内嵌表单校验）
│       │   ├── map-canvas.ts       # 经纬度绘制地图（禁飞/限飞/管制区、围栏、航点、热力、拾取）
│       │   ├── chart.ts            # ECharts 封装（按需注册、深浅主题、自适应）
│       │   ├── stat-card.ts / status-tag.ts / page-header.ts / prompt-content.ts
│       ├── layout/                 # 主框架：侧边菜单 + 顶栏（通知/会话状态/用户菜单）
│       └── pages/                  # 业务页面（见 §3）
```

---

## 3 模块与页面清单

| 模块 | 路由 | 页面 |
| --- | --- | --- |
| 通用 | `/auth/login`、`/auth/register`、`/dashboard`、`/profile`、`/notifications`、`/forbidden` | 登录、注册、角色化工作台、我的资料、消息通知、无权访问 |
| M1 账号权限 | `/admin/users`、`/admin/roles` | 用户管理（审核/驳回/冻结/解冻/角色分配）、角色与权限目录 |
| M2 订单全流程 | `/orders`、`/orders/create`、`/orders/:id`、`/orders/import`、`/orders/auto-accept` | 订单列表（筛选/接单/拒单/派单/取消）、下单（地址+地图选点+费用预估）、订单详情（时间线/派单/起飞/送达/评价/支付/退款/支付流水）、Excel 批量导入、自动接单规则 |
| 结算与发票 | `/finance/settlements`、`/finance/settlements/:id`、`/finance/invoices` | 结算单（生成/导出/商户确认/平台结算）、结算明细与对账差异、发票申请/开具/驳回 |
| M3 低空资源 | `/resources/drones`、`/resources/stations`、`/resources/service-areas`、`/resources/crew`、`/resources/crew/:id`、`/resources/maintenance`、`/resources/faults` | 飞行器台账、起降场站与预约、服务区域、人员资质/排班/考勤、维保计划与记录、故障上报与闭环 |
| M4 空域合规 | `/airspace/zones`、`/airspace/flight-plans`、`/airspace/flight-plans/:id`、`/airspace/violations`、`/airspace/monitoring` | 空域与电子围栏（地图叠加/模拟空管同步）、飞行计划申报与审批（审批建议/冲突展示）、违规处理与处罚、飞行监控（位置上报/违规检测/密度热力） |
| M5 统计报表 | `/reports/admin`、`/reports/merchant`、`/reports/atc`、`/reports/custom`、`/reports/templates`、`/reports/shares` | 三套数据看板（5 分钟自动刷新+手动刷新）、自定义报表（字段选择/运行/导出/存模板）、模板与共享、报表分享（有效期/访问记录/撤回） |
| M6 应急客服 | `/support/alerts`、`/support/alerts/:id`、`/support/tickets`、`/support/tickets/:id`、`/support/canned`、`/support/help` | 应急告警上报与处置时间线、客服工单（提交/指派/回复/完成/评价/满意度统计）、常用语、帮助中心（浏览+管理） |
| M7 系统配置 | `/config/params`、`/config/endpoints`、`/config/backups`、`/config/logs` | 参数配置（按组/类型校验/变更留痕）、接口管理与连通性测试、备份与恢复、操作日志（导出/清理） |
| 选做智能体 | `/agent/info`、`/agent/knowledge`、`/agent/tasks`、`/agent/protocols` | 智能体信息（stub 标注）、知识库、任务（五类规则模板输出）、团队协定 |

---

## 4 鉴权与权限

- 登录：用户名或手机号 + 密码；`/auth/login` 返回访问令牌与刷新令牌，PC 端 8 小时有效。
- 请求头：`Authorization: Bearer <token>` + `Device-Type: PC`（后端据此返回完整字段）。
- 令牌刷新：`auth.interceptor.ts` 捕获 401 后调用 `/auth/refresh` 并重放原请求（旋转式刷新，失败则登出）。
- 会话安全：连续 5 次密码错误锁定由后端控制；前端 30 分钟无操作（无点击/键盘/滚动）自动登出。
- 权限：路由级 `permGuard([...])`，按钮级 `perm.can('order.dispatch')`；后端 `*` 通配对应平台管理员。
- 数据作用域由后端控制（商家/客户/机长仅见本人或本企业数据），前端不做额外过滤。

---

## 5 设计要点

1. **契约单一来源**：`core/api-types.ts` 与后端 DTO 一一对应（含 43 个权限点、10 个角色、状态枚举与中文字典），页面不自行拼装字段名。
2. **共享组件复用**：列表页统一 `PagedList + DataTable`，表单弹窗统一 `Modal + SchemaForm`（必填/范围校验由弹窗统一触发），状态展示统一 `StatusTag` 语义着色。
3. **自绘空域地图**：`MapCanvas` 用经纬度线性投影 + SVG 绘制，支持圆形禁飞/限飞/临时管制区、商家围栏、航点航线、热力网格、位置标记与点击拾取，无需第三方地图 Key；坐标可直接用于下单与计划申报。
4. **图表按需**：ECharts 仅注册 line/bar/pie/gauge/radar/scatter 与必要组件，兼容 ECharts 6 的 `containLabel` 行为。
5. **错误与体验**：拦截器统一弹出后端 `message`；危险操作二次确认（取消/驳回/冻结/退款/恢复备份等）；无权限按钮不渲染。

---

## 6 已知限制

| # | 限制 | 说明 |
| --- | --- | --- |
| 1 | SignalR 实时通道默认关闭 | 后端 Hub 需要 JwtBearer 支持从 query string 读取 `access_token` 才能握手；当前后端未配置，前端自动降级为轮询（消息 45s、看板 5min）。后端就绪后将 `core/realtime.service.ts` 的 `ENABLE_REALTIME` 置为 `true` 即可 |
| 2 | 文件上传仅覆盖订单导入 | 资质/凭证/照片等后端仅保存 URL，前端以文本域（按行）方式录入 |
| 3 | PDF 导出未实现 | 后端当前仅支持 Excel 导出（结算单/报表/日志/导入模板） |
| 4 | 角色权限为只读展示 | 后端未提供修改角色权限的接口，前端仅展示权限目录；用户差异通过"分配角色"实现 |
| 5 | 地图无底图瓦片 | 采用经纬度自绘 SVG（不依赖高德 Key）；如需真实底图，可在 `MapCanvas` 内接入高德 JS API 2.0 |
| 6 | 帮助中心管理端只能看到已发布文章 | 后端 `GET /help/articles` 强制 `IsPublished=true`，建议后端补 `includeUnpublished` 参数 |
| 7 | **后端无修改密码接口** | `PUT /users/me` 仅支持昵称/邮箱/头像，平台内无法轮换密码。管理员初始口令由部署方通过 `Seed:AdminPassword` 设置（未设置则随机生成），任何非本地环境部署前必须由后端处置（建议补 `POST /api/auth/change-password`，或首次登录强制改密）。前端已移除登录页的演示凭证展示与一键填充 |

---

## 7 验证记录（2026-09-16）

| 项 | 结果 |
| --- | --- |
| 生产构建 | `npm run build` 通过（production，输出 `dist/dubhe-web/browser`） |
| 单元测试 | `ng test` 通过（2/2） |
| 路由巡检 | 39 条路由逐条以「生产构建 + 真实浏览器（Edge headless + Playwright）」打开：全部渲染成功，控制台错误 0 |
| 真实登录 | 点击登录 → 实际发出 `POST /api/auth/login`（HTTP 200）→ 跳转工作台 |
| 空结果查询 | 关键字查询 → 实际发出 `GET /api/orders?keyword=...`（HTTP 200）→ 页面展示空态「暂无数据」 |
| 不存在数据 | 访问 `/orders/{不存在ID}` → 后端 404 `not_found`「订单不存在」→ 前端弹出提示且页面不崩溃（仅一条预期的 404 网络日志） |
| 点击触发操作 | 列表点击「接单」→ 实际发出 `POST /api/orders/{id}/accept`（HTTP 200）→ 接口复核状态 `PendingAccept → PendingDispatch`、`acceptedAt` 写入、状态历史 +1；列表行自动刷新为「待调度」并出现「派单/取消」按钮 |
| 接口级异常（A） | 10 个「不存在资源」端点全部返回 404 `not_found`（订单/场站/飞行计划/结算单/工单/应急告警/知识库/备份恢复/报表模板） |
| 接口级异常（B） | 禁运品下单 → 400 `prohibited_item`；服务区域越界（预估与下单）→ 400 `out_of_service_area`；状态机非法迁移（待接单直接完成）→ 409 `order_state_invalid` |
| 接口级异常（C） | 无令牌 → 401；伪造令牌 → 401；客户访问管理端接口（用户/参数）→ 403 `forbidden` |

### 本轮修复的真实缺陷（均由上述验证发现）

| # | 缺陷 | 影响 | 修复 |
| --- | --- | --- | --- |
| 1 | `SchemaForm` 的 `toDate()` / `asWaypoints()` 每轮变更检测返回新对象 | 日期、航点字段触发 ngModel ↔ CVA 无限写入，**整个页面 renderer 崩溃**（`/orders`、`/airspace/monitoring` 白屏） | 改为按值缓存复用实例（`schema-form.ts`） |
| 2 | 订单列表用数字与字符串状态比较（`row.status === 1`） | 接单/拒单/派单/取消按钮永不出现 | 改为字符串枚举比较（与后端 `Status.ToString()` 一致） |
| 3 | 平台管理员打开「自动接单规则」「商家看板」 | 后端按"未绑定商家"返回 400，页面弹错误提示 | 管理员未选商家时跳过请求并给出引导（选择商家/提示说明） |
| 4 | **未引入 NG-ZORRO 全局样式表** | 全站组件（菜单/表格/按钮/弹窗/角标）以裸 HTML 渲染，界面像未完成原型 | `angular.json` 增加 `node_modules/ng-zorro-antd/ng-zorro-antd.min.css`；首包 812 kB → 1.44 MB（传输 267 kB） |

