/// 与后端 DTO 对齐的数据模型（字段名使用后端 camelCase JSON）。
library;

// ===================== 通用 =====================

class Paged<T> {
  Paged({
    required this.items,
    required this.total,
    required this.pageNum,
    required this.pageSize,
  });

  final List<T> items;
  final int total;
  final int pageNum;
  final int pageSize;

  static Paged<T> fromJson<T>(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) parse,
  ) {
    final raw = (json['items'] as List?) ?? const [];
    return Paged<T>(
      items: raw
          .whereType<Map>()
          .map((e) => parse(Map<String, dynamic>.from(e)))
          .toList(),
      total: _int(json['total']),
      pageNum: _int(json['pageNum'], 1),
      pageSize: _int(json['pageSize'], 20),
    );
  }

  static Paged<T> empty<T>() =>
      Paged<T>(items: const [], total: 0, pageNum: 1, pageSize: 20);
}

int _int(Object? v, [int fallback = 0]) {
  if (v == null) return fallback;
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString()) ?? fallback;
}

double _double(Object? v, [double fallback = 0]) {
  if (v == null) return fallback;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString()) ?? fallback;
}

bool _bool(Object? v, [bool fallback = false]) {
  if (v == null) return fallback;
  if (v is bool) return v;
  final s = v.toString().toLowerCase();
  if (s == 'true' || s == '1') return true;
  if (s == 'false' || s == '0') return false;
  return fallback;
}

String? _str(Object? v) {
  if (v == null) return null;
  final s = v.toString();
  return s.isEmpty ? null : s;
}

List<String> _strList(Object? v) {
  if (v is List) return v.map((e) => e.toString()).toList();
  return const [];
}

// ===================== 账号 =====================

class AuthUser {
  AuthUser({
    required this.id,
    required this.username,
    required this.displayName,
    required this.phone,
    this.email,
    required this.userType,
    required this.status,
    this.companyName,
    required this.roles,
    this.permissions,
  });

  final String id;
  final String username;
  final String displayName;
  final String phone;
  final String? email;
  final String userType;
  final String status;
  final String? companyName;
  final List<String> roles;
  final List<String>? permissions;

  bool get isAdmin => roles.contains('Admin');

  factory AuthUser.fromJson(Map<String, dynamic> j) => AuthUser(
        id: j['id'].toString(),
        username: j['username']?.toString() ?? '',
        displayName: j['displayName']?.toString() ?? '',
        phone: j['phone']?.toString() ?? '',
        email: _str(j['email']),
        userType: j['userType']?.toString() ?? 'IndividualCustomer',
        status: j['status']?.toString() ?? 'Active',
        companyName: _str(j['companyName']),
        roles: _strList(j['roles']),
        permissions:
            j['permissions'] == null ? null : _strList(j['permissions']),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'username': username,
        'displayName': displayName,
        'phone': phone,
        'email': email,
        'userType': userType,
        'status': status,
        'companyName': companyName,
        'roles': roles,
        'permissions': permissions,
      };
}

class AuthResult {
  AuthResult({
    required this.accessToken,
    required this.refreshToken,
    required this.accessTokenExpiresAt,
    required this.refreshTokenExpiresAt,
    required this.user,
  });

  final String accessToken;
  final String refreshToken;
  final DateTime? accessTokenExpiresAt;
  final DateTime? refreshTokenExpiresAt;
  final AuthUser user;

  factory AuthResult.fromJson(Map<String, dynamic> j) => AuthResult(
        accessToken: j['accessToken']?.toString() ?? '',
        refreshToken: j['refreshToken']?.toString() ?? '',
        accessTokenExpiresAt: DateTime.tryParse(
            j['accessTokenExpiresAt']?.toString() ?? ''),
        refreshTokenExpiresAt: DateTime.tryParse(
            j['refreshTokenExpiresAt']?.toString() ?? ''),
        user: AuthUser.fromJson(
            Map<String, dynamic>.from(j['user'] as Map? ?? const {})),
      );
}

class MerchantOption {
  MerchantOption({
    required this.id,
    required this.displayName,
    this.companyName,
    this.serviceAreas = const [],
  });

  final String id;
  final String displayName;
  final String? companyName;
  final List<ServiceArea> serviceAreas;

  String get title => companyName ?? displayName;

