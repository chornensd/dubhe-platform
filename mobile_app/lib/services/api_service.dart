import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../core/session.dart';
import '../models/models.dart';

/// 天枢移动端 API（按模块分组，全部返回强类型模型）。
class DubheApi {
  DubheApi(this._c);

  final ApiClient _c;

  static Map<String, dynamic> _map(dynamic data) =>
      Map<String, dynamic>.from(data as Map);

  static List<Map<String, dynamic>> _maps(dynamic data) =>
      ((data as List?) ?? const [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();

  // ===================== 系统 =====================

  Future<MetaContext> context() => _c.get<MetaContext>(
        '/api/meta/context',
        parse: (d) => MetaContext.fromJson(_map(d)),
      );

  // ===================== 账号 =====================

  Future<AuthUser> me() => _c.get<AuthUser>(
        '/api/users/me',
        parse: (d) => AuthUser.fromJson(_map(d)),
      );

  Future<AuthUser> updateProfile({
    String? displayName,
    String? email,
    String? avatarUrl,
  }) =>
      _c.put<AuthUser>(
        '/api/users/me',
        body: {
          'displayName': displayName,
          'email': email,
          'avatarUrl': avatarUrl,
        },
        parse: (d) => AuthUser.fromJson(_map(d)),
      );

  // ===================== 订单 =====================

  /// 可选运营商家（含服务区域，供客户下单选择）。
  Future<List<MerchantOption>> availableMerchants({String? keyword}) =>
      _c.get<List<MerchantOption>>(
        '/api/orders/available-merchants',
        query: {'keyword': keyword},
        parse: (d) =>
            _maps(d).map((e) => MerchantOption.fromJson(e)).toList(),
      );

  Future<OrderEstimate> estimateOrder(Map<String, dynamic> body) =>
      _c.post<OrderEstimate>(
        '/api/orders/estimate',
        body: body,
        parse: (d) => OrderEstimate.fromJson(_map(d)),
      );

  Future<OrderDetail> createOrder(Map<String, dynamic> body) =>
      _c.post<OrderDetail>(
        '/api/orders',
        body: body,
        parse: (d) => OrderDetail.fromJson(_map(d)),
      );

  Future<Paged<OrderListItem>> searchOrders({
    int pageNum = 1,
    int pageSize = 20,
    String? status,
    String? keyword,
  }) =>
      _c.get<Paged<OrderListItem>>(
        '/api/orders',
        query: {
          'pageNum': pageNum,
          'pageSize': pageSize,
          'status': status,
          'keyword': keyword,
        },
        parse: (d) =>
            Paged.fromJson(_map(d), OrderListItem.fromJson),
      );

  Future<OrderDetail> orderDetail(String id) => _c.get<OrderDetail>(
        '/api/orders/$id',
        parse: (d) => OrderDetail.fromJson(_map(d)),
      );

  Future<OrderDetail> acceptOrder(String id) => _c.post<OrderDetail>(
        '/api/orders/$id/accept',
        parse: (d) => OrderDetail.fromJson(_map(d)),
      );

  Future<OrderDetail> rejectOrder(String id, String reason) =>
      _c.post<OrderDetail>(
        '/api/orders/$id/reject',
        body: {'reason': reason},
        parse: (d) => OrderDetail.fromJson(_map(d)),
      );

  Future<OrderDetail> cancelOrder(String id, {String? reason}) =>
      _c.post<OrderDetail>(
        '/api/orders/$id/cancel',
        body: {'reason': reason},
        parse: (d) => OrderDetail.fromJson(_map(d)),
      );

  Future<OrderDetail> startOrder(String id) => _c.post<OrderDetail>(
        '/api/orders/$id/start',
        parse: (d) => OrderDetail.fromJson(_map(d)),
      );

  Future<OrderDetail> completeOrder(String id, {String? remark}) =>
      _c.post<OrderDetail>(
        '/api/orders/$id/complete',
        body: {'remark': remark},
        parse: (d) => OrderDetail.fromJson(_map(d)),
      );

  /// 机长拒绝调度指派（退回待调度）。
  Future<OrderDetail> declineOrder(String id, {String? reason}) =>
      _c.post<OrderDetail>(
        '/api/orders/$id/decline',
        body: {'reason': reason},
        parse: (d) => OrderDetail.fromJson(_map(d)),
      );

  Future<OrderDetail> reviewOrder(String id, int rating, {String? comment}) =>
      _c.post<OrderDetail>(
        '/api/orders/$id/review',
        body: {'rating': rating, 'comment': comment},
        parse: (d) => OrderDetail.fromJson(_map(d)),
      );

  Future<PaymentRecord> payOrder(
    String id, {
    required int method,
    bool simulateFailure = false,
    String? failureReason,
  }) =>
      _c.post<PaymentRecord>(
        '/api/orders/$id/pay',
        body: {
          'method': method,
          'simulateFailure': simulateFailure,
          'failureReason': failureReason,
        },
        parse: (d) => PaymentRecord.fromJson(_map(d)),
      );

  Future<List<PaymentRecord>> orderPayments(String id) =>
      _c.get<List<PaymentRecord>>(
        '/api/orders/$id/payments',
        parse: (d) =>
            _maps(d).map((e) => PaymentRecord.fromJson(e)).toList(),
      );

  Future<OrderDetail> refundOrder(String id, String reason) =>
      _c.post<OrderDetail>(
        '/api/orders/$id/refund',
        body: {'reason': reason},
        parse: (d) => OrderDetail.fromJson(_map(d)),
      );

  // ===================== 发票 =====================

  Future<Paged<InvoiceItem>> invoices({
    int pageNum = 1,
    int pageSize = 20,
    int? status,
  }) =>
      _c.get<Paged<InvoiceItem>>(
        '/api/invoices',
        query: {'pageNum': pageNum, 'pageSize': pageSize, 'status': status},
        parse: (d) => Paged.fromJson(_map(d), InvoiceItem.fromJson),
      );

  Future<InvoiceItem> applyInvoice({
    required List<String> orderIds,
    required String title,
    required String taxNo,
    String? remark,
  }) =>
      _c.post<InvoiceItem>(
        '/api/invoices',
        body: {
          'orderIds': orderIds,
          'title': title,
          'taxNo': taxNo,
          'remark': remark,
        },
        parse: (d) => InvoiceItem.fromJson(_map(d)),
      );

  // ===================== 低空资源 =====================

  Future<Paged<Drone>> drones({
    int pageNum = 1,
    int pageSize = 20,
    String? keyword,
    int? status,
  }) =>
      _c.get<Paged<Drone>>(
        '/api/resource/drones',
        query: {
          'pageNum': pageNum,
          'pageSize': pageSize,
          'keyword': keyword,
          'status': status,
        },
        parse: (d) => Paged.fromJson(_map(d), Drone.fromJson),
      );

  Future<Paged<FaultItem>> faults({
    int pageNum = 1,
    int pageSize = 20,
    String? droneId,
    int? status,
  }) =>
      _c.get<Paged<FaultItem>>(
        '/api/resource/faults',
        query: {
          'pageNum': pageNum,
          'pageSize': pageSize,
          'droneId': droneId,
          'status': status,
        },
        parse: (d) => Paged.fromJson(_map(d), FaultItem.fromJson),
      );

  Future<FaultItem> fault(String id) => _c.get<FaultItem>(
        '/api/resource/faults/$id',
        parse: (d) => FaultItem.fromJson(_map(d)),
      );

  Future<FaultItem> reportFault({
    required String droneId,
    required String faultType,
    required String description,
    List<String>? photoUrls,
    double? lat,
    double? lng,
  }) =>
      _c.post<FaultItem>(
        '/api/resource/faults',
        body: {
          'droneId': droneId,
          'faultType': faultType,
          'description': description,
          'photoUrls': photoUrls,
          'lat': lat,
          'lng': lng,
        },
        parse: (d) => FaultItem.fromJson(_map(d)),
      );

  // ===================== 空域 =====================

  Future<Paged<AirspaceZone>> zones({
    int pageNum = 1,
    int pageSize = 100,
    int? type,
    bool activeOnly = true,
  }) =>
      _c.get<Paged<AirspaceZone>>(
        '/api/airspace/zones',
        query: {
          'pageNum': pageNum,
          'pageSize': pageSize,
          'type': type,
          'activeOnly': activeOnly,
        },
        parse: (d) => Paged.fromJson(_map(d), AirspaceZone.fromJson),
      );

  Future<PositionReportResult> reportPosition({
    required String droneId,
    required double lat,
    required double lng,
    required double altitudeM,
    String? flightPlanId,
  }) =>
      _c.post<PositionReportResult>(
        '/api/airspace/monitoring/positions',
        body: {
          'droneId': droneId,
          'lat': lat,
          'lng': lng,
          'altitudeM': altitudeM,
          'flightPlanId': flightPlanId,
        },
        parse: (d) => PositionReportResult.fromJson(_map(d)),
      );

  // ===================== 应急与客服 =====================

  Future<Paged<EmergencyAlert>> emergencyAlerts({
    int pageNum = 1,
    int pageSize = 20,
    int? level,
    int? status,
    String? keyword,
  }) =>
      _c.get<Paged<EmergencyAlert>>(
        '/api/support/emergency-alerts',
        query: {
          'pageNum': pageNum,
          'pageSize': pageSize,
          'level': level,
          'status': status,
          'keyword': keyword,
        },
        parse: (d) => Paged.fromJson(_map(d), EmergencyAlert.fromJson),
      );

  Future<EmergencyAlert> emergencyAlert(String id) =>
      _c.get<EmergencyAlert>(
        '/api/support/emergency-alerts/$id',
        parse: (d) => EmergencyAlert.fromJson(_map(d)),
      );

  Future<EmergencyAlert> createEmergencyAlert({
    required String title,
    required String content,
    required int level,
    String? source,
    String? relatedId,
  }) =>
      _c.post<EmergencyAlert>(
        '/api/support/emergency-alerts',
        body: {
          'title': title,
          'content': content,
          'level': level,
          'source': source,
          'relatedId': relatedId,
        },
        parse: (d) => EmergencyAlert.fromJson(_map(d)),
      );

  Future<void> progressEmergency(
    String id, {
    required String note,
    int? status,
  }) =>
      _c.post<void>(
        '/api/support/emergency-alerts/$id/progress',
        body: {'note': note, 'status': status},
      );

  Future<void> closeEmergency(String id, {required String result}) =>
      _c.post<void>(
        '/api/support/emergency-alerts/$id/close',
        body: {'result': result},
      );

  Future<Paged<ServiceTicket>> tickets({
    int pageNum = 1,
    int pageSize = 20,
    int? type,
    int? status,
    String? keyword,
  }) =>
      _c.get<Paged<ServiceTicket>>(
        '/api/support/tickets',
        query: {
          'pageNum': pageNum,
          'pageSize': pageSize,
          'type': type,
          'status': status,
          'keyword': keyword,
        },
        parse: (d) => Paged.fromJson(_map(d), ServiceTicket.fromJson),
      );

  Future<ServiceTicket> ticket(String id) => _c.get<ServiceTicket>(
        '/api/support/tickets/$id',
        parse: (d) => ServiceTicket.fromJson(_map(d)),
      );

  Future<ServiceTicket> createTicket({
    required int type,
    required String title,
    required String content,
    String? orderId,
  }) =>
      _c.post<ServiceTicket>(
        '/api/support/tickets',
        body: {
          'type': type,
          'title': title,
          'content': content,
          'orderId': orderId,
        },
        parse: (d) => ServiceTicket.fromJson(_map(d)),
      );

  Future<void> replyTicket(String id, String content) => _c.post<void>(
        '/api/support/tickets/$id/reply',
        body: {'content': content},
      );

  Future<void> rateTicket(String id, int rating, {String? comment}) =>
      _c.post<void>(
        '/api/support/tickets/$id/rate',
        body: {'rating': rating, 'comment': comment},
      );

  Future<Paged<HelpArticle>> helpArticles({
    int pageNum = 1,
    int pageSize = 20,
    String? keyword,
    String? category,
  }) =>
      _c.get<Paged<HelpArticle>>(
        '/api/help/articles',
        query: {
          'pageNum': pageNum,
          'pageSize': pageSize,
          'keyword': keyword,
          'category': category,
        },
        parse: (d) => Paged.fromJson(_map(d), HelpArticle.fromJson),
      );

  Future<HelpArticle> helpArticle(String id) => _c.get<HelpArticle>(
        '/api/help/articles/$id',
        parse: (d) => HelpArticle.fromJson(_map(d)),
      );

  // ===================== 消息通知 =====================

  Future<Paged<NotificationItem>> notifications({
    int pageNum = 1,
    int pageSize = 20,
    bool unreadOnly = false,
  }) =>
      _c.get<Paged<NotificationItem>>(
        '/api/notifications',
        query: {
          'pageNum': pageNum,
          'pageSize': pageSize,
          'unreadOnly': unreadOnly,
        },
        parse: (d) => Paged.fromJson(_map(d), NotificationItem.fromJson),
      );

  Future<void> readNotification(String id) =>
      _c.post<void>('/api/notifications/$id/read');

  Future<void> readAllNotifications() =>
      _c.post<void>('/api/notifications/read-all');

  // ===================== 文件上传 =====================

  Future<String> uploadFile({
    required String filename,
    required List<int> bytes,
  }) =>
      _c.upload<String>(
        '/api/files/upload',
        filename: filename,
        bytes: bytes,
        parse: (d) => (_map(d)['url'] ?? '').toString(),
      );





  // ===================== 第二批：运维（场站/维保/故障处理） =====================

  Future<Paged<Station>> stations({
    int pageNum = 1,
    int pageSize = 20,
    String? keyword,
    int? type,
    int? status,
  }) =>
      _c.get<Paged<Station>>(
        '/api/resource/stations',
        query: {
          'pageNum': pageNum,
          'pageSize': pageSize,
          'keyword': keyword,
          'type': type,
          'status': status,
        },
        parse: (d) => Paged.fromJson(_map(d), Station.fromJson),
      );

  Future<Station> station(String id) => _c.get<Station>(
        '/api/resource/stations/$id',
        parse: (d) => Station.fromJson(_map(d)),
      );

  /// 场站预约列表（后端返回数组，非分页）。
  Future<List<StationReservation>> stationReservations(String stationId) =>
      _c.get<List<StationReservation>>(
        '/api/resource/stations/$stationId/reservations',
        parse: (d) =>
            _maps(d).map((e) => StationReservation.fromJson(e)).toList(),
      );

  Future<void> cancelReservation(String reservationId) =>
      _c.post<void>('/api/resource/reservations/$reservationId/cancel');

  Future<List<MaintenancePlan>> maintenancePlans({String? droneId}) =>
      _c.get<List<MaintenancePlan>>(
        '/api/resource/maintenance/plans',
        query: {'droneId': droneId},
        parse: (d) =>
            _maps(d).map((e) => MaintenancePlan.fromJson(e)).toList(),
      );

  Future<MaintenancePlan> upsertMaintenancePlan({
    required String droneId,
    int? intervalDays,
    int? intervalFlightMinutes,
    bool enabled = true,
    String? remark,
  }) =>
      _c.post<MaintenancePlan>(
        '/api/resource/maintenance/plans',
        body: {
          'droneId': droneId,
          'intervalDays': intervalDays,
          'intervalFlightMinutes': intervalFlightMinutes,
          'enabled': enabled,
          'remark': remark,
        },
        parse: (d) => MaintenancePlan.fromJson(_map(d)),
      );

  /// 维保记录（后端返回数组，非分页；可按飞行器过滤）。
  Future<List<MaintenanceRecord>> maintenanceRecords({String? droneId}) =>
      _c.get<List<MaintenanceRecord>>(
        '/api/resource/maintenance/records',
        query: {'droneId': droneId},
        parse: (d) =>
            _maps(d).map((e) => MaintenanceRecord.fromJson(e)).toList(),
      );

  Future<MaintenanceRecord> createMaintenanceRecord({
    required String droneId,
    String? planId,
    String? crewMemberId,
    required String type,
    required String content,
    DateTime? maintainedAt,
    String? fileUrl,
  }) =>
      _c.post<MaintenanceRecord>(
        '/api/resource/maintenance/records',
        body: {
          'droneId': droneId,
          'planId': planId,
          'crewMemberId': crewMemberId,
          'type': type,
          'content': content,
          'maintainedAt':
              (maintainedAt ?? DateTime.now()).toUtc().toIso8601String(),
          'fileUrl': fileUrl,
        },
        parse: (d) => MaintenanceRecord.fromJson(_map(d)),
      );

  Future<void> handleFault(String faultId, {required String handlerCrewId}) =>
      _c.post<void>('/api/resource/faults/$faultId/handle',
          body: {'handlerCrewId': handlerCrewId});

  Future<void> resolveFault(String faultId, {required String resolution}) =>
      _c.post<void>('/api/resource/faults/$faultId/resolve',
          body: {'resolution': resolution});

  // ===================== 第二批：移动管理员（审批/处置） =====================

  Future<Paged<AdminUserItem>> adminUsers({
    int pageNum = 1,
    int pageSize = 20,
    String? keyword,
    int? status,
    String? roleCode,
  }) =>
      _c.get<Paged<AdminUserItem>>(
        '/api/admin/users',
        query: {
          'pageNum': pageNum,
          'pageSize': pageSize,
          'keyword': keyword,
          'status': status,
          'roleCode': roleCode,
        },
        parse: (d) => Paged.fromJson(_map(d), AdminUserItem.fromJson),
      );

  Future<void> approveUser(String userId) =>
      _c.post<void>('/api/admin/users/$userId/approve');

  Future<void> rejectUser(String userId, {required String reason}) =>
      _c.post<void>('/api/admin/users/$userId/reject', body: {'reason': reason});

  Future<Paged<FlightPlan>> flightPlans({
    int pageNum = 1,
    int pageSize = 20,
    int? status,
    String? keyword,
  }) =>
      _c.get<Paged<FlightPlan>>(
        '/api/airspace/flight-plans',
        query: {
          'pageNum': pageNum,
          'pageSize': pageSize,
          'status': status,
          'keyword': keyword,
        },
        parse: (d) => Paged.fromJson(_map(d), FlightPlan.fromJson),
      );

  Future<FlightPlan> flightPlan(String id) => _c.get<FlightPlan>(
        '/api/airspace/flight-plans/$id',
        parse: (d) => FlightPlan.fromJson(_map(d)),
      );

  Future<ApprovalSuggestion> approvalSuggestion(String planId) =>
      _c.get<ApprovalSuggestion>(
        '/api/airspace/flight-plans/$planId/approval-suggestion',
        parse: (d) => ApprovalSuggestion.fromJson(_map(d)),
      );

  Future<FlightPlan> approveFlightPlan(String planId, {String? comment}) =>
      _c.post<FlightPlan>(
        '/api/airspace/flight-plans/$planId/approve',
        body: {'comment': comment},
        parse: (d) => FlightPlan.fromJson(_map(d)),
      );

  Future<FlightPlan> rejectFlightPlan(String planId, {required String reason}) =>
      _c.post<FlightPlan>(
        '/api/airspace/flight-plans/$planId/reject',
        body: {'reason': reason},
        parse: (d) => FlightPlan.fromJson(_map(d)),
      );

  Future<void> dispatchEmergency(
    String alertId, {
    required List<String> handlers,
    required String plan,
    DateTime? deadlineAt,
  }) =>
      _c.post<void>(
        '/api/support/emergency-alerts/$alertId/dispatch',
        body: {
          'handlers': handlers,
          'plan': plan,
          'deadlineAt': deadlineAt?.toUtc().toIso8601String(),
        },
      );
}
final apiServiceProvider =
    Provider<DubheApi>((ref) => DubheApi(ref.watch(apiProvider)));
