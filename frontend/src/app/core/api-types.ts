/* 天枢·低空智能运营管控平台 — 后端接口契约（依据 后端说明文档 / Dubhe Backend 控制器与 DTO 整理）
 * 统一响应：{ success, code, message, data, traceId }，code === 'ok' 表示成功
 * 分页：{ items, total, pageNum, pageSize }
 * 鉴权：Authorization: Bearer <JWT>；请求头 Device-Type: PC
 */

/* ===================== 枚举（与后端 int 枚举一致，前端用数字传输） ===================== */

export enum DeviceType { Unknown = 0, Pc = 1, Mobile = 2 }

export enum AccountStatus { PendingReview = 0, Active = 1, Rejected = 2, Frozen = 3 }

export enum UserType {
  IndividualCustomer = 1,
  EnterpriseCustomer = 2,
  Merchant = 3,
  MerchantStaff = 4,
  PlatformAdmin = 5,
  AirTrafficController = 6,
  OperationsStaff = 7,
  Pilot = 8,
  PublicUser = 9,
}

export enum OrderStatus { PendingAccept = 1, PendingDispatch = 2, InFlight = 3, Delivered = 4, Cancelled = 5 }

export enum PaymentStatus { Unpaid = 0, Paid = 1, Refunded = 2 }

export enum StatementStatus { Draft = 1, Confirmed = 2, Settled = 3 }

export enum InvoiceStatus { Submitted = 1, Issued = 2, Rejected = 3 }

export enum DroneStatus { Offline = 0, Idle = 1, InFlight = 2, Maintenance = 3 }

export enum StationType { TakeoffLanding = 1, Charging = 2 }

export enum StationStatus { Offline = 0, Idle = 1, InUse = 2, Maintenance = 3 }

export enum ReservationPurpose { Order = 1, Maintenance = 2, Charging = 3, Other = 9 }

export enum ReservationStatus { Reserved = 1, Cancelled = 2, Completed = 3 }

export enum CrewRole { Pilot = 1, Maintenance = 2 }

export enum CrewStatus { Active = 1, Suspended = 2, Departed = 3 }

export enum AttendanceStatus { Normal = 1, Late = 2, EarlyLeave = 3, Leave = 4, Absent = 5 }

export enum FaultStatus { Reported = 1, Handling = 2, Resolved = 3 }

export enum AirspaceZoneType { NoFly = 1, Restricted = 2, TemporaryControl = 3 }

export enum AirspaceZoneSource { Manual = 0, MockAts = 1, MerchantFence = 2 }

export enum FlightPlanStatus { Draft = 1, Submitted = 2, Approved = 3, Rejected = 4, Cancelled = 5, Completed = 6 }

export enum ViolationType { NoFlyIntrusion = 1, FenceBreach = 2, RouteDeviation = 3, AltitudeViolation = 4, TimeViolation = 5 }

export enum ViolationStatus { Open = 1, Handling = 2, Resolved = 3 }

export enum PenaltyType { Warning = 1, Fine = 2, Suspend = 3, Ban = 4 }

export enum EmergencyAlertLevel { Normal = 1, Serious = 2, Critical = 3 }

export enum EmergencyAlertStatus { Open = 1, Handling = 2, Resolved = 3, Closed = 4 }

export enum TicketType { Complaint = 1, Consult = 2, Advice = 3 }

export enum TicketStatus { Pending = 1, Processing = 2, Completed = 3, Closed = 4 }

export enum HelpContentType { Article = 1, Video = 2 }

export enum AgentTaskType { RequirementParse = 1, CodeGeneration = 2, QualityCheck = 3, Troubleshooting = 4, DocGeneration = 5 }

export enum AgentTaskStatus { Pending = 0, Running = 1, Succeeded = 2, Failed = 3 }

export enum NotificationType {
  System = 0, QualificationExpiry = 1, MaintenanceDue = 2, OrderStatus = 3, Alert = 4,
  FlightPlanApproved = 5, FlightPlanRejected = 6, Violation = 7, TicketUpdated = 8, EmergencyAlert = 9,
}

