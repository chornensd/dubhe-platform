import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/permissions.dart';
import '../../core/session.dart';
import '../../models/models.dart';
import '../../services/providers.dart';
import '../theme.dart';

class _Tab {
  const _Tab(this.path, this.label, this.icon, this.activeIcon);

  final String path;
  final String label;
  final IconData icon;
  final IconData activeIcon;
}

/// 主框架：底部导航按角色切换。
class MainShell extends ConsumerStatefulWidget {
  const MainShell({super.key, required this.location, required this.child});

  final String location;
  final Widget child;

  @override
  ConsumerState<MainShell> createState() => _MainShellState();
}

class _MainShellState extends ConsumerState<MainShell> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 45), (_) {
      ref.invalidate(unreadCountProvider);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  List<_Tab> _tabsFor(AuthUser? user) {
    if (user == null) return const [];
    if (user.isPilot) {
      return const [
        _Tab('/workbench', '工作台', Icons.space_dashboard_outlined,
            Icons.space_dashboard_rounded),
        _Tab('/monitoring', '飞行监控', Icons.radar_outlined, Icons.radar_rounded),
        _Tab('/records', '记录', Icons.history_outlined, Icons.history_rounded),
        _Tab('/profile', '我的', Icons.person_outline_rounded,
            Icons.person_rounded),
      ];
    }
    if (user.roles.contains('Admin')) {
      return const [
        _Tab('/admin/workbench', '工作台', Icons.space_dashboard_outlined,
            Icons.space_dashboard_rounded),
        _Tab('/admin/approvals', '审批', Icons.fact_check_outlined,
            Icons.fact_check_rounded),
        _Tab('/alerts', '告警', Icons.warning_amber_rounded,
            Icons.warning_rounded),
        _Tab('/profile', '我的', Icons.person_outline_rounded,
            Icons.person_rounded),
      ];
    }
    if (user.isOperations) {
      return const [
        _Tab('/ops/workbench', '工作台', Icons.space_dashboard_outlined,
            Icons.space_dashboard_rounded),
        _Tab('/ops/drones', '设备', Icons.airplanemode_active_outlined,
            Icons.airplanemode_active_rounded),
        _Tab('/ops/stations', '场站', Icons.ev_station_outlined,
            Icons.ev_station_rounded),
        _Tab('/profile', '我的', Icons.person_outline_rounded,
            Icons.person_rounded),
      ];
    }
    if (user.isCustomer) {
      return const [
        _Tab('/home', '首页', Icons.home_outlined, Icons.home_rounded),
        _Tab('/orders', '订单', Icons.receipt_long_outlined,
            Icons.receipt_long_rounded),
        _Tab('/notifications', '消息', Icons.notifications_outlined,
            Icons.notifications_rounded),
        _Tab('/profile', '我的', Icons.person_outline_rounded,
            Icons.person_rounded),
      ];
    }
    return const [
      _Tab('/workbench', '工作台', Icons.space_dashboard_outlined,
          Icons.space_dashboard_rounded),
      _Tab('/notifications', '消息', Icons.notifications_outlined,
          Icons.notifications_rounded),
      _Tab('/profile', '我的', Icons.person_outline_rounded,
          Icons.person_rounded),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final tabs = _tabsFor(user);
    final unread = ref.watch(unreadCountProvider).value ?? 0;

    var index = tabs.indexWhere(
      (tab) => widget.location == tab.path ||
          widget.location.startsWith('${tab.path}/'),
    );
    if (index < 0) index = 0;

    return Scaffold(
      body: widget.child,
      bottomNavigationBar: tabs.isEmpty
          ? null
          : DecoratedBox(
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: AppColors.divider)),
              ),
              child: NavigationBar(
                selectedIndex: index,
                onDestinationSelected: (i) {
                  final path = tabs[i].path;
                  if (widget.location != path) context.go(path);
                },
                destinations: [
                  for (final tab in tabs)
                    NavigationDestination(
                      icon: tab.path == '/notifications' && unread > 0
                          ? Badge(
                              label: Text(unread > 99 ? '99+' : '$unread'),
                              child: Icon(tab.icon),
                            )
                          : Icon(tab.icon),
                      selectedIcon: tab.path == '/notifications' && unread > 0
                          ? Badge(
                              label: Text(unread > 99 ? '99+' : '$unread'),
                              child: Icon(tab.activeIcon),
                            )
                          : Icon(tab.activeIcon),
                      label: tab.label,
                    ),
                ],
              ),
            ),
    );
  }
}