  factory MerchantOption.fromJson(Map<String, dynamic> j) => MerchantOption(
        id: j['id'].toString(),
        displayName: j['displayName']?.toString() ?? '',
        companyName: _str(j['companyName']),
        serviceAreas: ((j['serviceAreas'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => ServiceArea.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
      );
}

class ServiceArea {
  ServiceArea({
    required this.id,
    required this.merchantId,
    required this.name,
    required this.centerLat,
    required this.centerLng,
    required this.radiusKm,
    required this.isActive,
  });

  final String id;
  final String merchantId;
  final String name;
  final double centerLat;
  final double centerLng;
  final double radiusKm;
  final bool isActive;

  factory ServiceArea.fromJson(Map<String, dynamic> j) => ServiceArea(
        id: j['id'].toString(),
        merchantId: j['merchantId'].toString(),
        name: j['name']?.toString() ?? '',
        centerLat: _double(j['centerLat']),
        centerLng: _double(j['centerLng']),
        radiusKm: _double(j['radiusKm']),
        isActive: _bool(j['isActive'], true),
      );
}

// ===================== 订单 =====================

class Waypoint {
  const Waypoint(this.lat, this.lng);

  final double lat;
  final double lng;

  factory Waypoint.fromJson(Map<String, dynamic> j) =>
      Waypoint(_double(j['lat']), _double(j['lng']));

  Map<String, dynamic> toJson() => {'lat': lat, 'lng': lng};
}

class FeeBreakdown {
  FeeBreakdown({
    required this.distanceKm,
    required this.baseFee,
    required this.distanceFee,
    required this.weightFee,
    required this.airspaceFee,
    required this.urgentFee,
    required this.discountAmount,
    required this.totalAmount,
  });

  final double distanceKm;
  final double baseFee;
  final double distanceFee;
  final double weightFee;
  final double airspaceFee;
  final double urgentFee;
  final double discountAmount;
  final double totalAmount;

  factory FeeBreakdown.fromJson(Map<String, dynamic> j) => FeeBreakdown(
        distanceKm: _double(j['distanceKm']),
        baseFee: _double(j['baseFee']),
        distanceFee: _double(j['distanceFee']),
        weightFee: _double(j['weightFee']),
        airspaceFee: _double(j['airspaceFee']),
        urgentFee: _double(j['urgentFee']),
        discountAmount: _double(j['discountAmount']),
        totalAmount: _double(j['totalAmount']),
      );
}

class OrderEstimate {
  OrderEstimate({required this.distanceKm, required this.fee, required this.serviceAreaChecked});

  final double distanceKm;
  final FeeBreakdown fee;
  final bool serviceAreaChecked;

  factory OrderEstimate.fromJson(Map<String, dynamic> j) => OrderEstimate(
        distanceKm: _double(j['distanceKm']),
        serviceAreaChecked: _bool(j['serviceAreaChecked'], true),
        fee: FeeBreakdown.fromJson(
            Map<String, dynamic>.from(j['fee'] as Map? ?? const {})),
      );
}

class OrderListItem {
  OrderListItem({
    required this.id,
    required this.orderNo,
    required this.status,
    required this.merchantId,
    this.merchantName,
    required this.receiverName,
    required this.receiverAddress,
    required this.itemName,
    required this.weightKg,
    required this.isUrgent,
    required this.totalAmount,
    this.droneId,
    this.createdAt,
    this.deliveredAt,
  });

  final String id;
  final String orderNo;
  final String status;
  final String merchantId;
  final String? merchantName;
  final String receiverName;
  final String receiverAddress;
  final String itemName;
  final double weightKg;
  final bool isUrgent;
  final double totalAmount;
  final String? droneId;
  final DateTime? createdAt;
  final DateTime? deliveredAt;

  factory OrderListItem.fromJson(Map<String, dynamic> j) => OrderListItem(
        id: j['id'].toString(),
        orderNo: j['orderNo']?.toString() ?? '',
        status: j['status']?.toString() ?? '',
        merchantId: j['merchantId'].toString(),
        merchantName: _str(j['merchantName']),
        receiverName: j['receiverName']?.toString() ?? '',
        receiverAddress: j['receiverAddress']?.toString() ?? '',
        itemName: j['itemName']?.toString() ?? '',
        weightKg: _double(j['weightKg']),
        isUrgent: _bool(j['isUrgent']),
        totalAmount: _double(j['totalAmount']),
        droneId: _str(j['droneId']),
        createdAt: DateTime.tryParse(j['createdAt']?.toString() ?? ''),
        deliveredAt: DateTime.tryParse(j['deliveredAt']?.toString() ?? ''),
      );
}

class OrderHistoryItem {
  OrderHistoryItem({this.fromStatus, required this.toStatus, this.remark, this.at});

  final String? fromStatus;
  final String toStatus;
  final String? remark;
  final DateTime? at;

  factory OrderHistoryItem.fromJson(Map<String, dynamic> j) => OrderHistoryItem(
        fromStatus: _str(j['fromStatus']),
        toStatus: j['toStatus']?.toString() ?? '',
        remark: _str(j['remark']),
        at: DateTime.tryParse(j['at']?.toString() ?? ''),
      );
}

class OrderParty {
  OrderParty({
    required this.name,
    required this.phone,
    required this.address,
    required this.lat,
    required this.lng,
  });

  final String name;
  final String phone;
  final String address;
  final double lat;
  final double lng;

  factory OrderParty.fromJson(Map<String, dynamic> j) => OrderParty(
        name: j['name']?.toString() ?? '',
        phone: j['phone']?.toString() ?? '',
        address: j['address']?.toString() ?? '',
        lat: _double(j['lat']),
        lng: _double(j['lng']),
      );

  Map<String, dynamic> toJson() =>
      {'name': name, 'phone': phone, 'address': address, 'lat': lat, 'lng': lng};
}

class OrderDetail {
  OrderDetail({
    required this.id,
    required this.orderNo,
    required this.status,
    required this.merchantId,
    this.merchantName,
    this.customerId = '',
    this.customerName,
    required this.sender,
    required this.receiver,
    required this.itemCategory,
    required this.itemName,
    required this.weightKg,
    required this.volumeM3,
    required this.quantity,
    required this.isUrgent,
    this.remark,
    this.scheduledAt,
    required this.fee,
    this.droneId,
    this.pilotId,
    this.dispatchedAt,
    this.plannedRoute = const [],
    this.dispatchRemark,
    this.acceptedAt,
    this.inFlightAt,
    this.deliveredAt,
    this.cancelReason,
    this.cancelledAt,
    this.rating,
    this.reviewComment,
    this.reviewedAt,
    this.createdAt,
    required this.history,
    required this.paymentStatus,
    this.paidAt,
  });

  final String id;
  final String orderNo;
  final String status;
  final String merchantId;
  final String? merchantName;
  final String customerId;
  final String? customerName;
  final OrderParty sender;
  final OrderParty receiver;
  final String itemCategory;
  final String itemName;
  final double weightKg;
  final double volumeM3;
  final int quantity;
  final bool isUrgent;
  final String? remark;
  final DateTime? scheduledAt;
  final FeeBreakdown fee;
  final String? droneId;
  final String? pilotId;
  final DateTime? dispatchedAt;
  final List<Waypoint> plannedRoute;
  final String? dispatchRemark;
  final DateTime? acceptedAt;
  final DateTime? inFlightAt;
  final DateTime? deliveredAt;
  final String? cancelReason;
  final DateTime? cancelledAt;
  final int? rating;
  final String? reviewComment;
  final DateTime? reviewedAt;
  final DateTime? createdAt;
  final List<OrderHistoryItem> history;
  final String paymentStatus;
  final DateTime? paidAt;

  bool get isUnpaid => paymentStatus == 'Unpaid';
  bool get isActive => status == 'PendingAccept' || status == 'PendingDispatch' || status == 'InFlight';

  factory OrderDetail.fromJson(Map<String, dynamic> j) => OrderDetail(
        id: j['id'].toString(),
        orderNo: j['orderNo']?.toString() ?? '',
        status: j['status']?.toString() ?? '',
        merchantId: j['merchantId'].toString(),
        merchantName: _str(j['merchantName']),
        customerId: j['customerId']?.toString() ?? '',
        customerName: _str(j['customerName']),
        sender: OrderParty.fromJson(
            Map<String, dynamic>.from(j['sender'] as Map? ?? const {})),
        receiver: OrderParty.fromJson(
            Map<String, dynamic>.from(j['receiver'] as Map? ?? const {})),
        itemCategory: j['itemCategory']?.toString() ?? '',
        itemName: j['itemName']?.toString() ?? '',
        weightKg: _double(j['weightKg']),
        volumeM3: _double(j['volumeM3']),
        quantity: _int(j['quantity'], 1),
        isUrgent: _bool(j['isUrgent']),
        remark: _str(j['remark']),
        scheduledAt: DateTime.tryParse(j['scheduledAt']?.toString() ?? ''),
        fee: FeeBreakdown.fromJson(
            Map<String, dynamic>.from(j['fee'] as Map? ?? const {})),
        droneId: _str(j['droneId']),
        pilotId: _str(j['pilotId']),
        dispatchedAt: DateTime.tryParse(j['dispatchedAt']?.toString() ?? ''),
        plannedRoute: ((j['plannedRoute'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => Waypoint.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
        dispatchRemark: _str(j['dispatchRemark']),
        acceptedAt: DateTime.tryParse(j['acceptedAt']?.toString() ?? ''),
        inFlightAt: DateTime.tryParse(j['inFlightAt']?.toString() ?? ''),
        deliveredAt: DateTime.tryParse(j['deliveredAt']?.toString() ?? ''),
        cancelReason: _str(j['cancelReason']),
        cancelledAt: DateTime.tryParse(j['cancelledAt']?.toString() ?? ''),
        rating: j['rating'] == null ? null : _int(j['rating']),
        reviewComment: _str(j['reviewComment']),
        reviewedAt: DateTime.tryParse(j['reviewedAt']?.toString() ?? ''),
        createdAt: DateTime.tryParse(j['createdAt']?.toString() ?? ''),
        history: ((j['history'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => OrderHistoryItem.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
        paymentStatus: j['paymentStatus']?.toString() ?? 'Unpaid',
        paidAt: DateTime.tryParse(j['paidAt']?.toString() ?? ''),
      );
}

class PaymentRecord {
  PaymentRecord({
    required this.id,
    required this.method,
    required this.amount,
    required this.status,
    this.transactionNo,
    this.failureReason,
    this.paidAt,
    this.refundedAt,
    this.refundReason,
    this.createdAt,
  });

  final String id;
  final String method;
  final double amount;
  final String status;
  final String? transactionNo;
  final String? failureReason;
  final DateTime? paidAt;
  final DateTime? refundedAt;
  final String? refundReason;
  final DateTime? createdAt;

  factory PaymentRecord.fromJson(Map<String, dynamic> j) => PaymentRecord(
        id: j['id'].toString(),
        method: j['method']?.toString() ?? '',
        amount: _double(j['amount']),
        status: j['status']?.toString() ?? '',
        transactionNo: _str(j['transactionNo']),
        failureReason: _str(j['failureReason']),
        paidAt: DateTime.tryParse(j['paidAt']?.toString() ?? ''),
        refundedAt: DateTime.tryParse(j['refundedAt']?.toString() ?? ''),
        refundReason: _str(j['refundReason']),
        createdAt: DateTime.tryParse(j['createdAt']?.toString() ?? ''),
      );
}

class InvoiceItem {
  InvoiceItem({
    required this.id,
    required this.title,
    required this.taxNo,
    required this.amount,
    required this.status,
    this.orderIds = const [],
    this.invoiceNo,
    this.fileUrl,
    this.rejectedReason,
    this.createdAt,
  });

  final String id;
  final String title;
  final String taxNo;
  final double amount;
  final String status;
  final List<String> orderIds;
  final String? invoiceNo;
  final String? fileUrl;
  final String? rejectedReason;
  final DateTime? createdAt;

  factory InvoiceItem.fromJson(Map<String, dynamic> j) => InvoiceItem(
        id: j['id'].toString(),
        title: j['title']?.toString() ?? '',
        taxNo: j['taxNo']?.toString() ?? '',
        amount: _double(j['amount']),
        status: j['status']?.toString() ?? '',
        orderIds: _strList(j['orderIds']),
        invoiceNo: _str(j['invoiceNo']),
        fileUrl: _str(j['fileUrl']),
        rejectedReason: _str(j['rejectedReason']),
        createdAt: DateTime.tryParse(j['createdAt']?.toString() ?? ''),
      );
}

// ===================== 低空资源 =====================

class Drone {
  Drone({
    required this.id,
    required this.merchantId,
    required this.serialNo,
    required this.model,
    required this.status,
    required this.maxPayloadKg,
    required this.enduranceMinutes,
    required this.batteryPercent,
    required this.cumulativeFlightMinutes,
    required this.healthScore,
    this.lastMaintainedAt,
  });

  final String id;
  final String merchantId;
  final String serialNo;
  final String model;
  final String status;
  final double maxPayloadKg;
  final int enduranceMinutes;
  final int batteryPercent;
  final int cumulativeFlightMinutes;
  final int healthScore;
  final DateTime? lastMaintainedAt;

  factory Drone.fromJson(Map<String, dynamic> j) => Drone(
        id: j['id'].toString(),
        merchantId: j['merchantId'].toString(),
        serialNo: j['serialNo']?.toString() ?? '',
        model: j['model']?.toString() ?? '',
        status: j['status']?.toString() ?? 'Offline',
        maxPayloadKg: _double(j['maxPayloadKg']),
        enduranceMinutes: _int(j['enduranceMinutes']),
        batteryPercent: _int(j['batteryPercent']),
        cumulativeFlightMinutes: _int(j['cumulativeFlightMinutes']),
        healthScore: _int(j['healthScore'], 100),
        lastMaintainedAt:
            DateTime.tryParse(j['lastMaintainedAt']?.toString() ?? ''),
      );
}

class FaultItem {
  FaultItem({
    required this.id,
    required this.merchantId,
    required this.droneId,
    required this.faultType,
    required this.description,
    this.photoUrls = const [],
    this.lat,
    this.lng,
    required this.status,
    this.handlerCrewId,
    this.resolution,
    this.reportedBy,
    this.reportedAt,
    this.resolvedAt,
  });

  final String id;
  final String merchantId;
  final String droneId;
  final String faultType;
  final String description;
  final List<String> photoUrls;
  final double? lat;
  final double? lng;
  final String status;
  final String? handlerCrewId;
  final String? resolution;
  final String? reportedBy;
  final DateTime? reportedAt;
  final DateTime? resolvedAt;

  factory FaultItem.fromJson(Map<String, dynamic> j) => FaultItem(
        id: j['id'].toString(),
        merchantId: j['merchantId'].toString(),
        droneId: j['droneId'].toString(),
        faultType: j['faultType']?.toString() ?? '',
        description: j['description']?.toString() ?? '',
        photoUrls: _strList(j['photoUrls']),
        lat: j['lat'] == null ? null : _double(j['lat']),
        lng: j['lng'] == null ? null : _double(j['lng']),
        status: j['status']?.toString() ?? 'Reported',
        handlerCrewId: _str(j['handlerCrewId']),
        resolution: _str(j['resolution']),
        reportedBy: _str(j['reportedBy']),
        reportedAt: DateTime.tryParse(j['reportedAt']?.toString() ?? ''),
        resolvedAt: DateTime.tryParse(j['resolvedAt']?.toString() ?? ''),
      );
}

// ===================== 空域 =====================

class AirspaceZone {
  AirspaceZone({
    required this.id,
    required this.code,
    required this.name,
    required this.type,
    this.source,
    this.merchantId,
    required this.centerLat,
    required this.centerLng,
    required this.radiusKm,
    this.minAltitudeM,
    this.maxAltitudeM,
    this.effectiveFrom,
    this.effectiveTo,
    this.reason,
    required this.isActive,
  });

  final String id;
  final String code;
  final String name;
  final String type;
  final String? source;
  final String? merchantId;
  final double centerLat;
  final double centerLng;
  final double radiusKm;
  final double? minAltitudeM;
  final double? maxAltitudeM;
  final DateTime? effectiveFrom;
  final DateTime? effectiveTo;
  final String? reason;
  final bool isActive;

  factory AirspaceZone.fromJson(Map<String, dynamic> j) => AirspaceZone(
        id: j['id'].toString(),
        code: j['code']?.toString() ?? '',
        name: j['name']?.toString() ?? '',
        type: j['type']?.toString() ?? 'NoFly',
        source: _str(j['source']),
        merchantId: _str(j['merchantId']),
        centerLat: _double(j['centerLat']),
        centerLng: _double(j['centerLng']),
        radiusKm: _double(j['radiusKm']),
        minAltitudeM:
            j['minAltitudeM'] == null ? null : _double(j['minAltitudeM']),
        maxAltitudeM:
            j['maxAltitudeM'] == null ? null : _double(j['maxAltitudeM']),
        effectiveFrom: DateTime.tryParse(j['effectiveFrom']?.toString() ?? ''),
        effectiveTo: DateTime.tryParse(j['effectiveTo']?.toString() ?? ''),
        reason: _str(j['reason']),
        isActive: _bool(j['isActive'], true),
      );
}

class ViolationItem {
  ViolationItem({
    required this.id,
    this.orderId,
    this.droneId,
    required this.type,
    required this.description,
    this.lat,
    this.lng,
    this.altitudeM,
    required this.status,
    this.resolution,
    this.occurredAt,
  });

  final String id;
  final String? orderId;
  final String? droneId;
  final String type;
  final String description;
  final double? lat;
  final double? lng;
  final double? altitudeM;
  final String status;
  final String? resolution;
  final DateTime? occurredAt;

  factory ViolationItem.fromJson(Map<String, dynamic> j) => ViolationItem(
        id: j['id'].toString(),
        orderId: _str(j['orderId']),
        droneId: _str(j['droneId']),
        type: j['type']?.toString() ?? '',
        description: j['description']?.toString() ?? '',
        lat: j['lat'] == null ? null : _double(j['lat']),
        lng: j['lng'] == null ? null : _double(j['lng']),
        altitudeM: j['altitudeM'] == null ? null : _double(j['altitudeM']),
        status: j['status']?.toString() ?? 'Open',
        resolution: _str(j['resolution']),
        occurredAt: DateTime.tryParse(j['occurredAt']?.toString() ?? ''),
      );
}

class PositionReportResult {
  PositionReportResult({required this.detectedViolations, this.distanceToRouteKm});

  final List<ViolationItem> detectedViolations;
  final double? distanceToRouteKm;

  factory PositionReportResult.fromJson(Map<String, dynamic> j) =>
      PositionReportResult(
        detectedViolations: ((j['detectedViolations'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => ViolationItem.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
        distanceToRouteKm: j['distanceToRouteKm'] == null
            ? null
            : _double(j['distanceToRouteKm']),
      );
}

// ===================== 应急与客服 =====================

class EmergencyTimelineItem {
  EmergencyTimelineItem({
    required this.id,
    required this.action,
    this.note,
    this.attachments = const [],
    this.at,
  });

  final String id;
  final String action;
  final String? note;
  final List<String> attachments;
  final DateTime? at;

  factory EmergencyTimelineItem.fromJson(Map<String, dynamic> j) =>
      EmergencyTimelineItem(
        id: j['id'].toString(),
        action: j['action']?.toString() ?? '',
        note: _str(j['note']),
        attachments: _strList(j['attachments']),
        at: DateTime.tryParse(j['at']?.toString() ?? ''),
      );
}

class EmergencyAlert {
  EmergencyAlert({
    required this.id,
    required this.title,
    required this.content,
    required this.level,
    required this.status,
    this.source,
    this.relatedId,
    this.merchantId,
    this.handlers = const [],
    this.disposalPlan,
    this.deadlineAt,
    this.result,
    this.closedAt,
    this.reportedAt,
    this.createdAt,
    this.timeline = const [],
  });

  final String id;
  final String title;
  final String content;
  final String level;
  final String status;
  final String? source;
  final String? relatedId;
  final String? merchantId;
  final List<String> handlers;
  final String? disposalPlan;
  final DateTime? deadlineAt;
  final String? result;
  final DateTime? closedAt;
  final DateTime? reportedAt;
  final DateTime? createdAt;
  final List<EmergencyTimelineItem> timeline;

  bool get isOpen => status == 'Open' || status == 'Handling';

  factory EmergencyAlert.fromJson(Map<String, dynamic> j) => EmergencyAlert(
        id: j['id'].toString(),
        title: j['title']?.toString() ?? '',
        content: j['content']?.toString() ?? '',
        level: j['level']?.toString() ?? 'Normal',
        status: j['status']?.toString() ?? 'Open',
        source: _str(j['source']),
        relatedId: _str(j['relatedId']),
        merchantId: _str(j['merchantId']),
        handlers: _strList(j['handlers']),
        disposalPlan: _str(j['disposalPlan']),
        deadlineAt: DateTime.tryParse(j['deadlineAt']?.toString() ?? ''),
        result: _str(j['result']),
        closedAt: DateTime.tryParse(j['closedAt']?.toString() ?? ''),
        reportedAt: DateTime.tryParse(j['reportedAt']?.toString() ?? ''),
        createdAt: DateTime.tryParse(j['createdAt']?.toString() ?? ''),
        timeline: ((j['timeline'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) =>
                EmergencyTimelineItem.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
      );
}

class TicketReply {
  TicketReply({
    required this.id,
    required this.userId,
    required this.content,
    required this.isStaff,
    this.at,
  });

  final String id;
  final String userId;
  final String content;
  final bool isStaff;
  final DateTime? at;

  factory TicketReply.fromJson(Map<String, dynamic> j) => TicketReply(
        id: j['id'].toString(),
        userId: j['userId'].toString(),
        content: j['content']?.toString() ?? '',
        isStaff: _bool(j['isStaff']),
        at: DateTime.tryParse(j['at']?.toString() ?? ''),
      );
}

class ServiceTicket {
  ServiceTicket({
    required this.id,
    required this.ticketNo,
    required this.type,
    required this.status,
    required this.title,
    required this.content,
    this.orderId,
    this.assigneeUserId,
    this.completedAt,
    this.closedAt,
    this.satisfactionRating,
    this.satisfactionComment,
    this.createdAt,
    this.replies = const [],
  });

  final String id;
  final String ticketNo;
  final String type;
  final String status;
  final String title;
  final String content;
  final String? orderId;
  final String? assigneeUserId;
  final DateTime? completedAt;
  final DateTime? closedAt;
  final int? satisfactionRating;
  final String? satisfactionComment;
  final DateTime? createdAt;
  final List<TicketReply> replies;

  factory ServiceTicket.fromJson(Map<String, dynamic> j) => ServiceTicket(
        id: j['id'].toString(),
        ticketNo: j['ticketNo']?.toString() ?? '',
        type: j['type']?.toString() ?? 'Consult',
        status: j['status']?.toString() ?? 'Pending',
        title: j['title']?.toString() ?? '',
        content: j['content']?.toString() ?? '',
        orderId: _str(j['orderId']),
        assigneeUserId: _str(j['assigneeUserId']),
        completedAt: DateTime.tryParse(j['completedAt']?.toString() ?? ''),
        closedAt: DateTime.tryParse(j['closedAt']?.toString() ?? ''),
        satisfactionRating:
            j['satisfactionRating'] == null ? null : _int(j['satisfactionRating']),
        satisfactionComment: _str(j['satisfactionComment']),
        createdAt: DateTime.tryParse(j['createdAt']?.toString() ?? ''),
        replies: ((j['replies'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => TicketReply.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
      );
}

class HelpArticle {
  HelpArticle({
    required this.id,
    required this.title,
    required this.category,
    this.tags,
    required this.contentType,
    this.videoUrl,
    required this.content,
    required this.viewCount,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String title;
  final String category;
  final String? tags;
  final String contentType;
  final String? videoUrl;
  final String content;
  final int viewCount;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory HelpArticle.fromJson(Map<String, dynamic> j) => HelpArticle(
        id: j['id'].toString(),
        title: j['title']?.toString() ?? '',
        category: j['category']?.toString() ?? '',
        tags: _str(j['tags']),
        contentType: j['contentType']?.toString() ?? 'Article',
        videoUrl: _str(j['videoUrl']),
        content: j['content']?.toString() ?? '',
        viewCount: _int(j['viewCount']),
        createdAt: DateTime.tryParse(j['createdAt']?.toString() ?? ''),
        updatedAt: DateTime.tryParse(j['updatedAt']?.toString() ?? ''),
      );
}

class NotificationItem {
  NotificationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.content,
    this.relatedId,
    required this.isRead,
    this.createdAt,
  });

  final String id;
  final String type;
  final String title;
  final String content;
  final String? relatedId;
  final bool isRead;
  final DateTime? createdAt;

  factory NotificationItem.fromJson(Map<String, dynamic> j) => NotificationItem(
        id: j['id'].toString(),
        type: j['type']?.toString() ?? 'System',
        title: j['title']?.toString() ?? '',
        content: j['content']?.toString() ?? '',
        relatedId: _str(j['relatedId']),
        isRead: _bool(j['isRead']),
        createdAt: DateTime.tryParse(j['createdAt']?.toString() ?? ''),
      );
}

class MetaContext {
  MetaContext({required this.apiVersion, required this.deviceType, required this.serverTime});

  final String apiVersion;
  final String deviceType;
  final DateTime? serverTime;

  factory MetaContext.fromJson(Map<String, dynamic> j) => MetaContext(
        apiVersion: j['apiVersion']?.toString() ?? '',
        deviceType: j['deviceType']?.toString() ?? '',
        serverTime: DateTime.tryParse(j['serverTime']?.toString() ?? ''),
      );
}


// ===================== 第二批：场站 / 维保 / 飞行计划 / 管理端 =====================

class Station {
  Station({
    required this.id,
    required this.merchantId,
    required this.name,
    required this.type,
    required this.address,
    required this.lat,
    required this.lng,
    required this.capacity,
    required this.chargerCount,
    required this.status,
    this.remark,
  });

  final String id;
  final String merchantId;
  final String name;
  final String type;
  final String address;
  final double lat;
  final double lng;
  final int capacity;
  final int chargerCount;
  final String status;
  final String? remark;

  factory Station.fromJson(Map<String, dynamic> j) => Station(
        id: j['id'].toString(),
        merchantId: j['merchantId'].toString(),
        name: j['name']?.toString() ?? '',
        type: j['type']?.toString() ?? 'TakeoffLanding',
        address: j['address']?.toString() ?? '',
        lat: _double(j['lat']),
        lng: _double(j['lng']),
        capacity: _int(j['capacity']),
        chargerCount: _int(j['chargerCount']),
        status: j['status']?.toString() ?? 'Idle',
        remark: _str(j['remark']),
      );
}

class StationReservation {
  StationReservation({
    required this.id,
    required this.stationId,
    this.orderId,
    required this.startAt,
    required this.endAt,
    required this.purpose,
    required this.status,
    this.remark,
    this.createdAt,
  });

  final String id;
  final String stationId;
  final String? orderId;
  final DateTime? startAt;
  final DateTime? endAt;
  final String purpose;
  final String status;
  final String? remark;
  final DateTime? createdAt;

  factory StationReservation.fromJson(Map<String, dynamic> j) =>
      StationReservation(
        id: j['id'].toString(),
        stationId: j['stationId'].toString(),
        orderId: _str(j['orderId']),
        startAt: DateTime.tryParse(j['startAt']?.toString() ?? ''),
        endAt: DateTime.tryParse(j['endAt']?.toString() ?? ''),
        purpose: j['purpose']?.toString() ?? 'Other',
        status: j['status']?.toString() ?? 'Reserved',
        remark: _str(j['remark']),
        createdAt: DateTime.tryParse(j['createdAt']?.toString() ?? ''),
      );
}

class MaintenancePlan {
  MaintenancePlan({
    required this.id,
    required this.droneId,
    required this.droneSerialNo,
    required this.enabled,
    this.intervalDays,
    this.intervalFlightMinutes,
    this.lastMaintainedAt,
    this.nextDueAt,
    this.nextDueFlightMinutes,
    required this.status,
    this.remark,
  });

  final String id;
  final String droneId;
  final String droneSerialNo;
  final bool enabled;
  final int? intervalDays;
  final int? intervalFlightMinutes;
  final DateTime? lastMaintainedAt;
  final DateTime? nextDueAt;
  final int? nextDueFlightMinutes;
  final String status;
  final String? remark;

  bool get isDueSoon => status == 'DueSoon' || status == 'Overdue';

  factory MaintenancePlan.fromJson(Map<String, dynamic> j) => MaintenancePlan(
        id: j['id'].toString(),
        droneId: j['droneId'].toString(),
        droneSerialNo: j['droneSerialNo']?.toString() ?? '',
        enabled: _bool(j['enabled'], true),
        intervalDays: j['intervalDays'] == null ? null : _int(j['intervalDays']),
        intervalFlightMinutes: j['intervalFlightMinutes'] == null
            ? null
            : _int(j['intervalFlightMinutes']),
        lastMaintainedAt:
            DateTime.tryParse(j['lastMaintainedAt']?.toString() ?? ''),
        nextDueAt: DateTime.tryParse(j['nextDueAt']?.toString() ?? ''),
        nextDueFlightMinutes: j['nextDueFlightMinutes'] == null
            ? null
            : _int(j['nextDueFlightMinutes']),
        status: j['status']?.toString() ?? 'Normal',
        remark: _str(j['remark']),
      );
}

class MaintenanceRecord {
  MaintenanceRecord({
    required this.id,
    required this.droneId,
    this.planId,
    this.crewMemberId,
    required this.type,
    required this.content,
    this.maintainedAt,
    this.fileUrl,
  });

  final String id;
  final String droneId;
  final String? planId;
  final String? crewMemberId;
  final String type;
  final String content;
  final DateTime? maintainedAt;
  final String? fileUrl;

  factory MaintenanceRecord.fromJson(Map<String, dynamic> j) =>
      MaintenanceRecord(
        id: j['id'].toString(),
        droneId: j['droneId'].toString(),
        planId: _str(j['planId']),
        crewMemberId: _str(j['crewMemberId']),
        type: j['type']?.toString() ?? '',
        content: j['content']?.toString() ?? '',
        maintainedAt: DateTime.tryParse(j['maintainedAt']?.toString() ?? ''),
        fileUrl: _str(j['fileUrl']),
      );
}

class FlightPlan {
  FlightPlan({
    required this.id,
    this.planNo,
    required this.merchantId,
    this.orderId,
    required this.droneId,
    this.droneSerialNo,
    this.pilotName,
    required this.purpose,
    this.startAt,
    this.endAt,
    this.maxAltitudeM,
    this.waypoints = const [],
    required this.status,
    this.submittedAt,
    this.approvalComment,
    this.rejectReason,
    this.createdAt,
  });

  final String id;
  final String? planNo;
  final String merchantId;
  final String? orderId;
  final String droneId;
  final String? droneSerialNo;
  final String? pilotName;
  final String purpose;
  final DateTime? startAt;
  final DateTime? endAt;
  final double? maxAltitudeM;
  final List<Waypoint> waypoints;
  final String status;
  final DateTime? submittedAt;
  final String? approvalComment;
  final String? rejectReason;
  final DateTime? createdAt;

  factory FlightPlan.fromJson(Map<String, dynamic> j) => FlightPlan(
        id: j['id'].toString(),
        planNo: _str(j['planNo']),
        merchantId: j['merchantId'].toString(),
        orderId: _str(j['orderId']),
        droneId: j['droneId'].toString(),
        droneSerialNo: _str(j['droneSerialNo']),
        pilotName: _str(j['pilotName']),
        purpose: j['purpose']?.toString() ?? '',
        startAt: DateTime.tryParse(j['startAt']?.toString() ?? ''),
        endAt: DateTime.tryParse(j['endAt']?.toString() ?? ''),
        maxAltitudeM:
            j['maxAltitudeM'] == null ? null : _double(j['maxAltitudeM']),
        waypoints: ((j['waypoints'] as List?) ?? const [])
            .whereType<Map>()
            .map((e) => Waypoint.fromJson(Map<String, dynamic>.from(e)))
            .toList(),
        status: j['status']?.toString() ?? 'Draft',
        submittedAt: DateTime.tryParse(j['submittedAt']?.toString() ?? ''),
        approvalComment: _str(j['approvalComment']),
        rejectReason: _str(j['rejectReason']),
        createdAt: DateTime.tryParse(j['createdAt']?.toString() ?? ''),
      );
}

class ApprovalSuggestion {
  ApprovalSuggestion({required this.suggestion, this.reasons = const []});

  final String suggestion;
  final List<String> reasons;

  factory ApprovalSuggestion.fromJson(Map<String, dynamic> j) =>
      ApprovalSuggestion(
        suggestion: j['suggestion']?.toString() ?? '',
        reasons: _strList(j['reasons']),
      );
}

class AdminUserItem {
  AdminUserItem({
    required this.id,
    required this.username,
    required this.phone,
    required this.displayName,
    required this.userType,
    required this.status,
    this.roles = const [],
    this.companyName,
    this.createdAt,
  });

  final String id;
  final String username;
  final String phone;
  final String displayName;
  final String userType;
  final String status;
  final List<String> roles;
  final String? companyName;
  final DateTime? createdAt;

  factory AdminUserItem.fromJson(Map<String, dynamic> j) => AdminUserItem(
        id: j['id'].toString(),
        username: j['username']?.toString() ?? '',
        phone: j['phone']?.toString() ?? '',
        displayName: j['displayName']?.toString() ?? '',
        userType: j['userType']?.toString() ?? '',
        status: j['status']?.toString() ?? '',
        roles: _strList(j['roles']),
        companyName: _str(j['companyName']),
        createdAt: DateTime.tryParse(j['createdAt']?.toString() ?? ''),
      );
}