/* 中文标签字典 */
export const AccountStatusText: Record<number, string> = { 0: '审核中', 1: '正常', 2: '已驳回', 3: '已冻结' };
export const UserTypeText: Record<number, string> = {
  1: '个人客户', 2: '企业客户', 3: '商家', 4: '商家员工', 5: '平台管理员',
  6: '空管人员', 7: '运维人员', 8: '机长', 9: '公众用户',
};
export const OrderStatusText: Record<number, string> = { 1: '待接单', 2: '待调度', 3: '飞行中', 4: '已送达', 5: '已取消' };
export const PaymentStatusText: Record<number, string> = { 0: '未支付', 1: '已支付', 2: '已退款' };
export const StatementStatusText: Record<number, string> = { 1: '草稿', 2: '已确认', 3: '已结算' };
export const InvoiceStatusText: Record<number, string> = { 1: '已提交', 2: '已开具', 3: '已驳回' };
export const DroneStatusText: Record<number, string> = { 0: '离线', 1: '闲置', 2: '飞行中', 3: '维保中' };
export const StationTypeText: Record<number, string> = { 1: '起降场站', 2: '换电站' };
export const StationStatusText: Record<number, string> = { 0: '离线', 1: '空闲', 2: '使用中', 3: '维护中' };
export const ReservationPurposeText: Record<number, string> = { 1: '执行订单', 2: '维保', 3: '充电', 9: '其他' };
export const ReservationStatusText: Record<number, string> = { 1: '已预约', 2: '已取消', 3: '已完成' };
export const CrewRoleText: Record<number, string> = { 1: '机长', 2: '维保人员' };
export const CrewStatusText: Record<number, string> = { 1: '在职', 2: '停职', 3: '离职' };
export const AttendanceStatusText: Record<number, string> = { 1: '正常', 2: '迟到', 3: '早退', 4: '请假', 5: '缺勤' };
export const FaultStatusText: Record<number, string> = { 1: '已上报', 2: '处理中', 3: '已解决' };
export const AirspaceZoneTypeText: Record<number, string> = { 1: '禁飞区', 2: '限飞区', 3: '临时管制区' };
export const AirspaceZoneSourceText: Record<number, string> = { 0: '平台录入', 1: '空管同步', 2: '商家围栏' };
export const FlightPlanStatusText: Record<number, string> = { 1: '草稿', 2: '待审批', 3: '已批准', 4: '已驳回', 5: '已取消', 6: '已完成' };
export const ViolationTypeText: Record<number, string> = { 1: '闯入禁飞区', 2: '围栏越界', 3: '航线偏离', 4: '高度违规', 5: '时段违规' };
export const ViolationStatusText: Record<number, string> = { 1: '未处理', 2: '处理中', 3: '已解决' };
export const PenaltyTypeText: Record<number, string> = { 1: '警告', 2: '罚款', 3: '暂停服务', 4: '永久封禁' };
export const EmergencyLevelText: Record<number, string> = { 1: '一般', 2: '严重', 3: '紧急' };
export const EmergencyStatusText: Record<number, string> = { 1: '未处理', 2: '处理中', 3: '已解决', 4: '已关闭' };
export const TicketTypeText: Record<number, string> = { 1: '投诉', 2: '咨询', 3: '建议' };
export const TicketStatusText: Record<number, string> = { 1: '待处理', 2: '处理中', 3: '已完成', 4: '已关闭' };
export const HelpContentTypeText: Record<number, string> = { 1: '图文', 2: '视频' };
export const AgentTaskTypeText: Record<number, string> = { 1: '需求解析', 2: '代码生成', 3: '规范校验', 4: '问题排查', 5: '文档生成' };
export const AgentTaskStatusText: Record<number, string> = { 0: '待执行', 1: '执行中', 2: '成功', 3: '失败' };
export const NotificationTypeText: Record<number, string> = {
  0: '系统消息', 1: '资质到期', 2: '维保到期', 3: '订单状态', 4: '告警', 5: '计划批准',
  6: '计划驳回', 7: '违规', 8: '工单', 9: '应急告警',
};

/* 订单物品类型（禁运品下单前端即拦截） */
export const ItemCategories: { code: string; name: string; prohibited: boolean }[] = [
  { code: 'documents', name: '文件票据', prohibited: false },
  { code: 'food', name: '食品', prohibited: false },
  { code: 'medicine', name: '医药用品', prohibited: false },
  { code: 'electronics', name: '电子产品', prohibited: false },
  { code: 'clothing', name: '服饰', prohibited: false },
  { code: 'other', name: '其他', prohibited: false },
  { code: 'flammable', name: '易燃易爆品', prohibited: true },
  { code: 'weapon', name: '武器及管制刀具', prohibited: true },
  { code: 'drug', name: '毒品及违禁药物', prohibited: true },
  { code: 'live_animal', name: '活体动物', prohibited: true },
  { code: 'chemical', name: '危险化学品', prohibited: true },
];

export const PaymentMethods: { value: number; label: string }[] = [
  { value: 1, label: '微信支付' }, { value: 2, label: '支付宝' }, { value: 3, label: '对公转账' },
];

/* 角色编码（与后端 RoleCodes 一致） */
export const RoleCodes = {
  Admin: 'Admin', Merchant: 'Merchant', Dispatcher: 'Dispatcher', Finance: 'Finance', Operator: 'Operator',
  Pilot: 'Pilot', OperationsStaff: 'OperationsStaff', AirTrafficController: 'AirTrafficController',
  Customer: 'Customer', PublicUser: 'PublicUser',
} as const;

export const RoleText: Record<string, string> = {
  Admin: '平台管理员', Merchant: '商家', Dispatcher: '调度员', Finance: '财务', Operator: '操作员',
  Pilot: '机长', OperationsStaff: '运维人员', AirTrafficController: '空管监管人员', Customer: '客户', PublicUser: '公众/第三方',
};

/* ===================== 通用 ===================== */

export interface ApiResponse<T> { success: boolean; code: string; message: string; data: T; traceId: string }
export interface Paged<T> { items: T[]; total: number; pageNum: number; pageSize: number }

/* ===================== M1 账号与权限 ===================== */

export interface RegisterRequest {
  username: string; phone: string; password: string; displayName: string;
  userType: number; companyName?: string | null;
}
export interface LoginRequest { account: string; password: string }
export interface RefreshRequest { refreshToken: string }
export interface LogoutRequest { refreshToken: string }

