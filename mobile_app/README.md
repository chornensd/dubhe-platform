# 天枢 · 低空智能运营管控平台 — 移动端（Flutter）

> 依据《需求分析文档》§3.8 移动端角色功能、《技术选型文档》§3.2（Flutter + Riverpod + Dio + go_router）实现。
> 后端为 `backend/`（ASP.NET Core，默认 `http://localhost:5180`）；PC 端为 `frontend/`（Angular）。

## 1 已实现范围（第一批：客户 + 机长）

| 角色 | 功能 | 状态 |
| --- | --- | --- |
| 通用 | 登录/注册（个人/企业/商家）、令牌自动刷新、移动端字段裁剪、消息通知（未读角标）、个人中心、服务器地址设置、帮助中心 | 完成 |
| 客户 | 首页（搜索/轮播/四入口/订单状态汇总/最近订单）、我的订单（状态分类/下拉刷新/上拉加载/搜索）、三步下单（地址→物品时效→确认支付）、费用预估、模拟支付（微信/支付宝/对公，支持模拟失败）、订单详情（轨迹/费用/支付/时间线）、取消订单、评价、我的发票（申请）、客服工单（提交/回复/评价）、帮助中心 | 完成 |
| 机长 | 工作台（今日任务统计/待接任务滑动接单·拒单/执行中任务）、飞行监控（电量/高度/速度仪表、地图航迹与禁限飞区、位置上报、自动上报模拟移动、偏航文字+语音告警、电量<30% 标红）、飞行记录、故障上报（类型/描述/定位/多图上传）、故障进度跟踪、应急告警（查看/进展/关闭） | 完成 |
| 运维 | 工作台（设备/维保/故障/场站统计）、设备列表与详情（电量/健康度/维保计划/维保记录登记/故障历史）、维保管理（到期高亮+记录历史）、场站管理（地图·列表切换 + 预约处置）、故障处理闭环 | 完成 |
| 移动管理员 | 驾驶舱（待审批计划/待审核账号/未闭环告警）、审批中心（飞行计划：建议/批准/驳回 + 航线预览；商家注册：通过/驳回）、应急告警下发处置（处理人多选+方案+时限）、进展与关闭归档 | 完成 |
| 其他角色（商家/调度/财务/空管） | 移动端非验收范围（使用 PC 端）；通用工作台占位 | — |

## 2 快速开始

```powershell
# 1) 后端（另开窗口）
cd backend; dotnet run --project src/Dubhe.Api --urls http://0.0.0.0:5180

# 2) 移动端（本目录）
flutter pub get
flutter run -d chrome --web-port 4200          # Web 调试（浏览器直连 localhost:5180）
flutter run -d <device-id>                     # Android 真机/模拟器
flutter build apk --debug                      # 产物：build/app/outputs/flutter-apk/app-debug.apk
```

> 一键启动：根目录运行 `start-all.bat`（后端 `0.0.0.0:5180` + PC 前端 4200 + Windows 移动热点）；`stop-all.bat` 按端口停止后端与前端。

### 服务器地址说明（App 内“我的 → 服务器地址”可修改）

| 运行方式 | 默认地址 | 说明 |
| --- | --- | --- |
| Web / Windows | `http://localhost:5180` | 后端 CORS 已允许 `http://localhost:4200` |
| Android 模拟器 | `http://10.0.2.2:5180` | 模拟器访问宿主机 |
| Android 真机（USB） | `http://127.0.0.1:5180` | `adb reverse tcp:5180 tcp:5180` 转发，无需改防火墙 |
| Android 真机（免 USB） | `http://192.168.137.1:5180` | PC 开「移动热点」（接口固定 192.168.137.1），手机连热点；校园网/公共 Wi-Fi 常有客户端隔离，不要用公共 Wi-Fi 直连 |

也支持编译期指定：`flutter run --dart-define=DUBHE_API_BASE=http://192.168.1.10:5180`。

### 测试账号

