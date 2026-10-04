import 'package:intl/intl.dart';

/// 字符串枚举字典（后端 DTO 中 Status/Type/Role 字段返回枚举名，与 PC 端字典一致）。
class Dict {
  Dict._();

  static const userTypeNames = <String, String>{
    'IndividualCustomer': '个人客户',
    'EnterpriseCustomer': '企业客户',
    'Merchant': '商家',
    'MerchantStaff': '商家员工',
    'PlatformAdmin': '平台管理员',
    'AirTrafficController': '空管人员',
    'OperationsStaff': '运维人员',
    'Pilot': '机长',
    'PublicUser': '公众用户',
  };

  static const accountStatusNames = <String, String>{
    'PendingReview': '审核中',
    'Active': '正常',
    'Rejected': '已驳回',
    'Frozen': '已冻结',
  };

  static const orderStatusNames = <String, String>{
    'PendingAccept': '待接单',
    'PendingDispatch': '待调度',
    'InFlight': '飞行中',
    'Delivered': '已送达',
    'Cancelled': '已取消',
  };

  static const paymentStatusNames = <String, String>{
    'Unpaid': '未支付',
    'Paid': '已支付',
    'Refunded': '已退款',
  };

  static const paymentMethodNames = <String, String>{
    'Wechat': '微信支付',
    'Alipay': '支付宝',
    'BankTransfer': '对公转账',
  };

  static const droneStatusNames = <String, String>{
    'Offline': '离线',
    'Idle': '闲置',
    'InFlight': '飞行中',
    'Maintenance': '维保中',
  };

  static const stationTypeNames = <String, String>{
    'TakeoffLanding': '起降场站',
    'Charging': '换电站',
  };

  static const stationStatusNames = <String, String>{
    'Offline': '离线',
    'Idle': '空闲',
    'InUse': '使用中',
    'Maintenance': '维护中',
  };

  static const faultStatusNames = <String, String>{
    'Reported': '已上报',
    'Handling': '处理中',
    'Resolved': '已解决',
  };

  static const reservationPurposeNames = <String, String>{
    'Order': '执行订单',
    'Maintenance': '维保',
    'Charging': '充电',
    'Other': '其他',
  };

  static const reservationStatusNames = <String, String>{
    'Reserved': '已预约',
    'Cancelled': '已取消',
    'Completed': '已完成',
  };

  static const maintenanceStatusNames = <String, String>{
    'Ok': '正常',
    'Normal': '正常',
    'DueSoon': '即将到期',
    'Overdue': '已超期',
    'Disabled': '已停用',
  };

  static const airspaceZoneTypeNames = <String, String>{
    'NoFly': '禁飞区',
    'Restricted': '限飞区',
    'TemporaryControl': '临时管制区',
  };

  static const airspaceZoneSourceNames = <String, String>{
    'Manual': '平台录入',
    'MockAts': '空管同步',
    'MerchantFence': '商家围栏',
  };

  static const flightPlanStatusNames = <String, String>{
    'Draft': '草稿',
    'Submitted': '待审批',
    'Approved': '已批准',
    'Rejected': '已驳回',
    'Cancelled': '已取消',
    'Completed': '已完成',
  };

  static const violationTypeNames = <String, String>{
    'NoFlyIntrusion': '闯入禁飞区',
    'FenceBreach': '围栏越界',
    'RouteDeviation': '航线偏离',
    'AltitudeViolation': '高度违规',
    'TimeViolation': '时段违规',
  };

  static const emergencyLevelNames = <String, String>{
    'Normal': '一般',
    'Serious': '严重',
    'Critical': '紧急',
  };

  static const emergencyStatusNames = <String, String>{
    'Open': '未处理',
    'Handling': '处理中',
    'Resolved': '已解决',
    'Closed': '已关闭',
  };

  static const ticketTypeNames = <String, String>{
    'Complaint': '投诉',
    'Consult': '咨询',
    'Advice': '建议',
  };

  static const ticketStatusNames = <String, String>{
    'Pending': '待处理',
    'Processing': '处理中',
    'Completed': '已完成',
    'Closed': '已关闭',
  };

  static const notificationTypeNames = <String, String>{
    'System': '系统消息',
    'QualificationExpiry': '资质到期',
    'MaintenanceDue': '维保到期',
    'OrderStatus': '订单状态',
    'Alert': '告警',
    'FlightPlanApproved': '计划批准',
    'FlightPlanRejected': '计划驳回',
    'Violation': '违规',
    'TicketUpdated': '工单',
    'EmergencyAlert': '应急告警',
  };