export interface AuthUserDto {
  id: string; username: string; displayName: string; phone: string; email?: string | null;
  userType: string; status: string; companyName?: string | null;
  roles: string[]; permissions?: string[] | null; lastLoginAt?: string | null;
}
export interface AuthResultDto {
  accessToken: string; accessTokenExpiresAt: string; refreshToken: string;
  refreshTokenExpiresAt: string; user: AuthUserDto;
}

export interface UpdateProfileRequest { displayName?: string | null; email?: string | null; avatarUrl?: string | null }
export interface FreezeUserRequest { reason: string }
export interface RejectUserRequest { reason: string }
export interface AssignRolesRequest { roleCodes: string[] }

export interface UserQuery {
  pageNum?: number; pageSize?: number; keyword?: string; status?: number; roleCode?: string;
}
export interface UserListItemDto {
  id: string; username: string; phone: string; displayName: string; userType: string; status: string;
  roles: string[]; createdAt: string; lastLoginAt?: string | null;
}
export interface RoleDto { id: string; code: string; name: string; description: string; isSystem: boolean; permissions: string[] }
export interface PermissionDto { code: string; name: string }
export interface PermissionGroupDto { module: string; items: PermissionDto[] }

/* ===================== M2 订单全流程 ===================== */

export interface OrderCreateRequest {
  merchantId: string;
  senderName: string; senderPhone: string; senderAddress: string; senderLat: number; senderLng: number;
  receiverName: string; receiverPhone: string; receiverAddress: string; receiverLat: number; receiverLng: number;
  itemCategory: string; itemName: string; weightKg: number; volumeM3: number; quantity: number;
  isUrgent: boolean; scheduledAt?: string | null; couponAmount: number;
  complianceProofUrl?: string | null; remark?: string | null;
}
export interface FeeBreakdownDto {
  distanceKm: number; baseFee: number; distanceFee: number; weightFee: number; airspaceFee: number;
  urgentFee: number; discountAmount: number; totalAmount: number;
}
export interface WaypointDto { lat: number; lng: number }
export interface OrderStatusHistoryDto { fromStatus?: string | null; toStatus: string; operatorId?: string | null; remark?: string | null; at: string }
export interface OrderEstimateDto { distanceKm: number; serviceAreaChecked: boolean; fee: FeeBreakdownDto }
export interface SenderInfo { name: string; phone: string; address: string; lat: number; lng: number }
export interface ReceiverInfo { name: string; phone: string; address: string; lat: number; lng: number }

export interface OrderDto {
  id: string; orderNo: string; customerId: string; customerName?: string | null;
  merchantId: string; merchantName?: string | null; status: string;
  sender: SenderInfo; receiver: ReceiverInfo;
  itemCategory: string; itemName: string; weightKg: number; volumeM3: number; quantity: number;
  isUrgent: boolean; complianceProofUrl?: string | null; remark?: string | null; scheduledAt?: string | null;
  fee: FeeBreakdownDto; droneId?: string | null; pilotId?: string | null; dispatchedAt?: string | null;
  plannedRoute?: WaypointDto[] | null; dispatchRemark?: string | null;
  acceptedAt?: string | null; inFlightAt?: string | null; deliveredAt?: string | null;
  cancelReason?: string | null; cancelledAt?: string | null;
  rating?: number | null; reviewComment?: string | null; reviewedAt?: string | null;
  createdAt: string; history: OrderStatusHistoryDto[];
  paymentStatus: string; paidAt?: string | null;
}
export interface OrderListItemDto {
  id: string; orderNo: string; status: string; merchantId: string; merchantName?: string | null;
  customerId: string; customerName?: string | null; receiverName: string; receiverAddress: string;
  itemName: string; weightKg: number; isUrgent: boolean; totalAmount: number; droneId?: string | null;
  createdAt: string; deliveredAt?: string | null;
}
export interface OrderQuery {
  pageNum?: number; pageSize?: number; status?: number; keyword?: string;
  createdFrom?: string; createdTo?: string;
}
export interface RejectOrderRequest { reason: string }
export interface CancelOrderRequest { reason?: string | null }
export interface DispatchOrderRequest { droneId: string; pilotId?: string | null; waypoints?: WaypointDto[] | null; remark?: string | null }
export interface CompleteOrderRequest { remark?: string | null }
export interface ReviewOrderRequest { rating: number; comment?: string | null }

export interface OrderImportRowErrorDto { rowNumber: number; message: string }
export interface OrderImportResultDto { total: number; succeeded: number; failed: number; errors: OrderImportRowErrorDto[]; orderIds: string[] }

export interface AutoAcceptRuleDto { merchantId: string; enabled: boolean; maxWeightKg?: number | null; maxDistanceKm?: number | null }
export interface UpdateAutoAcceptRuleRequest { enabled: boolean; maxWeightKg?: number | null; maxDistanceKm?: number | null }

export interface PayOrderRequest { method: number; simulateFailure: boolean; failureReason?: string | null }
export interface RefundOrderRequest { reason: string }
export interface PaymentDto {
  id: string; orderId: string; payerId: string; method: string; amount: number; status: string;
  transactionNo?: string | null; failureReason?: string | null; paidAt?: string | null;
  refundedAt?: string | null; refundReason?: string | null; createdAt: string;
}

