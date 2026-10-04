import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/session.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../services/providers.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// 移动管理员工作台：待办审批 + 应急告警。
class AdminWorkbenchPage extends ConsumerStatefulWidget {
  const AdminWorkbenchPage({super.key});

  @override
  ConsumerState<AdminWorkbenchPage> createState() =>
      _AdminWorkbenchPageState();
}

class _AdminWorkbenchPageState extends ConsumerState<AdminWorkbenchPage> {
  int _pendingPlans = 0;
  int _pendingUsers = 0;
  int _openAlerts = 0;
  int _criticalAlerts = 0;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiServiceProvider);
      final results = await Future.wait([
        api.flightPlans(pageNum: 1, pageSize: 1, status: 2),
        api.adminUsers(pageNum: 1, pageSize: 1, status: 0),
        api.emergencyAlerts(pageNum: 1, pageSize: 50),
      ]);
      final alerts = results[2] as Paged<EmergencyAlert>;
      if (!mounted) return;
      setState(() {
        _pendingPlans = results[0].total;
        _pendingUsers = results[1].total;
        _openAlerts = alerts.items.where((a) => a.isOpen).length;
        _criticalAlerts =
            alerts.items.where((a) => a.isOpen && a.level == 'Critical').length;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = '$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final unread = ref.watch(unreadCountProvider).value ?? 0;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(18, 14, 12, 44),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF0958D9), Color(0xFF2F54EB)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: SafeArea(
                bottom: false,
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            '管理驾驶舱',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${user?.displayName ?? ''} · 待办审批与应急告警',
                            style: const TextStyle(
                                color: Color(0xCCFFFFFF), fontSize: 12.5),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => context.push('/notifications'),
                      icon: Badge(
                        isLabelVisible: unread > 0,
                        label: Text(unread > 99 ? '99+' : '$unread'),
                        child: const Icon(Icons.notifications_none_rounded,
                            color: Colors.white, size: 26),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Transform.translate(
              offset: const Offset(0, -24),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Column(
                  children: [
                    SectionCard(
                      child: _loading
                          ? const Padding(
                              padding: EdgeInsets.symmetric(vertical: 16),
                              child: LoadingView(),
                            )
                          : _error != null
                              ? ErrorView(message: _error!, onRetry: _load)
                              : Row(
                                  children: [
                                    Expanded(
                                      child: StatTile(
                                        label: '待审批计划',
                                        value: '$_pendingPlans',
                                        unit: '条',
                                        color: _pendingPlans > 0
                                            ? AppColors.warning
                                            : AppColors.success,
                                        onTap: () =>
                                            context.go('/admin/approvals'),
                                      ),
                                    ),
                                    Expanded(
                                      child: StatTile(
                                        label: '待审核账号',
                                        value: '$_pendingUsers',
                                        unit: '个',
                                        color: _pendingUsers > 0
                                            ? AppColors.warning
                                            : AppColors.success,
                                        onTap: () =>
                                            context.go('/admin/approvals'),
                                      ),
                                    ),
                                    Expanded(
                                      child: StatTile(
                                        label: '未闭环告警',
                                        value: '$_openAlerts',
                                        unit: '条',
                                        color: _openAlerts > 0
                                            ? AppColors.danger
                                            : AppColors.success,
                                        onTap: () => context.go('/alerts'),
                                      ),
                                    ),
                                  ],
                                ),
                    ),
                    if (_criticalAlerts > 0) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFF1F0),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                              color:
                                  AppColors.danger.withValues(alpha: 0.4)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.warning_amber_rounded,
                                color: AppColors.danger, size: 22),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                '有 $_criticalAlerts 条「紧急」级别告警未闭环，请优先处置',
                                style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.danger),
                              ),
                            ),
                            TextButton(
                              onPressed: () => context.go('/alerts'),
                              child: const Text('去处置',
                                  style: TextStyle(fontSize: 13)),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    SectionCard(
                      padding: const EdgeInsets.symmetric(
                          vertical: 6, horizontal: 4),
                      child: Row(
                        children: [
                          Expanded(
                            child: QuickEntry(
                              icon: Icons.fact_check_outlined,
                              label: '审批中心',
                              badge: _pendingPlans + _pendingUsers,
                              onTap: () => context.go('/admin/approvals'),
                            ),
                          ),
                          Expanded(
                            child: QuickEntry(
                              icon: Icons.warning_amber_rounded,
                              label: '应急告警',
                              color: AppColors.danger,
                              badge: _openAlerts,
                              onTap: () => context.go('/alerts'),
                            ),
                          ),
                          Expanded(
                            child: QuickEntry(
                              icon: Icons.receipt_long_outlined,
                              label: '订单查询',
                              onTap: () => context.push('/orders'),
                            ),
                          ),
                          Expanded(
                            child: QuickEntry(
                              icon: Icons.menu_book_outlined,
                              label: '帮助中心',
                              onTap: () => context.push('/help'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
