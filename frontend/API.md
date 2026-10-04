# Dubhe PC Web（Angular）— 接口清单（后端实证）

- Base URL：开发 `http://localhost:5180`（Angular dev server 通过 `proxy.conf.json` 转发 `/api`、`/hubs`、`/health`）
- 统一响应：`{ success, code, message, data, traceId }`；`code === 'ok'` 成功
- 分页：列表返回 `{ items, total, pageNum, pageSize }`
- 请求头：`Authorization: Bearer <accessToken>`、`Device-Type: PC`（PC 令牌 8h / 移动 2h）
- 文件下载（Excel）：直接用 axios/Angular HttpClient `responseType: 'blob'` + `Authorization` 头
  - `GET /api/orders/import/template`
  - `GET /api/settlements/{id}/export`
  - `POST /api/reports/export`（body = ReportRunRequest）
  - `POST /api/admin/config/logs/export`（body = AuditLogQuery）
- 错误码→HTTP：400 validation_error/out_of_service_area/prohibited_item；401 invalid_credentials/token_*；403 forbidden/account_*；404 not_found；409 *_conflict/order_state_invalid/drone_unavailable/resource_conflict/airspace_conflict/user_exists；423 account_locked

## M1 账号与权限
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | /api/auth/register | {username,phone,password,displayName,userType,companyName?} |
| POST | /api/auth/login | {account,password} → AuthResultDto |
| POST | /api/auth/refresh | {refreshToken} → AuthResultDto（旋转） |
| POST | /api/auth/logout | {refreshToken}（需登录） |
| GET/PUT | /api/users/me | UpdateProfileRequest{displayName?,email?,avatarUrl?} |
| GET | /api/admin/users | UserQuery{pageNum,pageSize,keyword,status,roleCode} |
| POST | /api/admin/users/{id}/freeze | {reason} |
| POST | /api/admin/users/{id}/unfreeze | - |
| PUT | /api/admin/users/{id}/roles | {roleCodes:[]} |
| POST | /api/admin/users/{id}/approve | - |
| POST | /api/admin/users/{id}/reject | {reason} |
| GET | /api/admin/roles | RoleDto[] |
| GET | /api/admin/roles/permissions | PermissionGroupDto[] |

## M2 订单
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | /api/orders/estimate | OrderCreateRequest → OrderEstimateDto |
| POST | /api/orders | OrderCreateRequest → OrderDto |
| GET | /api/orders | OrderQuery{pageNum,pageSize,status,keyword,createdFrom,createdTo} |
| GET | /api/orders/{id} | OrderDto（含 history） |
| POST | /api/orders/{id}/accept | - |
| POST | /api/orders/{id}/reject | {reason} |
| POST | /api/orders/{id}/cancel | {reason?} |
| POST | /api/orders/{id}/dispatch | {droneId,pilotId?,waypoints?,remark?} |
| POST | /api/orders/{id}/start | - |
| POST | /api/orders/{id}/complete | {remark?} |
| POST | /api/orders/{id}/review | {rating,comment?} |
| GET | /api/orders/import/template | xlsx 下载 |
| POST | /api/orders/import?merchantId= | multipart：file（≤10MB，.xlsx，≤500 行） |
| GET/PUT | /api/orders/auto-accept | AutoAcceptRuleDto / UpdateAutoAcceptRuleRequest |
| POST | /api/orders/{id}/pay | {method:1微信|2支付宝|3对公, simulateFailure, failureReason?} |
| GET | /api/orders/{id}/payments | PaymentDto[] |
| POST | /api/orders/{id}/refund | {reason} |
| POST | /api/settlements/generate | {merchantId?,periodStart,periodEnd} |
| GET | /api/settlements | SettlementQuery{pageNum,pageSize,merchantId,status,from,to} |
| GET | /api/settlements/{id} | 含 items/reconciliation |
| GET | /api/settlements/{id}/export | xlsx |
| POST | /api/settlements/{id}/confirm | 商家确认 |
| POST | /api/settlements/{id}/settle | 平台结算 |
| POST/GET | /api/invoices | 申请开票 / InvoiceQuery 列表 |
| POST | /api/invoices/{id}/issue | {invoiceNo,fileUrl?} |
| POST | /api/invoices/{id}/reject | {reason} |