export interface GenerateSettlementRequest { merchantId?: string | null; periodStart: string; periodEnd: string }
export interface SettlementItemDto {
  orderId: string; orderNo: string; totalAmount: number; commissionAmount: number; netAmount: number;
  paymentStatus: string; deliveredAt?: string | null;
}
export interface SettlementReconciliationDto {
  paidCount: number; unpaidCount: number; refundedCount: number; unpaidAmount: number; refundedAmount: number;
}
export interface SettlementStatementDto {
  id: string; statementNo: string; merchantId: string; periodStart: string; periodEnd: string;
  orderCount: number; totalAmount: number; commissionRate: number; commissionAmount: number; netAmount: number;
  status: string; generatedAt: string; confirmedAt?: string | null; settledAt?: string | null; remark?: string | null;
  reconciliation?: SettlementReconciliationDto | null; items?: SettlementItemDto[] | null;
}
export interface SettlementQuery {
  pageNum?: number; pageSize?: number; merchantId?: string; status?: number; from?: string; to?: string;
}

export interface CreateInvoiceRequest { orderIds: string[]; title: string; taxNo: string; remark?: string | null }
export interface IssueInvoiceRequest { invoiceNo: string; fileUrl?: string | null }
export interface RejectInvoiceRequest { reason: string }
export interface InvoiceDto {
  id: string; applicantUserId: string; merchantId?: string | null; title: string; taxNo: string;
  amount: number; orderIds: string[]; status: string; invoiceNo?: string | null; fileUrl?: string | null;
  rejectedReason?: string | null; issuedAt?: string | null; remark?: string | null; createdAt: string;
}
export interface InvoiceQuery { pageNum?: number; pageSize?: number; status?: number }

/* ===================== M3 低空资源 ===================== */

export interface CreateDroneRequest {
  merchantId?: string | null; serialNo: string; model: string;
  maxPayloadKg: number; enduranceMinutes: number; batteryPercent: number;
}
export interface DroneDto {
  id: string; merchantId: string; serialNo: string; model: string; status: string;
  maxPayloadKg: number; enduranceMinutes: number; batteryPercent: number;
  cumulativeFlightMinutes: number; healthScore: number; lastMaintainedAt?: string | null; createdAt: string;
}
export interface DroneQuery { pageNum?: number; pageSize?: number; keyword?: string; status?: number; merchantId?: string }

export interface CreateServiceAreaRequest { merchantId?: string | null; name: string; centerLat: number; centerLng: number; radiusKm: number }
export interface ServiceAreaDto {
  id: string; merchantId: string; name: string; centerLat: number; centerLng: number;
  radiusKm: number; isActive: boolean; createdAt: string;
}

export interface CreateStationRequest {
  merchantId?: string | null; name: string; type: number; address: string; lat: number; lng: number;
  capacity: number; chargerCount: number; remark?: string | null;
}
export interface UpdateStationRequest {
  name?: string | null; address?: string | null; lat?: number | null; lng?: number | null;
  capacity?: number | null; chargerCount?: number | null; status?: number | null; remark?: string | null;
}
export interface StationDto {
  id: string; merchantId: string; name: string; type: string; address: string; lat: number; lng: number;
  capacity: number; chargerCount: number; status: string; remark?: string | null; createdAt: string;
}
export interface StationQuery { pageNum?: number; pageSize?: number; keyword?: string; type?: number; status?: number; merchantId?: string }

export interface CreateReservationRequest { startAt: string; endAt: string; purpose: number; orderId?: string | null; remark?: string | null }
export interface ReservationDto {
  id: string; stationId: string; merchantId: string; orderId?: string | null; startAt: string; endAt: string;
  purpose: string; status: string; remark?: string | null; createdAt: string;
}

export interface CreateCrewRequest {
  merchantId?: string | null; userId?: string | null; name: string; gender?: string | null;
  phone: string; role: number; region?: string | null;
}
export interface UpdateCrewRequest {
  name?: string | null; gender?: string | null; phone?: string | null; role?: number | null;
  region?: string | null; status?: number | null;
}
export interface CrewQuery { pageNum?: number; pageSize?: number; keyword?: string; role?: number; status?: number; merchantId?: string }
export interface QualificationDto {
  id: string; type: string; number: string; issuedAt: string; expiresAt: string; isExpired: boolean; fileUrl?: string | null;
}
export interface CrewDto {
  id: string; merchantId: string; userId?: string | null; name: string; gender?: string | null; phone: string;
  role: string; region?: string | null; status: string; qualificationCount: number;
  createdAt: string; qualifications?: QualificationDto[] | null;
}
export interface AddQualificationRequest { type: string; number: string; issuedAt: string; expiresAt: string; fileUrl?: string | null }
export interface CreateScheduleRequest { startAt: string; endAt: string; area?: string | null; droneId?: string | null; remark?: string | null }
export interface ScheduleDto {
  id: string; crewMemberId: string; startAt: string; endAt: string; area?: string | null;
  droneId?: string | null; remark?: string | null;
}
export interface RecordAttendanceRequest { date: string; status: number; remark?: string | null }
export interface AttendanceDto { id: string; crewMemberId: string; date: string; status: string; remark?: string | null }