  static const invoiceStatusNames = <String, String>{
    'Submitted': '已提交',
    'Issued': '已开具',
    'Rejected': '已驳回',
  };

  static const roleNames = <String, String>{
    'Admin': '平台管理员',
    'Merchant': '商家',
    'Dispatcher': '调度员',
    'Finance': '财务',
    'Operator': '操作员',
    'Pilot': '机长',
    'OperationsStaff': '运维人员',
    'AirTrafficController': '空管监管人员',
    'Customer': '客户',
    'PublicUser': '公众/第三方',
  };

  /// 订单物品类型（与后端禁运品校验一致，禁运品下单前拦截）。
  static const itemCategories = <MapEntry<String, String>>[
    MapEntry('documents', '文件票据'),
    MapEntry('food', '食品'),
    MapEntry('medicine', '医药用品'),
    MapEntry('electronics', '电子产品'),
    MapEntry('clothing', '服饰'),
    MapEntry('other', '其他'),
  ];

  static const prohibitedCategories = <MapEntry<String, String>>[
    MapEntry('flammable', '易燃易爆品'),
    MapEntry('weapon', '武器及管制刀具'),
    MapEntry('drug', '毒品及违禁药物'),
    MapEntry('live_animal', '活体动物'),
    MapEntry('chemical', '危险化学品'),
  ];

  static const faultTypes = <String>[
    '动力系统异常',
    '电池异常',
    '螺旋桨损伤',
    '通信/图传中断',
    '导航定位异常',
    '机身结构损伤',
    '其他故障',
  ];

  static String of(Map<String, String> dict, String? key, {String fallback = '—'}) {
    if (key == null || key.isEmpty) return fallback;
    return dict[key] ?? key;
  }
}

class Fmt {
  Fmt._();

  static final _money = NumberFormat('#,##0.00');
  static final _dateTime = DateFormat('yyyy-MM-dd HH:mm');
  static final _date = DateFormat('yyyy-MM-dd');
  static final _time = DateFormat('HH:mm');
  static final _monthDay = DateFormat('MM-dd HH:mm');

  static DateTime? parse(Object? v) {
    if (v == null) return null;
    if (v is DateTime) return v;
    final s = v.toString();
    if (s.isEmpty) return null;
    final d = DateTime.tryParse(s)?.toLocal();
    if (d == null) return null;
    // 后端可能把可空时间序列化为默认值（0001-01-01），视为空
    if (d.year < 1900) return null;
    return d;
  }

  static String dateTime(Object? v, {String fallback = '—'}) {
    final d = parse(v);
    return d == null ? fallback : _dateTime.format(d);
  }

  static String date(Object? v, {String fallback = '—'}) {
    final d = parse(v);
    return d == null ? fallback : _date.format(d);
  }

  static String time(Object? v, {String fallback = '—'}) {
    final d = parse(v);
    return d == null ? fallback : _time.format(d);
  }

  static String monthDay(Object? v, {String fallback = '—'}) {
    final d = parse(v);
    return d == null ? fallback : _monthDay.format(d);
  }

  static String money(Object? v) {
    final n = _num(v);
    return _money.format(n);
  }

  static String amount(Object? v) => '¥${money(v)}';

  static String number(Object? v, {int digits = 1}) {
    final n = _num(v);
    if (n == n.roundToDouble()) return n.toInt().toString();
    return n.toStringAsFixed(digits);
  }

  static double _num(Object? v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  static String relative(Object? v) {
    final d = parse(v);
    if (d == null) return '—';
    final diff = DateTime.now().difference(d);
    if (diff.inMinutes < 1) return '刚刚';
    if (diff.inMinutes < 60) return '${diff.inMinutes} 分钟前';
    if (diff.inHours < 24) return '${diff.inHours} 小时前';
    if (diff.inDays < 7) return '${diff.inDays} 天前';
    return _dateTime.format(d);
  }

  /// 距离（km）展示：小于 1 显示米。
  static String distanceKm(Object? v) {
    final km = _num(v);
    if (km < 1) return '${(km * 1000).round()} 米';
    return '${km.toStringAsFixed(1)} 公里';
  }

  static String durationMinutes(Object? v) {
    final m = _num(v).round();
    if (m < 60) return '$m 分钟';
    final h = m ~/ 60;
    final rest = m % 60;
    return rest == 0 ? '$h 小时' : '$h 小时 $rest 分钟';
  }
}
