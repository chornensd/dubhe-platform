# 天枢·低空智能运营管控平台 — 后端（Dubhe Backend）

ASP.NET Core WebAPI（.NET 10 LTS）+ PostgreSQL 的模块化单体后端，按《需求分析文档》《技术选型文档》落地。

> 完整实现说明见仓库根目录《后端说明文档.md》（模块清单、架构、数据模型、接口、机制、配置、验证与限制）。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 框架 | ASP.NET Core WebAPI（.NET 10 LTS） |
| 数据访问 | EF Core 10 + Npgsql（PostgreSQL 17/18） |
| 鉴权 | JWT + RBAC（角色/权限，权限点内嵌 Token） |
| 日志 | Serilog（控制台 + 文件滚动） |
| 实时 | SignalR（`/hubs/notifications`，按用户/角色分组） |
| API 文档 | 内建 OpenAPI + Scalar UI |
| 测试 | xUnit + 冒烟脚本 |

## 目录结构

```
backend/
├── Dubhe.slnx
├── src/
│   ├── Dubhe.Domain/            # 实体、枚举、权限目录、领域异常
│   │   ├── Auth/                # 用户/角色/权限/刷新令牌
│   │   ├── Admin/               # 审计日志
│   │   └── Common/              # BaseEntity、错误码、AppException
│   ├── Dubhe.Application/       # 应用服务、DTO、抽象（按模块目录组织）
│   │   ├── Auth/                # 注册/登录/刷新/登出
│   │   ├── Users/               # 个人中心、账号管理
│   │   ├── Admin/               # 角色与权限目录
│   │   └── Abstractions/        # IAppDbContext、IJwtTokenService 等端口
│   ├── Dubhe.Infrastructure/    # EF Core、种子数据、JWT/BCrypt、身份上下文
│   │   ├── Persistence/         # DbContext、实体配置、迁移、拦截器、Seeder
│   │   ├── Auth/                # PasswordHasher、JwtTokenService
│   │   ├── Identity/            # CurrentUser、ClientContext（Device-Type）
│   │   └── Time/
│   └── Dubhe.Api/               # 控制器、中间件、授权、SignalR Hub
│       ├── Controllers/         # /api/auth /api/users /api/admin/*
│       ├── Middleware/          # 全局异常、操作日志
│       ├── Authorization/       # RequirePermission 策略
│       └── Hubs/
├── tests/Dubhe.Tests/           # 单元测试
├── scripts/smoke-test.ps1       # 端到端冒烟脚本
└── docker-compose.yml           # 可选：PostgreSQL + pgvector 容器
```

## 快速开始

前置：.NET SDK 10、PostgreSQL（或 Docker）。

1. 准备数据库（二选一）：

   **Docker（推荐）**：复制 `backend/.env.example` 为 `backend/.env` 并设置自己的本地开发口令，然后：

   ```powershell
   cd backend
   docker compose up -d
   ```

   或**本地 PostgreSQL** 手工建库（口令自行设置）：

   ```sql
   CREATE ROLE dubhe LOGIN PASSWORD '<你的本地开发口令>';
   CREATE DATABASE dubhe OWNER dubhe;
   ```

2. 配置本地凭证（不进入版本库，推荐 .NET 用户机密）：

   ```powershell
   cd backend/src/Dubhe.Api
   dotnet user-secrets init
   dotnet user-secrets set "ConnectionStrings:Postgres" "Host=localhost;Port=5432;Database=dubhe;Username=dubhe;Password=<与 .env 相同的口令>"
   dotnet user-secrets set "Jwt:SigningKey" "<至少 32 字符的随机字符串>"
   # 可选：指定初始管理员口令；留空则首次启动随机生成并打印到日志
   # dotnet user-secrets set "Seed:AdminPassword" "<你的初始管理员口令>"
   ```

   > 也可用环境变量覆盖：`ConnectionStrings__Postgres`、`Jwt__SigningKey`、`Seed__AdminPassword`。

3. 构建与启动：

   ```powershell
   cd backend
   dotnet build Dubhe.slnx
   dotnet run --project src/Dubhe.Api   # 启动时自动执行迁移与种子
   ```

- Scalar API 文档：`http://localhost:5180/scalar/v1`
- OpenAPI JSON：`http://localhost:5180/openapi/v1.json`
- 健康检查：`http://localhost:5180/health`

4. 初始管理员：用户名 `admin` / 手机号 `13800000000`；口令取 `Seed:AdminPassword`，未配置时首次启动随机生成并仅在启动日志打印一次（请立即保存并尽快修改）。