export interface UpsertMaintenancePlanRequest {
  droneId: string; intervalDays?: number | null; intervalFlightMinutes?: number | null;
  enabled: boolean; remark?: string | null;
}
export interface MaintenancePlanDto {
  id: string; droneId: string; droneSerialNo: string; enabled: boolean; intervalDays?: number | null;
  intervalFlightMinutes?: number | null; lastMaintainedAt?: string | null; lastMaintainedFlightMinutes?: number | null;
  nextDueAt?: string | null; nextDueFlightMinutes?: number | null; status: string; remark?: string | null;
}
export interface CreateMaintenanceRecordRequest {
  droneId: string; planId?: string | null; crewMemberId?: string | null; type: string;
  content: string; maintainedAt: string; fileUrl?: string | null;
}
export interface MaintenanceRecordDto {
  id: string; droneId: string; planId?: string | null; crewMemberId?: string | null; type: string;
  content: string; maintainedAt: string; fileUrl?: string | null; createdAt: string;
}

export interface ReportFaultRequest {
  droneId: string; faultType: string; description: string; photoUrls?: string[] | null; lat?: number | null; lng?: number | null;
}
export interface HandleFaultRequest { handlerCrewId: string }
export interface ResolveFaultRequest { resolution: string }
export interface FaultQuery { pageNum?: number; pageSize?: number; droneId?: string; status?: number; merchantId?: string }
export interface FaultDto {
  id: string; merchantId: string; droneId: string; faultType: string; description: string;
  photoUrls?: string[] | null; lat?: number | null; lng?: number | null; status: string; handlerCrewId?: string | null;
  resolution?: string | null; reportedBy: string; reportedAt: string; resolvedAt?: string | null;
}

/* ===================== M4 空域合规 ===================== */

export interface CreateAirspaceZoneRequest {
  name: string; type: number; centerLat: number; centerLng: number; radiusKm: number;
  minAltitudeM?: number | null; maxAltitudeM?: number | null;
  effectiveFrom?: string | null; effectiveTo?: string | null; reason?: string | null;
}
export interface UpdateAirspaceZoneRequest extends Partial<CreateAirspaceZoneRequest> { isActive?: boolean | null }
export interface AirspaceZoneDto {
  id: string; code: string; name: string; type: string; source: string; merchantId?: string | null;
  centerLat: number; centerLng: number; radiusKm: number;
  minAltitudeM?: number | null; maxAltitudeM?: number | null;
  effectiveFrom?: string | null; effectiveTo?: string | null; reason?: string | null;
  isActive: boolean; createdAt: string;
}
export interface AirspaceZoneQuery { pageNum?: number; pageSize?: number; type?: number; activeOnly?: boolean }
export interface AirspaceConflictDto { zoneId?: string | null; code: string; name: string; type: string; reason: string }
export interface AirspaceCheckResultDto { conflicts: AirspaceConflictDto[]; nearestNoFlyDistanceKm: number; passed: boolean }

export interface FlightPlanWaypointDto { lat: number; lng: number }
export interface CreateFlightPlanRequest {
  merchantId?: string | null; orderId?: string | null; droneId: string; pilotCrewId?: string | null;
  purpose: string; startAt: string; endAt: string; maxAltitudeM: number; waypoints: FlightPlanWaypointDto[];
}
export interface ApproveFlightPlanRequest { comment?: string | null }
export interface RejectFlightPlanRequest { reason: string }
export interface FlightPlanDto {
  id: string; planNo?: string | null; merchantId: string; orderId?: string | null;
  droneId: string; droneSerialNo?: string | null; pilotCrewId?: string | null; pilotName?: string | null;
  purpose: string; startAt: string; endAt: string; maxAltitudeM: number;
  waypoints: FlightPlanWaypointDto[]; status: string; conflicts?: AirspaceConflictDto[] | null;
  submittedAt?: string | null; approvedAt?: string | null; approvalComment?: string | null;
  rejectReason?: string | null; cancelledAt?: string | null; createdAt: string;
}
export interface FlightPlanQuery { pageNum?: number; pageSize?: number; status?: number; merchantId?: string; keyword?: string }
export interface ApprovalSuggestionDto { suggestion: string; reasons: string[] }

export interface ReportViolationRequest {
  merchantId: string; droneId?: string | null; orderId?: string | null; flightPlanId?: string | null;
  type: number; description: string; lat?: number | null; lng?: number | null;
  altitudeM?: number | null; occurredAt?: string | null;
}
export interface HandleViolationRequest { remark?: string | null }
export interface ResolveViolationRequest { resolution: string }
export interface IssuePenaltyRequest { type: number; fineAmount?: number | null; suspendDays?: number | null; reason: string }
export interface PenaltyDto {
  id: string; violationId: string; type: string; fineAmount?: number | null; suspendDays?: number | null;
  reason: string; issuedBy: string; issuedAt: string;
}
export interface ViolationDto {
  id: string; merchantId: string; droneId?: string | null; orderId?: string | null; flightPlanId?: string | null;
  type: string; description: string; lat?: number | null; lng?: number | null; altitudeM?: number | null;
  status: string; resolution?: string | null; occurredAt: string; createdAt: string; penalties?: PenaltyDto[] | null;
}
export interface ViolationQuery { pageNum?: number; pageSize?: number; merchantId?: string; status?: number; type?: number }

