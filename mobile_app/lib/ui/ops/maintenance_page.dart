import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'drones_page.dart';

/// 维保管理：计划（到期高亮）与记录历史。
class OpsMaintenancePage extends ConsumerStatefulWidget {
  const OpsMaintenancePage({super.key});

  @override
  ConsumerState<OpsMaintenancePage> createState() =>
      _OpsMaintenancePageState();
}

class _OpsMaintenancePageState extends ConsumerState<OpsMaintenancePage> {
  List<MaintenancePlan> _plans = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPlans();
  }

  Future<void> _loadPlans() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final plans = await ref.read(apiServiceProvider).maintenancePlans();
      if (!mounted) return;
      setState(() {
        _plans = plans;
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
    return DefaultTabController(
      length: 2,
      child: AppScaffold(
        title: '维保管理',
        body: Column(
          children: [
            Container(
              color: Colors.white,
              child: const TabBar(
                tabs: [Tab(text: '维保计划'), Tab(text: '维保记录')],
              ),
            ),
            Expanded(
              child: TabBarView(
                children: [
                  _buildPlans(),
                  const _MaintenanceRecordsTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlans() {
    if (_loading) return const LoadingView(text: '加载中…');
    if (_error != null) {
      return ErrorView(message: _error!, onRetry: _loadPlans);
    }
    if (_plans.isEmpty) {
      return const EmptyView(
          text: '暂无维保计划，可在设备详情中设置', icon: Icons.build_outlined);
    }
    final sorted = [..._plans]..sort((a, b) {
        int rank(MaintenancePlan p) => switch (p.status) {
              'Overdue' => 0,
              'DueSoon' => 1,
              'Normal' || 'Ok' => 2,
              _ => 3,
            };
        return rank(a).compareTo(rank(b));
      });
    final dueCount =
        sorted.where((p) => p.enabled && p.isDueSoon).length;

    return RefreshIndicator(
      onRefresh: _loadPlans,
      child: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          if (dueCount > 0)
            Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7E6),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: AppColors.warning.withValues(alpha: 0.4)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.notification_important_outlined,
                      color: AppColors.warning, size: 20),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '$dueCount 项维保已到期/即将到期（超期飞行器将被禁止调度）',
                      style: const TextStyle(fontSize: 12.5, height: 1.5),
                    ),
                  ),
                ],
              ),
            ),
          for (final plan in sorted)
            SectionCard(
              child: InkWell(
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => OpsDroneDetailPage(droneId: plan.droneId),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            plan.droneSerialNo,
                            style: const TextStyle(
                                fontSize: 14.5, fontWeight: FontWeight.w600),
                          ),
                        ),
                        StatusChip(
                          Dict.of(const {
                            'Ok': '正常',
                            'Normal': '正常',
                            'DueSoon': '即将到期',
                            'Overdue': '已超期',
                            'Disabled': '已停用',
                          }, plan.enabled ? plan.status : 'Disabled'),
                          compact: true,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    InfoRow(
                      '周期',
                      [
                        if (plan.intervalDays != null)
                          '每 ${plan.intervalDays} 天',
                        if (plan.intervalFlightMinutes != null)
                          '每 ${plan.intervalFlightMinutes} 飞行分钟',
                      ].join(' / '),
                      dense: true,
                    ),
                    InfoRow('下次到期', Fmt.dateTime(plan.nextDueAt), dense: true),
                    InfoRow('上次维保', Fmt.dateTime(plan.lastMaintainedAt),
                        dense: true),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _MaintenanceRecordsTab extends ConsumerStatefulWidget {
  const _MaintenanceRecordsTab();

  @override
  ConsumerState<_MaintenanceRecordsTab> createState() =>
      _MaintenanceRecordsTabState();
}

class _MaintenanceRecordsTabState
    extends ConsumerState<_MaintenanceRecordsTab>
    with AutomaticKeepAliveClientMixin {
  List<MaintenanceRecord> _records = const [];
  bool _loading = true;
  String? _error;

  @override
  bool get wantKeepAlive => true;

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
      final records = await ref.read(apiServiceProvider).maintenanceRecords();
      if (!mounted) return;
      setState(() {
        _records = records..sort((a, b) =>
            (b.maintainedAt ?? DateTime(2000)).compareTo(a.maintainedAt ?? DateTime(2000)));
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
    super.build(context);
    if (_loading) return const LoadingView(text: '加载中…');
    if (_error != null) return ErrorView(message: _error!, onRetry: _load);
    if (_records.isEmpty) {
      return const EmptyView(text: '暂无维保记录', icon: Icons.build_outlined);
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(14),
        itemCount: _records.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, index) {
          final record = _records[index];
          return Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => OpsDroneDetailPage(droneId: record.droneId),
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        StatusChip(record.type,
                            tone: AppColors.primary, compact: true),
                        const Spacer(),
                        Text(
                          Fmt.dateTime(record.maintainedAt),
                          style: const TextStyle(
                              fontSize: 11.5, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(record.content,
                        style: const TextStyle(fontSize: 13.5, height: 1.5)),
                    const SizedBox(height: 6),
                    Text(
                      '飞行器 ${record.droneId.substring(0, 8)}…',
                      style: const TextStyle(
                          fontSize: 11.5, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