见根目录《测试账号文档.md》：`test_customer`（客户）、`test_pilot`（机长）、`test_merchant`（商家）、`admin`（管理员）；口令在部署/注册时自行设置，联调脚本通过环境变量传入。

## 3 工程结构

```
mobile_app/
├── lib/
│   ├── main.dart / app.dart              # 入口、MaterialApp.router、中文本地化
│   ├── core/
│   │   ├── env.dart                      # 平台默认后端地址、应用信息
│   │   ├── api_client.dart               # Dio：统一响应解包、Device-Type: Mobile、401 自动刷新重放
│   │   ├── auth_store.dart               # flutter_secure_storage 令牌/用户持久化 + 内存 TokenStore
│   │   ├── session.dart                  # Riverpod：设置、ApiClient、登录态（build 时恢复会话）
│   │   ├── permissions.dart              # 角色→权限映射（移动端不下发 permissions，前端按角色推导）
│   │   ├── paged_list.dart               # 通用分页列表状态（刷新/加载更多）
│   │   ├── exceptions.dart / format.dart # 业务异常、中文字典与格式化
│   ├── models/models.dart                # 后端 DTO 对齐模型（手动 fromJson）
│   ├── services/
│   │   ├── api_service.dart              # DubheApi：按模块的强类型接口封装
│   │   └── providers.dart                # 未读数/空域/机长飞行器/可选商家
│   ├── ui/
│   │   ├── theme.dart                    # 蓝色主题（与 PC 端一致）
│   │   ├── widgets/                      # 通用组件：状态标签、分页列表、地图（自绘）、仪表、订单卡片等
│   │   ├── router/app_router.dart        # go_router：鉴权重定向 + 角色落地页 + 底部导航壳
│   │   ├── auth/                         # 登录/注册/服务器地址
│   │   ├── shell/main_shell.dart         # 按角色的底部导航（客户 4 tab / 机长 4 tab）
│   │   ├── customer/                     # 客户页面（首页/订单/下单/详情/工单/发票）
│   │   ├── pilot/                        # 机长页面（工作台/监控/记录/故障/告警）
│   │   └── common/                       # 消息通知/个人中心/帮助中心/通用工作台
└── android/ ios/ web/                    # 平台工程（Android 已配置 INTERNET 与明文 HTTP；iOS 已配置 ATS 例外）
```

## 4 关键实现说明

- **双端适配**：所有请求携带 `Device-Type: Mobile`（2 小时令牌、后端裁剪权限明细/邮箱等字段）；客户端按角色推导权限（`core/permissions.dart` 与后端 `PermissionCatalog` 一致）。
- **令牌**：access + refresh 双令牌，Dio 拦截器在 401 时单飞刷新并重放原请求；刷新失败清空会话回登录页。
- **地图**：自绘经纬度投影组件（禁飞/限飞/临时管制分色、航线虚线、轨迹、脉冲标记、点击拾取），不依赖第三方地图 Key；后续可替换为高德插件。
- **偏航告警**：客户端计算当前位置到申报航线的最短距离，超过 1 km 触发文字 + `flutter_tts` 语音播报（20 秒去重）。
- **离线容忍**：断网时登录态可恢复（本地缓存用户），列表/详情展示错误态并可重试。
- **文件上传**：故障照片走 `POST /api/files/upload`（后端落盘 `wwwroot/uploads`，返回可访问 URL）。
- **通知**：顶栏未读角标 45 秒轮询；SignalR 实时通道未启用（与 PC 端一致，后端 Hub 补 query token 后可开）。

## 5 与后端的联调验证