## M3 低空资源
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST/GET | /api/resource/drones | CreateDroneRequest / DroneQuery |
| POST/GET | /api/resource/service-areas | CreateServiceAreaRequest（GET 支持 merchantId） |
| POST | /api/resource/stations | CreateStationRequest |
| PUT | /api/resource/stations/{id} | UpdateStationRequest |
| GET | /api/resource/stations、/{id} | StationQuery |
| POST/GET | /api/resource/stations/{id}/reservations | CreateReservationRequest（GET 支持 from/to） |
| POST | /api/resource/reservations/{id}/cancel | - |
| POST/PUT/GET | /api/resource/crew、/{id} | CreateCrewRequest / UpdateCrewRequest / CrewQuery |
| POST/PUT | /api/resource/crew/{id}/qualifications(/{qid}) | AddQualificationRequest |
| POST/GET | /api/resource/crew/{id}/schedules | CreateScheduleRequest（GET from/to） |
| POST/GET | /api/resource/crew/{id}/attendances | RecordAttendanceRequest{date,status,remark?}（GET from/to=DateOnly） |
| POST/GET | /api/resource/maintenance/plans | UpsertMaintenancePlanRequest（GET droneId?） |
| POST/GET | /api/resource/maintenance/records | CreateMaintenanceRecordRequest（GET droneId,from,to） |
| POST/GET | /api/resource/faults | ReportFaultRequest / FaultQuery |
| POST | /api/resource/faults/{id}/handle | {handlerCrewId} |
| POST | /api/resource/faults/{id}/resolve | {resolution} |

## M4 空域合规
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /api/airspace/zones | AirspaceZoneQuery{pageNum,pageSize,type,activeOnly} |
| POST | /api/airspace/zones | CreateAirspaceZoneRequest（平台） |
| PUT | /api/airspace/zones/{id} | UpdateAirspaceZoneRequest |
| POST | /api/airspace/zones/{id}/deactivate | - |
| POST | /api/airspace/zones/mock-sync | 模拟空管同步（生成临时管制区） |
| POST | /api/airspace/fences | CreateAirspaceZoneRequest（商家围栏） |
| PUT | /api/airspace/fences/{id} | UpdateAirspaceZoneRequest |
| POST | /api/airspace/fences/{id}/deactivate | - |
| POST/GET | /api/airspace/flight-plans | CreateFlightPlanRequest / FlightPlanQuery |
| PUT | /api/airspace/flight-plans/{id} | CreateFlightPlanRequest（草稿可改） |
| GET | /api/airspace/flight-plans/{id} | 详情 |
| POST | /api/airspace/flight-plans/{id}/submit | 提交（自动校验/生成 conflicts） |
| GET | /api/airspace/flight-plans/{id}/approval-suggestion | ApprovalSuggestionDto |
| POST | /api/airspace/flight-plans/{id}/approve | {comment?} |
| POST | /api/airspace/flight-plans/{id}/reject | {reason} |
| POST | /api/airspace/flight-plans/{id}/cancel、/complete | - |
| POST/GET | /api/airspace/violations | ReportViolationRequest / ViolationQuery |
| POST | /api/airspace/violations/{id}/handle | {remark?} |
| POST | /api/airspace/violations/{id}/resolve | {resolution} |
| POST | /api/airspace/violations/{id}/penalties | {type,fineAmount?,suspendDays?,reason} |
| POST | /api/airspace/monitoring/positions | ReportPositionRequest → 检测违规 |