export interface ReportPositionRequest {
  droneId: string; lat: number; lng: number; altitudeM: number; reportedAt?: string | null; flightPlanId?: string | null;
}
export interface PositionReportResultDto { detectedViolations: ViolationDto[]; distanceToRouteKm?: number | null }

/* ===================== M5 统计与报表 ===================== */

export interface TrendPointDto { date: string; value: number }
export interface DistributionItemDto { bucket: string; count: number }
export interface AlertItemDto { type: string; level: string; title: string; occurredAt: string }
export interface AdminDashboardDto {
  totalOrders: number; todayOrders: number; totalRevenue: number; activeMerchants: number; activeCustomers: number;
  airspaceUtilization: number; violationRate: number;
  alerts: AlertItemDto[]; orderTrend: TrendPointDto[]; violationTrend: TrendPointDto[];
}
export interface MerchantDashboardDto {
  completedOrders: number; createdOrders: number; paidRevenue: number; completionRate: number; droneUtilization: number;
  deliveryDurationDistribution: DistributionItemDto[]; revenueTrend: TrendPointDto[];
}
export interface DensityCellDto { lat: number; lng: number; count: number }
export interface AirTrafficDashboardDto {
  totalPlans: number; approvedPlans: number; approvalRate: number; conflictPlans: number; conflictRate: number;
  violationsByType: DistributionItemDto[]; flightDensity: DensityCellDto[];
}
export interface ReportFieldDefDto { key: string; name: string; type: string }
export interface ReportFilterDto { from?: string | null; to?: string | null; status?: string | null }
export interface ReportRunRequest { businessType: string; fields: string[]; filters: ReportFilterDto }
export interface ReportRunResultDto {
  businessType: string; columns: ReportFieldDefDto[]; rows: Record<string, unknown>[]; total: number; totalAmount: number;
}
export interface CreateReportTemplateRequest {
  name: string; businessType: string; fields: string[]; filters: ReportFilterDto; isShared: boolean; remark?: string | null;
}
export interface UpdateReportTemplateRequest {
  name?: string | null; fields?: string[] | null; filters?: ReportFilterDto | null; isShared?: boolean | null; remark?: string | null;
}
export interface ReportTemplateDto {
  id: string; name: string; businessType: string; fields: string[]; filters: ReportFilterDto;
  ownerUserId: string; merchantId?: string | null; isShared: boolean; remark?: string | null;
  createdAt: string; updatedAt: string;
}
export interface CreateReportShareRequest {
  recipientUserId: string; title: string; businessType: string; fields: string[];
  filters: ReportFilterDto; expireDays: number; canExport: boolean;
}
export interface ReportShareDto {
  id: string; ownerUserId: string; recipientUserId: string; title: string; businessType: string;
  fields: string[]; filters: ReportFilterDto; expireAt: string; canExport: boolean; isRevoked: boolean;
  accessCount: number; lastAccessedAt?: string | null; createdAt: string;
}

/* ===================== M6 应急与客服 ===================== */

export interface CreateEmergencyAlertRequest {
  title: string; content: string; level: number; source?: string | null;
  relatedId?: string | null; merchantId?: string | null;
}
export interface DispatchEmergencyRequest { handlers: string[]; plan: string; deadlineAt?: string | null }
export interface ProgressEmergencyRequest { note: string; attachments?: string[] | null; status?: number | null }
export interface CloseEmergencyRequest { result: string }
export interface EmergencyTimelineDto {
  id: string; action: string; note?: string | null; attachments?: string[] | null; operatorId: string; at: string;
}
export interface EmergencyAlertDto {
  id: string; title: string; content: string; level: string; status: string; source: string;
  relatedId?: string | null; merchantId?: string | null; reportedBy: string; reportedAt: string;
  handlers?: string[] | null; disposalPlan?: string | null; deadlineAt?: string | null; result?: string | null;
  closedAt?: string | null; createdAt: string; timeline?: EmergencyTimelineDto[] | null;
}
export interface EmergencyQuery {
  pageNum?: number; pageSize?: number; level?: number; status?: number; merchantId?: string; keyword?: string;
}

export interface CreateTicketRequest { type: number; title: string; content: string; attachments?: string[] | null; orderId?: string | null }
export interface AssignTicketRequest { assigneeUserId: string }
export interface ReplyTicketRequest { content: string }
export interface RateTicketRequest { rating: number; comment?: string | null }
export interface TicketReplyDto { id: string; userId: string; content: string; isStaff: boolean; at: string }
export interface ServiceTicketDto {
  id: string; ticketNo: string; type: string; status: string; title: string; content: string;
  attachments?: string[] | null; submitterUserId: string; merchantId?: string | null; orderId?: string | null;
  assigneeUserId?: string | null; assignedAt?: string | null; completedAt?: string | null; closedAt?: string | null;
  satisfactionRating?: number | null; satisfactionComment?: string | null; createdAt: string;
  replies?: TicketReplyDto[] | null;
}
export interface TicketQuery {
  pageNum?: number; pageSize?: number; type?: number; status?: number;
  assigneeUserId?: string; merchantId?: string; keyword?: string;
}
export interface TicketStatsDto {
  total: number; pending: number; processing: number; completed: number; closed: number;
  averageHandlingHours: number; ratedCount: number; averageRating: number;
}
export interface CreateCannedResponseRequest { content: string; category?: string | null }
export interface CannedResponseDto { id: string; content: string; category?: string | null; createdAt: string }