> 安全提示：仓库不包含任何明文凭证；`appsettings.Development.json` 中的连接串与 JWT 密钥均为占位符，请用用户机密或环境变量覆盖后再启动。

## 已实现功能（M1 账号与权限 / M2 订单全流程）

- 注册：个人客户（即时激活）、企业客户/商家（待审核）；密码强度校验、手机号/用户名唯一
- 登录：账号或手机号 + 密码；连续 5 次密码错误锁定 15 分钟；账号状态拦截（待审核/驳回/冻结给出明确错误码）
- 令牌：JWT 访问令牌 + 刷新令牌（旋转式，旧令牌作废）；PC 8 小时 / 移动端 2 小时
- 个人中心：查看/更新资料（昵称、邮箱、头像）
- 账号管理：分页/关键词/状态/角色筛选，冻结/解冻（原因必填），角色分配；商家仅能管理本企业子账号
- RBAC：10 个内置角色、29 个权限点；`GET /api/admin/roles`、`GET /api/admin/roles/permissions`
- 审计：非 GET 请求自动写入 `admin.audit_logs`；冻结/解冻/角色分配额外记录业务审计
- 双端适配：请求头 `Device-Type: PC | Mobile` 控制令牌时长与返回字段粒度（移动端裁剪权限明细/邮箱）

### M2 订单全流程（本次新增）

- 订单创建：寄收地址与坐标、物品信息、禁运品校验（易燃易爆/武器/毒品等直接拒绝）、商家服务区域校验（圆形区域，未配置时跳过）
- 费用引擎：基础费 + 距离费（Haversine）+ 重量费 + 空域费 + 加急费，优惠券按比例上限封顶；`/api/orders/estimate` 免落库预估
- 状态机：待接单 → 待调度 → 飞行中 → 已送达 / 已取消；每次迁移写入状态历史；拒单/取消必须填写原因
- 调度：按状态/载重/续航校验并分配飞行器，支持规划航点（jsonb 存储）
- 起飞/送达联动飞行器状态（InFlight/Idle）；送达后客户评价（1-5 分，仅一次）
- 数据隔离：客户仅见自己订单、商家（含子账号）仅见本企业、机长仅见指派订单；管理员全局可见且可强制终止
- 支付（模拟）：微信/支付宝/对公转账，支持模拟失败与重复支付拦截；订单支付状态与支付流水可查
- 退款：已支付订单可退款（记录退款流水、订单转已退款）
- 结算对账：按周期汇总已送达订单生成结算单（平台佣金比例可配），订单级明细 + 支付差异统计（已付/未付/已退款）；商家确认对账 → 平台结算；支持导出 Excel
- 发票：企业/个人客户按订单申请开票（抬头/税号），平台开具或驳回
- 最小资源支撑：飞行器台账与服务区域（`/api/resource/drones`、`/api/resource/service-areas`，M3 将扩展场站/人员/维保）
- 批量导入：`GET /api/orders/import/template` 下载 Excel 模板（含填写说明页），`POST /api/orders/import?merchantId=` 上传 `.xlsx` 批量创建；逐行校验并返回行号与失败原因（单次 ≤500 行）
- 自动接单：商家可配置规则（启用/最大重量/最远距离），命中的订单在下单后自动进入待调度并写入状态历史
- 样例数据：`samples/order-import-sample.xlsx`（20 行：15 条正常 + 5 条故意出错），`samples/generate_sample.py` 可重新生成（需 `pip install openpyxl`）

### M3 低空资源（已落地：场站 / 人员 / 维保）

- 场站管理：起降场/换电站 CRUD、状态、容量与充电桩数、同名冲突校验
- 场站预约：时段预约 + 容量感知冲突校验、取消释放容量、按时间范围查询
- 人员管理：机长/运维台账，资质（类型/编号/有效期/文件）与到期标记，排班冲突校验，考勤按日记录与更新
- 维保：每飞行器一份计划（按天数/飞行时长，二选一或同时），自动计算下次到期；维保记录写入后重置计划与飞行器健康分
- 故障：上报（含照片/定位）→ 派单处理 → 处置完成，自动生成"故障维修"维保记录并恢复飞行器状态
- 调度联动：**超期未维保的飞行器禁止调度**；机长存在过期资质时禁止调度
- 到期提醒：后台服务定时扫描（资质 15 天窗口 / 维保 7 天窗口或剩余 60 飞行分钟），写入站内通知，支持去重、已读
- 真实数据种子：`scripts/seed-stations-from-ourairports.ps1`（OurAirports 公共域数据）
- 待做：场站使用统计与高峰时段分析（归入 M5）