- 移动端接口冒烟脚本：`backend/scripts/mobile-smoke.ps1`（**29/29 通过**，覆盖登录裁剪、客户选商家/下单/支付、商家接单调度、机长接飞/送达/拒单、故障上报与详情、文件上传、空域读取、位置上报、告警进展、通知、发票）。
- 第二批接口冒烟：`backend/scripts/mobile-smoke-2.ps1`（**20/20 通过**，1 项无数据 SKIP）覆盖运维资源域访问（设备/场站/维保/故障）、维保计划与记录、预约处置、故障闭环、商家注册审批、应急告警下发→进展→关闭全链路。
- Web 端 UI 端到端：`tool/mobile-ui-check.mjs`（Playwright 驱动 Edge，headless，**23/23 通过、0 控制台错误**，覆盖客户/机长/运维/管理员四角色的全部主要页面）：
  ```powershell
  # 先启动 Web 版应用（release，端口 4200，与后端 CORS 允许来源一致）
  flutter run -d web-server --web-port 4200 --release
  node tool/mobile-ui-check.mjs            # 实时进度与截图：tool/shots/（progress.txt / report.json / *.png）
  ```
- 本轮为支撑移动端补齐的后端能力（详见《后端说明文档》与根目录《移动端说明文档.md》）：
  1. 新权限 `order.pilot.execute`（机长角色默认拥有）+ 任意权限策略 `RequireAnyPermission`；
  2. 机长可对“被指派订单”执行开始飞行/完成送达，新增拒单 `POST /api/orders/{id}/decline`（退回待调度）；
  3. 客户可选商家 `GET /api/orders/available-merchants`（含服务区域，供下单与地图默认中心）；
  4. 机长数据范围修复：按“角色”而非仅 `UserType` 判定（订单/飞行器/故障/空域/位置上报）；
  5. 新增 `GET /api/resource/faults/{id}`；新增 `POST /api/files/upload` + 静态文件访问；
  6. 运维角色资源域放通：设备/场站/维保计划与记录/故障/预约按「平台管理员或运维」跨商家可见与处置；
  7. 客户端将后端默认空时间（`0001-01-01`）视为空显示。

## 6 已知限制与后续规划

| # | 限制 | 规划 |
| --- | --- | --- |
| 1 | 运维 / 移动管理员页面未交付（第二批） | 设备维保、场站预约审核、待办审批、应急告警处置 |
| 2 | 极光推送未接入（站内通知 + 轮询） | 配置厂商通道后接入 `jpush_flutter` |
| 3 | 高德原生地图/定位插件未接入（自绘地图） | 申请高德 Key 后替换 `AppMap` 实现 |
| 4 | 离线缓存为轻量方案（登录态 + 错误容忍），未引入 drift | 弱网要求明确后落 SQLite 缓存与断点续传 |
| 5 | iOS 打包需 Mac/云构建（Windows 无法出 ipa） | 结合 Apple 开发者账号走云构建 |

## 7 构建与验证记录

| 项 | 结果 |
| --- | --- |
| `flutter analyze` | 0 error（仅 13 条 info 级 lint） |
| `flutter test` | 1/1 通过 |
| 接口冒烟 | `backend/scripts/mobile-smoke.ps1` 29/29 通过 |
| Web UI 端到端 | `tool/mobile-ui-check.mjs` 15/15 通过、0 控制台错误（截图 `tool/shots/*.png`） |
| Android APK | `flutter build apk --debug` 成功（`build/app/outputs/flutter-apk/app-debug.apk`） |
| Android 权限 | `INTERNET`、`usesCleartextTraffic=true`（本地 HTTP 联调；生产改 HTTPS 后可关闭） |
| iOS | `NSAppTransportSecurity/NSAllowsArbitraryLoads=true`（本地 HTTP 联调） |

### 构建环境踩坑记录（本机已验证）

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| Gradle 下载失败 | services.gradle.org 不可达 | wrapper 换腾讯镜像 |
| Kotlin 编译崩溃（incremental caches 跨盘符） | pub 缓存在 C:、构建目录在 E: | `kotlin.incremental=false` |
| jni/CMake 的 ninja 报“文件名语法不正确” | 中文用户名路径（`C:\Users\<中文用户名>`） | `PUB_CACHE=E:\pub-cache` |
| `flutter test` 连接被关闭 | Clash 注入的 HTTP_PROXY 拦截回环 | `NO_PROXY=127.0.0.1,localhost` |
| Web 端停在启动页 | web 端 secure_storage + 路由只监听用户 id | Web 用 SharedPreferences + 监听整个 authProvider |