export interface CreateHelpArticleRequest {
  title: string; category: string; tags: string; contentType: number;
  videoUrl?: string | null; content: string; isPublished: boolean;
}
export interface UpdateHelpArticleRequest extends Partial<CreateHelpArticleRequest> {}
export interface HelpArticleDto {
  id: string; title: string; category: string; tags: string; contentType: string;
  videoUrl?: string | null; content: string; isPublished: boolean; viewCount: number;
  createdAt: string; updatedAt: string;
}
export interface HelpQuery { pageNum?: number; pageSize?: number; keyword?: string; category?: string; contentType?: number }

/* ===================== 通知 ===================== */

export interface NotificationDto {
  id: string; type: string; title: string; content: string; relatedId?: string | null;
  isRead: boolean; readAt?: string | null; createdAt: string;
}
export interface NotificationQuery { pageNum?: number; pageSize?: number; unreadOnly?: boolean }

/* ===================== M7 系统配置 ===================== */

export interface SystemConfigDto {
  id: string; key: string; value: string; group: string; name: string;
  description?: string | null; valueType: string; updatedAt: string;
}
export interface UpdateConfigItemDto { key: string; value: string }
export interface UpdateConfigRequest { items: UpdateConfigItemDto[] }

export interface CreateEndpointRequest {
  name: string; url: string; method: string; isEnabled: boolean;
  timeoutSeconds: number; maxRetries: number; headers?: string | null;
}
export interface UpdateEndpointRequest extends Partial<CreateEndpointRequest> {}
export interface EndpointDto {
  id: string; name: string; url: string; method: string; isEnabled: boolean; timeoutSeconds: number;
  maxRetries: number; headers?: string | null; lastCallAt?: string | null; lastCallSucceeded?: boolean | null;
  totalCalls: number; failedCalls: number; successRate: number; createdAt: string;
}
export interface EndpointCallResult {
  succeeded: boolean; statusCode?: number | null; durationMs: number; responseSnippet?: string | null; error?: string | null;
}
export interface EndpointLogQuery {
  pageNum?: number; pageSize?: number; endpointId?: string; succeeded?: boolean; from?: string; to?: string;
}
export interface InterfaceCallLogDto {
  id: string; endpointId?: string | null; endpointName: string; url: string; method: string;
  statusCode?: number | null; succeeded: boolean; durationMs: number; error?: string | null; createdAt: string;
}

export interface CreateBackupRequest { scope: string }
export interface BackupRecordDto {
  id: string; fileName: string; scope: string; sizeBytes: number; status: string; error?: string | null;
  restoredAt?: string | null; createdBy: string; createdAt: string;
}
export interface RestoreResultDto {
  backupId: string; configCount: number; knowledgeDocCount: number; helpArticleCount: number; restoredAt: string;
}

export interface AuditLogQuery {
  pageNum?: number; pageSize?: number; module?: string; keyword?: string; succeeded?: boolean; from?: string; to?: string;
}
export interface AuditLogDto {
  id: string; userId?: string | null; username?: string | null; module: string; action: string;
  detail?: string | null; ip?: string | null; succeeded: boolean; durationMs: number; createdAt: string;
}
export interface CleanupLogsResultDto { deleted: number }

/* ===================== 智能体（骨架） ===================== */

export interface CreateKnowledgeDocRequest {
  title: string; category: string; tags: string; content: string; version?: string | null; isPublished: boolean;
}
export interface UpdateKnowledgeDocRequest extends Partial<CreateKnowledgeDocRequest> {}
export interface KnowledgeDocQuery { pageNum?: number; pageSize?: number; keyword?: string; category?: string; publishedOnly?: boolean }
export interface KnowledgeDocDto {
  id: string; title: string; category: string; tags: string; content: string; version: string;
  isPublished: boolean; createdBy: string; createdAt: string; updatedAt: string;
}
export interface CreateAgentTaskRequest { type: number; title: string; input: string }
export interface AgentTaskQuery { pageNum?: number; pageSize?: number; type?: number; status?: number }
export interface AgentTaskDto {
  id: string; type: string; title: string; input: string; output?: string | null; status: string;
  error?: string | null; createdBy: string; startedAt?: string | null; finishedAt?: string | null;
  durationMs: number; createdAt: string;
}
export interface CreateAgentProtocolRequest { name: string; version: string; description?: string | null; content: string }
export interface AgentProtocolDto {
  id: string; name: string; version: string; description?: string | null; content: string;
  isActive: boolean; createdAt: string;
}
export interface AgentInfoDto {
  implementation: string; description: string; supportedTaskTypes: string[]; roadmap: string[];
}

/* ===================== 系统 ===================== */

export interface MetaContextDto { apiVersion: string; deviceType: string; ip: string; serverTime: string }

/* ===================== 字符串枚举字典（DTO 中 Status/Type/Role 等字段返回枚举名） ===================== */