### M4 空域合规（已落地）

- 空域数据：平台禁飞区/限飞区/临时管制区录入（圆形范围 + 高度限制 + 生效时段），商家电子围栏自定义（限飞/禁飞）
- 模拟空管源：`POST /api/airspace/zones/mock-sync` 生成临时管制区（真实空管数据无公开来源，对接搁置）
- 飞行计划：草稿 → 提交（自动空域校验：禁飞/限飞/临时管制区、飞行器时段冲突，含高度过滤）→ 审批（批准生成计划号 / 驳回给原因）→ 取消/完成；审批意见推荐（规则引擎：冲突 → 建议驳回，距禁飞区过近或历史通过率低 → 建议复核）
- 动态监控：位置上报自动检测闯入禁飞区/限飞区与航线偏离（阈值可配 `Airspace:DeviationThresholdKm`），5 分钟去重，写入违规记录并通知商家
- 违规处理：违规记录（类型/位置/时间/关联订单与计划）→ 处理中 → 处理完成；分级处罚（警告/罚款/暂停 1-7 天/封禁）+ 处罚通知
- 数据可见性：空管/管理员全局；商家仅见本企业围栏、计划、违规

### 选做：智能体（骨架实现）

- 定位：只提供 API 形态与持久化，**未接入真实 LLM / 向量检索**（`GET /api/agent/info` 明确返回 `stub`）
- 知识库：文档 CRUD + 关键词检索 + 发布（`/api/agent/knowledge-docs`）
- 任务：五类任务（需求解析/代码生成/规范校验/问题排查/文档生成），创建即返回规则模板输出（`/api/agent/tasks`）
- 协定：团队约定/契约持久化（jsonb，`/api/agent/protocols`）
- 扩展位：后续可接入 LLM、pgvector 向量检索与开发流水线

### M5 数据统计与报表（已落地）

- 三套看板：
  - 管理员：订单总量/今日新增/营收（已支付）/活跃商家/活跃客户（近 30 天）、空域利用率（近 30 天已批准计划时长占比）、违规率，实时告警（未闭环违规按类型分级）、近 7 天订单/违规趋势
  - 商家：完成订单量、任务完成率、已支付营收、飞行器使用率（近 30 天有任务的飞行器占比）、配送时长分布（5 档）、近 7 天营收趋势
  - 空管：计划总量、通过率、冲突次数与冲突率、违规类型分布、获批计划起点密度（0.01° 网格 Top20）
- 自定义报表：字段目录（`/api/reports/fields`）、即席运行（`/api/reports/run`，订单维度 + 时间/状态筛选）、模板保存/共享/复用（同角色可见）
- 导出与分享：Excel 导出（`/api/reports/export`）；报表分享（接收人/有效期 1-90 天/可导出、访问计数、撤回、已回收件箱）

### M6 应急与客服（已落地）

- 应急告警：分级上报（一般/严重/紧急）→ 下发处置（处理人多选、方案、时限，通知处理人）→ 进展记录（备注/附件/状态）→ 关闭归档；全程时间线留痕
- 客服工单：提交（投诉/咨询/建议，可关联订单并自动归属商家）→ 指派/转派 → 回复（区分客服/用户，通知双方）→ 完成 → 客户评价（1-5 分）→ 关闭；常用语管理；处理时效与满意度统计
- 帮助中心：分类/关键词/图文与视频检索（无需登录）、浏览计数；管理端维护与发布
- 权限：应急/工单按角色作用域（管理员全局、商家本企业、客户仅本人）

### M7 系统配置（已落地）

- 基础参数：8 项默认参数（订单/空域/告警/系统配置），按分组查询、批量修改、类型校验（数字/布尔），变更留痕
- 接口管理：外部接口注册（地址/方法/超时/重试/自定义 Header）、启用状态、连通性测试（真实 HTTP 调用）、成功率统计、调用日志查询
- 备份与恢复：手动备份（配置 + 知识库 + 帮助中心快照，JSON 落盘）、备份记录、恢复覆盖并返回恢复计数
- 日志管理：操作日志多条件查询（模块/关键字/结果/时间）、Excel 导出、按保留天数清理（默认 180 天）

### 接口速览