## M5 报表
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /api/reports/dashboard/admin | AdminDashboardDto |
| GET | /api/reports/dashboard/merchant?merchantId= | MerchantDashboardDto |
| GET | /api/reports/dashboard/air-traffic | AirTrafficDashboardDto |
| GET | /api/reports/fields?businessType= | ReportFieldDefDto[]（businessType=order） |
| POST | /api/reports/run | ReportRunRequest → ReportRunResultDto |
| POST | /api/reports/export | xlsx |
| GET | /api/reports/templates?pageNum&pageSize&includeShared | 模板分页 |
| POST/GET/PUT/DELETE | /api/reports/templates(/{id}) | 模板 CRUD |
| POST | /api/reports/shares | CreateReportShareRequest |
| GET | /api/reports/shares | 我发起的 |
| GET | /api/reports/shares/received | 分享给我 |
| POST | /api/reports/shares/{id}/revoke | 撤回 |
| POST | /api/reports/shares/{id}/access | 访问（计数） |

## M6 应急与客服
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST/GET | /api/support/emergency-alerts | CreateEmergencyAlertRequest / EmergencyQuery |
| GET | /api/support/emergency-alerts/{id} | 含 timeline |
| POST | .../{id}/dispatch | {handlers:[],plan,deadlineAt?} |
| POST | .../{id}/progress | {note,attachments?,status?} |
| POST | .../{id}/close | {result} |
| POST/GET | /api/support/tickets | CreateTicketRequest / TicketQuery |
| GET | /api/support/tickets/stats | TicketStatsDto |
| GET | /api/support/tickets/{id} | 含 replies |
| POST | .../{id}/assign | {assigneeUserId} |
| POST | .../{id}/reply | {content} |
| POST | .../{id}/complete、/close | - |
| POST | .../{id}/rate | {rating,comment?} |
| GET/POST | /api/support/tickets/canned-responses | 常用语 |
| GET | /api/help/articles、/articles/{id}、/categories | 匿名 |
| POST/PUT | /api/support/help/articles(/{id})、/{id}/publish | 帮助中心管理 |

## M7 系统配置
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /api/admin/config/params?group= | SystemConfigDto[] |
| PUT | /api/admin/config/params | {items:[{key,value}]} |
| GET/POST | /api/admin/config/endpoints | 分页 / CreateEndpointRequest |
| PUT | /api/admin/config/endpoints/{id} | UpdateEndpointRequest |
| POST | /api/admin/config/endpoints/{id}/test | EndpointCallResult |
| GET | /api/admin/config/endpoints/logs | EndpointLogQuery |
| GET/POST | /api/admin/config/backups | BackupRecordDto[] / {scope}（支持 config/knowledge/help/all） |
| POST | /api/admin/config/backups/{id}/restore | RestoreResultDto |
| GET/POST | /api/admin/config/logs、/logs/export | AuditLogQuery |
| POST | /api/admin/config/logs/cleanup | {retentionDays} |

## 通知 / 系统 / 智能体
| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | /api/notifications | NotificationQuery{pageNum,pageSize,unreadOnly} |
| POST | /api/notifications/{id}/read、/read-all | - |
| POST | /api/admin/system/reminders/run | 手动触发到期提醒扫描 |
| GET | /api/meta/context | 匿名 |
| GET | /health | 健康检查 |
| GET | /api/agent/info | AgentInfoDto（stub） |
| POST/GET | /api/agent/knowledge-docs | CreateKnowledgeDocRequest / KnowledgeDocQuery |
| PUT | /api/agent/knowledge-docs/{id} | UpdateKnowledgeDocRequest |
| GET | /api/agent/knowledge-docs/{id} | 详情 |
| POST | /api/agent/knowledge-docs/{id}/publish | - |
| POST/GET | /api/agent/tasks | CreateAgentTaskRequest / AgentTaskQuery |
| GET | /api/agent/tasks/{id} | 详情（含 output） |
| POST/GET | /api/agent/protocols | CreateAgentProtocolRequest |

## SignalR
- Hub：`/hubs/notifications`（按用户/角色分组；用于告警、审批通知等实时刷新）