export const UserTypeNameText: Record<string, string> = {
  IndividualCustomer: '个人客户', EnterpriseCustomer: '企业客户', Merchant: '商家', MerchantStaff: '商家员工',
  PlatformAdmin: '平台管理员', AirTrafficController: '空管人员', OperationsStaff: '运维人员',
  Pilot: '机长', PublicUser: '公众用户',
};
export const AccountStatusNameText: Record<string, string> = {
  PendingReview: '审核中', Active: '正常', Rejected: '已驳回', Frozen: '已冻结',
};
export const OrderStatusNameText: Record<string, string> = {
  PendingAccept: '待接单', PendingDispatch: '待调度', InFlight: '飞行中', Delivered: '已送达', Cancelled: '已取消',
};
export const OrderPaymentStatusNameText: Record<string, string> = { Unpaid: '未支付', Paid: '已支付', Refunded: '已退款' };
export const PaymentStatusNameText: Record<string, string> = { Pending: '待支付', Succeeded: '成功', Failed: '失败', Refunded: '已退款' };
export const PaymentMethodNameText: Record<string, string> = { Wechat: '微信支付', Alipay: '支付宝', BankTransfer: '对公转账' };
export const StatementStatusNameText: Record<string, string> = { Draft: '草稿', Confirmed: '已确认', Settled: '已结算' };
export const InvoiceStatusNameText: Record<string, string> = { Submitted: '已提交', Issued: '已开具', Rejected: '已驳回' };
export const DroneStatusNameText: Record<string, string> = { Offline: '离线', Idle: '闲置', InFlight: '飞行中', Maintenance: '维保中' };
export const StationTypeNameText: Record<string, string> = { TakeoffLanding: '起降场站', Charging: '换电站' };
export const StationStatusNameText: Record<string, string> = { Offline: '离线', Idle: '空闲', InUse: '使用中', Maintenance: '维护中' };
export const ReservationPurposeNameText: Record<string, string> = { Order: '执行订单', Maintenance: '维保', Charging: '充电', Other: '其他' };
export const ReservationStatusNameText: Record<string, string> = { Reserved: '已预约', Cancelled: '已取消', Completed: '已完成' };
export const CrewRoleNameText: Record<string, string> = { Pilot: '机长', Maintenance: '维保人员' };
export const CrewStatusNameText: Record<string, string> = { Active: '在职', Suspended: '停职', Departed: '离职' };
export const AttendanceStatusNameText: Record<string, string> = { Normal: '正常', Late: '迟到', EarlyLeave: '早退', Leave: '请假', Absent: '缺勤' };
export const FaultStatusNameText: Record<string, string> = { Reported: '已上报', Handling: '处理中', Resolved: '已解决' };
export const MaintenanceStatusNameText: Record<string, string> = { Ok: '正常', Normal: '正常', DueSoon: '即将到期', Overdue: '已超期', Disabled: '已停用' };
export const AirspaceZoneTypeNameText: Record<string, string> = { NoFly: '禁飞区', Restricted: '限飞区', TemporaryControl: '临时管制区' };
export const AirspaceZoneSourceNameText: Record<string, string> = { Manual: '平台录入', MockAts: '空管同步', MerchantFence: '商家围栏' };
export const FlightPlanStatusNameText: Record<string, string> = {
  Draft: '草稿', Submitted: '待审批', Approved: '已批准', Rejected: '已驳回', Cancelled: '已取消', Completed: '已完成',
};
export const ViolationTypeNameText: Record<string, string> = {
  NoFlyIntrusion: '闯入禁飞区', FenceBreach: '围栏越界', RouteDeviation: '航线偏离', AltitudeViolation: '高度违规', TimeViolation: '时段违规',
};
export const ViolationStatusNameText: Record<string, string> = { Open: '未处理', Handling: '处理中', Resolved: '已解决' };
export const PenaltyTypeNameText: Record<string, string> = { Warning: '警告', Fine: '罚款', Suspend: '暂停服务', Ban: '永久封禁' };
export const EmergencyLevelNameText: Record<string, string> = { Normal: '一般', Serious: '严重', Critical: '紧急' };
export const EmergencyStatusNameText: Record<string, string> = { Open: '未处理', Handling: '处理中', Resolved: '已解决', Closed: '已关闭' };
export const TicketTypeNameText: Record<string, string> = { Complaint: '投诉', Consult: '咨询', Advice: '建议' };
export const TicketStatusNameText: Record<string, string> = { Pending: '待处理', Processing: '处理中', Completed: '已完成', Closed: '已关闭' };
export const HelpContentTypeNameText: Record<string, string> = { Article: '图文', Video: '视频' };
export const AgentTaskTypeNameText: Record<string, string> = {
  RequirementParse: '需求解析', CodeGeneration: '代码生成', QualityCheck: '规范校验', Troubleshooting: '问题排查', DocGeneration: '文档生成',
};
export const AgentTaskStatusNameText: Record<string, string> = { Pending: '待执行', Running: '执行中', Succeeded: '成功', Failed: '失败' };
export const NotificationTypeNameText: Record<string, string> = {
  System: '系统消息', QualificationExpiry: '资质到期', MaintenanceDue: '维保到期', OrderStatus: '订单状态',
  Alert: '告警', FlightPlanApproved: '计划批准', FlightPlanRejected: '计划驳回', Violation: '违规',
  TicketUpdated: '工单', EmergencyAlert: '应急告警',
};
export const BackupStatusNameText: Record<string, string> = { Succeeded: '成功', Failed: '失败' };