| 方法 | 路径 | 权限 |
| --- | --- | --- |
| POST | `/api/auth/register` | 匿名 |
| POST | `/api/auth/login` | 匿名 |
| POST | `/api/auth/refresh` | 匿名 |
| POST | `/api/auth/logout` | 登录 |
| GET/PUT | `/api/users/me` | 登录 |
| GET | `/api/admin/users` | `account.user.manage` |
| POST | `/api/admin/users/{id}/freeze` | `account.user.manage` |
| POST | `/api/admin/users/{id}/unfreeze` | `account.user.manage` |
| PUT | `/api/admin/users/{id}/roles` | `account.role.manage` |
| GET | `/api/admin/roles` | `account.role.manage` |
| GET | `/api/admin/roles/permissions` | `account.role.manage` |
| POST | `/api/admin/users/{id}/approve` / `reject` | `account.user.manage` |
| POST | `/api/orders/estimate` | `order.create` |
| POST | `/api/orders` | `order.create` |
| GET | `/api/orders` / `/api/orders/{id}` | `order.read` |
| POST | `/api/orders/{id}/accept` / `reject` | `order.accept` |
| POST | `/api/orders/{id}/cancel` | `order.read` |
| POST | `/api/orders/{id}/dispatch` / `start` / `complete` | `order.dispatch` |
| POST | `/api/orders/{id}/review` | `order.review` |
| POST | `/api/orders/{id}/pay` | `order.pay` |
| GET | `/api/orders/{id}/payments` | `order.read` |
| POST | `/api/orders/{id}/refund` | `order.settle` |
| POST | `/api/settlements/generate` | `order.settle` |
| GET | `/api/settlements` / `{id}` / `{id}/export` | `order.settle` |
| POST | `/api/settlements/{id}/confirm` / `settle` | `order.settle`（结算动作限平台管理员） |
| POST | `/api/invoices` | `order.invoice.apply` |
| GET | `/api/invoices` | `order.invoice.apply` |
| POST | `/api/invoices/{id}/issue` / `reject` | `order.invoice.manage` |
| POST/GET | `/api/resource/drones` | `resource.drone.manage` / `resource.drone.read` |
| POST/GET | `/api/resource/service-areas` | `resource.service-area.manage` |
| GET | `/api/orders/import/template` | `order.create` |
| POST | `/api/orders/import?merchantId=` | `order.create` |
| GET/PUT | `/api/orders/auto-accept` | `order.accept` |
| POST/PUT | `/api/resource/stations` / `{id}` | `resource.station.manage` |
| GET | `/api/resource/stations` / `{id}` | `resource.station.read` |
| POST/GET | `/api/resource/stations/{id}/reservations` | `resource.station.manage` / `resource.station.read` |
| POST | `/api/resource/reservations/{id}/cancel` | `resource.station.manage` |
| POST/PUT/GET | `/api/resource/crew` / `{id}` | `resource.crew.manage` |
| POST/PUT | `/api/resource/crew/{id}/qualifications` | `resource.crew.manage` |
| POST/GET | `/api/resource/crew/{id}/schedules` | `resource.crew.manage` |
| POST/GET | `/api/resource/crew/{id}/attendances` | `resource.crew.manage` |
| POST/GET | `/api/resource/maintenance/plans` | `resource.maintenance.manage` |
| POST/GET | `/api/resource/maintenance/records` | `resource.maintenance.manage` |
| POST/GET | `/api/resource/faults` | `resource.fault.report` |
| POST | `/api/resource/faults/{id}/handle` / `resolve` | `resource.fault.manage` |
| GET/POST | `/api/notifications`、`/{id}/read`、`/read-all` | 登录用户（仅本人消息） |
| POST | `/api/admin/system/reminders/run` | `config.param.manage`（手动触发提醒扫描） |
| GET/POST/PUT | `/api/airspace/zones`、`/{id}`、`{id}/deactivate`、`mock-sync` | `airspace.zone.manage`（查询 `airspace.read`） |
| POST/PUT | `/api/airspace/fences`、`/{id}`、`{id}/deactivate` | `airspace.fence.manage` |
| POST/PUT/GET | `/api/airspace/flight-plans`、`/{id}` | `airspace.plan.submit` / `airspace.read` |
| POST | `/api/airspace/flight-plans/{id}/submit`、`cancel`、`complete` | `airspace.plan.submit` |
| POST/GET | `/api/airspace/flight-plans/{id}/approve`、`reject`、`approval-suggestion` | `airspace.plan.approve` |
| POST/GET | `/api/airspace/violations`、`/{id}/handle`、`resolve`、`penalties` | `airspace.violation.manage`（查询 `airspace.violation.read`） |
| POST | `/api/airspace/monitoring/positions` | `airspace.monitoring.report` |
| GET | `/api/agent/info` / `knowledge-docs` / `tasks` / `protocols` | `agent.use` |
| POST/PUT | `/api/agent/knowledge-docs`、`/{id}`、`{id}/publish`、`protocols` | `agent.manage` |
| GET | `/api/reports/dashboard/admin` / `merchant` / `air-traffic`、`fields` | `report.view` |
| POST | `/api/reports/run` | `report.view` |
| POST | `/api/reports/export` | `report.export` |
| GET/POST/PUT/DELETE | `/api/reports/templates`、`/{id}` | `report.view`（仅创建者可改删） |
| GET/POST | `/api/reports/shares`、`/received`、`{id}/access` | `report.share` / `report.view` |
| POST | `/api/reports/shares/{id}/revoke` | `report.share`（仅发起人） |
| POST/GET | `/api/support/emergency-alerts`、`/{id}`、`{id}/dispatch` / `progress` / `close` | `support.alert.handle` |
| POST/GET | `/api/support/tickets`、`/{id}`、`{id}/reply` / `rate` / `close` | `support.ticket.apply`（其余登录用户按作用域） |
| POST/GET | `/api/support/tickets/{id}/assign` / `complete`、`/stats`、`/canned-responses` | `support.ticket.manage` |
| GET | `/api/help/articles`、`/articles/{id}`、`/categories` | 匿名 |
| POST/PUT | `/api/support/help/articles`、`/{id}`、`{id}/publish` | `support.help.manage` |
| GET/PUT | `/api/admin/config/params` | `config.param.manage` |
| GET/POST/PUT | `/api/admin/config/endpoints`、`/{id}`、`{id}/test`、`/logs` | `config.interface.manage` |
| GET/POST | `/api/admin/config/backups`、`{id}/restore` | `config.backup.manage` |
| GET/POST | `/api/admin/config/logs`、`/logs/export` | `config.log.read` |
| POST | `/api/admin/config/logs/cleanup` | `config.param.manage` |
| GET | `/api/meta/context` | 匿名（演示端识别） |

