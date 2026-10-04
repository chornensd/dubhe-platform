import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/session.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../services/providers.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// 运维工作台：设备/维保/场站/故障概览与快捷入口。
class OpsWorkbenchPage extends ConsumerStatefulWidget {
  const OpsWorkbenchPage({super.key});

  @override
  ConsumerState<OpsWorkbenchPage> createState() => _OpsWorkbenchPageState();
}

class _OpsWorkbenchPageState extends ConsumerState<OpsWorkbenchPage> {
  int _droneTotal = 0;
  int _maintenanceDue = 0;
  int _faultOpen = 0;
  int _stationTotal = 0;
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
        api.drones(pageNum: 1, pageSize: 1),
        api.maintenancePlans(),
        api.faults(pageNum: 1, pageSize: 50),
        api.stations(pageNum: 1, pageSize: 1),
      ]);
      final drones = results[0] as Paged<Drone>;
      final plans = results[1] as List<MaintenancePlan>;
      final faults = results[2] as Paged<FaultItem>;
      final stations = results[3] as Paged<Station>;
      if (!mounted) return;
      setState(() {
        _droneTotal = drones.total;
        _maintenanceDue =
            plans.where((p) => p.enabled && p.isDueSoon).length;
        _faultOpen = faults.items.where((f) => f.status != 'Resolved').length;
        _stationTotal = stations.total;
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
                  colors: [Color(0xFF08979C), Color(0xFF13C2C2)],
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
                            '运维工作台',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${user?.displayName ?? ''} · 设备与场站维护',
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
                                        label: '飞行器',
                                        value: '$_droneTotal',
                                        unit: '台',
                                      ),
                                    ),
                                    Expanded(
                                      child: StatTile(
                                        label: '维保到期',
                                        value: '$_maintenanceDue',
                                        unit: '项',
                                        color: _maintenanceDue > 0
                                            ? AppColors.warning
                                            : AppColors.success,
                                      ),
                                    ),
                                    Expanded(
                                      child: StatTile(
                                        label: '待处理故障',
                                        value: '$_faultOpen',
                                        unit: '单',
                                        color: _faultOpen > 0
                                            ? AppColors.danger
                                            : AppColors.success,
                                      ),
                                    ),
                                    Expanded(
                                      child: StatTile(
                                        label: '场站',
                                        value: '$_stationTotal',
                                        unit: '座',
                                      ),
                                    ),
                                  ],
                                ),
                    ),
                    const SizedBox(height: 12),
                    SectionCard(
                      padding: const EdgeInsets.symmetric(
                          vertical: 6, horizontal: 4),
                      child: Row(
                        children: [
                          Expanded(
                            child: QuickEntry(
                              icon: Icons.airplanemode_active_rounded,
                              label: '设备列表',
                              onTap: () => context.go('/ops/drones'),
                            ),
                          ),
                          Expanded(
                            child: QuickEntry(
                              icon: Icons.build_circle_outlined,
                              label: '维保管理',
                              color: AppColors.warning,
                              onTap: () => context.push('/ops/maintenance'),
                            ),
                          ),
                          Expanded(
                            child: QuickEntry(
                              icon: Icons.ev_station_outlined,
                              label: '场站管理',
                              color: const Color(0xFF13C2C2),
                              onTap: () => context.go('/ops/stations'),
                            ),
                          ),
                          Expanded(
                            child: QuickEntry(
                              icon: Icons.report_problem_outlined,
                              label: '故障处理',
                              color: AppColors.danger,
                              onTap: () => context.push('/ops/faults'),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    SectionCard(
                      title: '运维职责',
                      child: const Text(
                        '· 设备台账与状态监控（电量、健康度、维保记录）\n'
                        '· 维保计划到期检查与记录登记\n'
                        '· 场站与充电资源信息维护、预约处置\n'
                        '· 故障受理与闭环（处理结果自动写入维保记录）',
                        style: TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                            height: 1.9),
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
