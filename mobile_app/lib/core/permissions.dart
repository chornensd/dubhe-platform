import '../models/models.dart';

/// 角色→默认权限映射（与后端 PermissionCatalog.DefaultRolePermissions 一致）。
/// 移动端登录接口不返回 permissions（双端裁剪），因此客户端按角色推导。
const Map<String, Set<String>> rolePermissions = {
  'Merchant': {
    'account.user.read', 'account.user.manage',
    'order.read', 'order.accept', 'order.dispatch', 'order.settle', 'order.review', 'order.invoice.apply',
    'resource.drone.read', 'resource.drone.manage', 'resource.station.read', 'resource.station.manage',
    'resource.crew.manage', 'resource.maintenance.manage',
    'resource.fault.report', 'resource.fault.manage', 'resource.service-area.manage',
    'airspace.read', 'airspace.plan.submit', 'airspace.fence.manage', 'airspace.monitoring.report', 'airspace.violation.read',
    'report.view', 'report.export', 'report.share',
    'support.alert.handle', 'support.ticket.manage', 'support.ticket.apply',
  },
  'Dispatcher': {
    'order.read', 'order.accept', 'order.dispatch',
    'resource.drone.read', 'resource.drone.manage',
    'resource.station.read', 'resource.station.manage',
    'airspace.read', 'airspace.plan.submit', 'airspace.monitoring.report',
  },
  'Finance': {
    'order.read', 'order.settle', 'order.invoice.apply', 'report.view', 'report.export',
  },
  'Operator': {
    'order.read', 'resource.drone.read', 'resource.drone.manage',
    'resource.station.read', 'resource.station.manage',
    'resource.maintenance.manage', 'resource.fault.report', 'resource.fault.manage',
    'airspace.monitoring.report',
  },
  'Pilot': {
    'order.read', 'order.pilot.execute', 'support.alert.handle', 'resource.fault.report',
    'airspace.monitoring.report', 'resource.drone.read', 'airspace.read',
  },
  'OperationsStaff': {
    'resource.drone.read', 'resource.drone.manage', 'resource.station.read', 'resource.station.manage',
    'resource.maintenance.manage', 'resource.fault.report', 'resource.fault.manage',
    'support.alert.handle', 'support.help.manage', 'config.log.read',
    'airspace.monitoring.report', 'airspace.violation.read',
  },
  'AirTrafficController': {
    'airspace.read', 'airspace.plan.approve', 'airspace.fence.manage', 'airspace.violation.manage',
    'airspace.zone.manage', 'airspace.violation.read', 'airspace.monitoring.report',
    'report.view', 'report.export',
  },
  'Customer': {
    'order.create', 'order.read', 'order.review', 'order.pay', 'order.invoice.apply', 'support.ticket.apply',
  },
  'PublicUser': <String>{},
};

class Permissions {
  Permissions._();

  static Set<String> of(List<String> roles) {
    if (roles.contains('Admin')) return const {'*'};
    final result = <String>{};
    for (final role in roles) {
      final perms = rolePermissions[role];
      if (perms != null) result.addAll(perms);
    }
    return result;
  }
}

extension AuthUserPermissions on AuthUser {
  bool can(String permission) {
    if (isAdmin) return true;
    return Permissions.of(roles).contains(permission);
  }

  bool get isCustomer => roles.contains('Customer');

  bool get isPilot => roles.contains('Pilot');

  bool get isOperations => roles.contains('OperationsStaff');

  bool get isMerchantSide =>
      roles.contains('Merchant') ||
      roles.contains('Dispatcher') ||
      roles.contains('Finance') ||
      roles.contains('Operator');
}