### 统一响应

```json
{ "success": true, "code": "ok", "message": "success", "data": { }, "traceId": "..." }
```

错误码：`validation_error` / `invalid_credentials` / `account_locked` / `account_frozen` / `account_pending_review` / `account_rejected` / `token_invalid` / `refresh_token_invalid` / `forbidden` / `not_found` / `user_exists` / `conflict` / `internal_error`（HTTP 状态码与错误码映射见 `GlobalExceptionHandler`）。

## 数据库约定

- 每个业务模块独立 Schema：`auth`、`admin`（后续：`biz`、`resource`、`airspace`、`support`、`config`、`agent`）
- 表/列/索引统一小写下划线（`UseSnakeCaseNames`）
- 主键 UUID（客户端生成）、`timestamptz`、软删除（用户）、审计字段自动填充（拦截器）
- 密码 BCrypt；手机号返回时脱敏

## 常用命令

```powershell
dotnet build Dubhe.slnx
dotnet test tests/Dubhe.Tests
dotnet ef migrations add <Name> -p src/Dubhe.Infrastructure -s src/Dubhe.Api
dotnet ef database update -p src/Dubhe.Infrastructure -s src/Dubhe.Api

# 冒烟测试（需先启动服务，默认 http://localhost:5180）
./scripts/smoke-test.ps1

# 用真实公开数据（OurAirports）批量创建场站
./scripts/seed-stations-from-ourairports.ps1 -Token <accessToken> -MerchantId <merchantGuid> -Count 10
```

## 里程碑

| 状态 | 内容 |
| --- | --- |
| 已完成 | **全部模块**：M1 账号与权限；M2 订单全流程；M3 低空资源；M4 空域合规；M5 统计与报表；M6 应急与客服；M7 系统配置；选做智能体（骨架）；基础设施（迁移/种子/审计/异常/OpenAPI/SignalR） |
| 后续可选 | 轨迹分区与批量写入（COPY）、Redis 会话/心跳、真实短信/推送适配器、移动端与 PC 端前端、（真实空管/气象/支付对接仍搁置） |
| 规划中 | M4 空域合规（计划申报/审批/围栏/违规）、M5 统计报表、M6 应急客服、M7 系统配置；轨迹分区与批量写入（COPY）；pgvector 知识库（选做） |
