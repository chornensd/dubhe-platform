import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/exceptions.dart';
import '../../core/format.dart';
import '../../core/paged_list.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/gauge.dart';

/// 设备列表（飞行器台账）。
class OpsDronesPage extends ConsumerStatefulWidget {
  const OpsDronesPage({super.key});

  @override
  ConsumerState<OpsDronesPage> createState() => _OpsDronesPageState();
}

class _OpsDronesPageState extends ConsumerState<OpsDronesPage> {
  static const _statuses = <(int?, String)>[
    (null, '全部'),
    (1, '闲置'),
    (2, '飞行中'),
    (3, '维保中'),
    (0, '离线'),
  ];

  int? _status;
  late PagedList<Drone> _list;

  @override
  void initState() {
    super.initState();
    _list = _createList();
  }

  PagedList<Drone> _createList() {
    final status = _status;
    return PagedList(
      loader: (pageNum, pageSize) => ref
          .read(apiServiceProvider)
          .drones(pageNum: pageNum, pageSize: pageSize, status: status),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: '设备列表',
      body: Column(
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: SizedBox(
              height: 34,
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                scrollDirection: Axis.horizontal,
                itemCount: _statuses.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final item = _statuses[index];
                  final selected = _status == item.$1;
                  return GestureDetector(
                    onTap: () => setState(() {
                      _status = item.$1;
                      _list = _createList();
                    }),
                    child: Container(
                      alignment: Alignment.center,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: selected
                            ? AppColors.primary
                            : const Color(0xFFF3F5F7),
                        borderRadius: BorderRadius.circular(17),
                      ),
                      child: Text(
                        item.$2,
                        style: TextStyle(
                          fontSize: 13,
                          color: selected ? Colors.white : AppColors.text,
                          fontWeight:
                              selected ? FontWeight.w600 : FontWeight.w400,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          Expanded(
            child: PagedListView<Drone>(
              key: ValueKey(_status),
              list: _list,
              emptyText: '暂无飞行器',
              emptyIcon: Icons.airplanemode_inactive,
              itemBuilder: (context, drone, index) => Material(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => OpsDroneDetailPage(droneId: drone.id),
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                drone.serialNo,
                                style: const TextStyle(
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w600),
                              ),
                            ),
                            StatusChip(
                              Dict.of(Dict.droneStatusNames, drone.status),
                              compact: true,
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          drone.model,
                          style: const TextStyle(
                              fontSize: 12.5, color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            SizedBox(
                              width: 96,
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '电量 ${drone.batteryPercent}%',
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: drone.batteryPercent < 30
                                          ? AppColors.danger
                                          : AppColors.textSecondary,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  ProgressLine(
                                    value: drone.batteryPercent / 100,
                                    color: drone.batteryPercent < 30
                                        ? AppColors.danger
                                        : AppColors.success,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    '健康度 ${drone.healthScore}',
                                    style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSecondary),
                                  ),
                                  const SizedBox(height: 4),
                                  ProgressLine(
                                    value: drone.healthScore / 100,
                                    color: drone.healthScore < 60
                                        ? AppColors.warning
                                        : AppColors.primary,
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 12),
                            Text(
                              '累计 ${Fmt.durationMinutes(drone.cumulativeFlightMinutes)}',
                              style: const TextStyle(
                                  fontSize: 11.5,
                                  color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 设备详情：状态、维保计划、维保记录、故障记录，可登记维保。
class OpsDroneDetailPage extends ConsumerStatefulWidget {
  const OpsDroneDetailPage({super.key, required this.droneId});

  final String droneId;

  @override
  ConsumerState<OpsDroneDetailPage> createState() =>
      _OpsDroneDetailPageState();
}

class _OpsDroneDetailPageState extends ConsumerState<OpsDroneDetailPage> {
  Drone? _drone;
  MaintenancePlan? _plan;
  List<MaintenanceRecord> _records = const [];
  List<FaultItem> _faults = const [];
  bool _loading = true;
  String? _error;
  bool _busy = false;

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
      final drones = await api.drones(pageNum: 1, pageSize: 100);
      final drone = drones.items
          .where((d) => d.id == widget.droneId)
          .cast<Drone?>()
          .firstWhere((d) => d != null, orElse: () => null);
      if (drone == null) {
        setState(() {
          _loading = false;
          _error = '未找到该飞行器';
        });
        return;
      }
      final plans = await api.maintenancePlans(droneId: drone.id);
      final records = await api.maintenanceRecords(droneId: drone.id);
      final faults = await api.faults(
          pageNum: 1, pageSize: 20, droneId: drone.id);
      if (!mounted) return;
      setState(() {
        _drone = drone;
        _plan = plans.isEmpty ? null : plans.first;
        _records = records;
        _faults = faults.items;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.message;
      });
    }
  }

  Future<void> _addRecord() async {
    final drone = _drone;
    if (drone == null) return;
    final type = ValueNotifier<String>('例行维保');
    final content = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('登记维保记录', style: TextStyle(fontSize: 16)),
        content: StatefulBuilder(
          builder: (context, setDialogState) => Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: type.value,
                items: [
                  for (final t in const ['例行维保', '故障维修', '电池维护', '固件升级'])
                    DropdownMenuItem(
                        value: t,
                        child: Text(t, style: const TextStyle(fontSize: 14))),
                ],
                onChanged: (v) => setDialogState(() => type.value = v ?? '例行维保'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: content,
                maxLines: 3,
                decoration: const InputDecoration(
                    hintText: '维保内容（更换配件、检查项、结论等）'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('提交'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      if (content.text.trim().length < 2) {
        if (mounted) showAppSnack(context, '请填写维保内容', error: true);
      } else {
        setState(() => _busy = true);
        try {
          await ref.read(apiServiceProvider).createMaintenanceRecord(
                droneId: drone.id,
                planId: _plan?.id,
                type: type.value,
                content: content.text.trim(),
              );
          if (!mounted) return;
          showAppSnack(context, '维保记录已登记');
          await _load();
        } on ApiException catch (e) {
          if (mounted) showAppSnack(context, e.message, error: true);
        } finally {
          if (mounted) setState(() => _busy = false);
        }
      }
    }
    content.dispose();
    type.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final drone = _drone;
    return AppScaffold(
      title: '设备详情',
      body: _loading
          ? const LoadingView()
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(14),
                    children: [
                      SectionCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    drone!.serialNo,
                                    style: const TextStyle(
                                        fontSize: 18,
                                        fontWeight: FontWeight.w700),
                                  ),
                                ),
                                StatusChip(Dict.of(
                                    Dict.droneStatusNames, drone.status)),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              drone.model,
                              style: const TextStyle(
                                  fontSize: 13,
                                  color: AppColors.textSecondary),
                            ),
                            const SizedBox(height: 14),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                              children: [
                                Gauge(
                                  label: '电量',
                                  value: drone.batteryPercent.toDouble(),
                                  unit: '%',
                                  max: 100,
                                  color: drone.batteryPercent < 30
                                      ? AppColors.danger
                                      : AppColors.success,
                                ),
                                Gauge(
                                  label: '健康度',
                                  value: drone.healthScore.toDouble(),
                                  unit: '分',
                                  max: 100,
                                  color: drone.healthScore < 60
                                      ? AppColors.warning
                                      : AppColors.primary,
                                ),
                              ],
                            ),
                            const Divider(height: 24),
                            InfoRow('最大载重', '${Fmt.number(drone.maxPayloadKg)} kg'),
                            InfoRow('续航', '${drone.enduranceMinutes} 分钟'),
                            InfoRow('累计飞行',
                                Fmt.durationMinutes(drone.cumulativeFlightMinutes)),
                            InfoRow('上次维保',
                                Fmt.dateTime(drone.lastMaintainedAt)),
                          ],
                        ),
                      ),
                      SectionCard(
                        title: '维保计划',
                        trailing: TextButton(
                          onPressed: _busy ? null : _editPlan,
                          child: const Text('设置', style: TextStyle(fontSize: 13)),
                        ),
                        child: _plan == null
                            ? const Text('未配置维保计划',
                                style: TextStyle(
                                    fontSize: 13,
                                    color: AppColors.textSecondary))
                            : Column(
                                children: [
                                  InfoRow(
                                    '状态',
                                    Dict.of({
                                      'Ok': '正常',
                                      'Normal': '正常',
                                      'DueSoon': '即将到期',
                                      'Overdue': '已超期',
                                      'Disabled': '已停用'
                                    }, _plan!.status),
                                    valueColor: _plan!.isDueSoon
                                        ? AppColors.warning
                                        : AppColors.success,
                                  ),
                                  InfoRow(
                                    '周期',
                                    [
                                      if (_plan!.intervalDays != null)
                                        '${_plan!.intervalDays} 天',
                                      if (_plan!.intervalFlightMinutes != null)
                                        '${_plan!.intervalFlightMinutes} 飞行分钟',
                                    ].join(' / '),
                                  ),
                                  InfoRow('下次到期', Fmt.dateTime(_plan!.nextDueAt)),
                                  InfoRow('上次维保',
                                      Fmt.dateTime(_plan!.lastMaintainedAt)),
                                ],
                              ),
                      ),
                      SectionCard(
                        title: '维保记录',
                        trailing: TextButton(
                          onPressed: _busy ? null : _addRecord,
                          child: const Text('登记维保', style: TextStyle(fontSize: 13)),
                        ),
                        child: _records.isEmpty
                            ? const Text('暂无维保记录',
                                style: TextStyle(
                                    fontSize: 13,
                                    color: AppColors.textSecondary))
                            : Column(
                                children: [
                                  for (final record in _records)
                                    Padding(
                                      padding: const EdgeInsets.symmetric(
                                          vertical: 6),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              StatusChip(record.type,
                                                  tone: AppColors.textSecondary,
                                                  compact: true),
                                              const SizedBox(width: 8),
                                              Expanded(
                                                child: Text(
                                                  record.content,
                                                  maxLines: 2,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                  style: const TextStyle(
                                                      fontSize: 13.5),
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            Fmt.dateTime(record.maintainedAt),
                                            style: const TextStyle(
                                                fontSize: 11.5,
                                                color:
                                                    AppColors.textSecondary),
                                          ),
                                        ],
                                      ),
                                    ),
                                ],
                              ),
                      ),
                      SectionCard(
                        title: '故障记录',
                        child: _faults.isEmpty
                            ? const Text('暂无故障记录',
                                style: TextStyle(
                                    fontSize: 13,
                                    color: AppColors.textSecondary))
                            : Column(
                                children: [
                                  for (final fault in _faults)
                                    Padding(
                                      padding: const EdgeInsets.symmetric(
                                          vertical: 6),
                                      child: Row(
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(fault.faultType,
                                                    style: const TextStyle(
                                                        fontSize: 13.5,
                                                        fontWeight:
                                                            FontWeight.w500)),
                                                Text(
                                                  fault.description,
                                                  maxLines: 1,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                  style: const TextStyle(
                                                      fontSize: 12,
                                                      color: AppColors
                                                          .textSecondary),
                                                ),
                                              ],
                                            ),
                                          ),
                                          StatusChip(
                                            Dict.of(Dict.faultStatusNames,
                                                fault.status),
                                            compact: true,
                                          ),
                                        ],
                                      ),
                                    ),
                                ],
                              ),
                      ),
                    ],
                  ),
                ),
    );
  }

  Future<void> _editPlan() async {
    final drone = _drone;
    if (drone == null) return;
    final days = TextEditingController(
        text: _plan?.intervalDays?.toString() ?? '90');
    final minutes = TextEditingController(
        text: _plan?.intervalFlightMinutes?.toString() ?? '100');
    var enabled = _plan?.enabled ?? true;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('维保计划', style: TextStyle(fontSize: 16)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: days,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(hintText: '周期天数（如 90）'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: minutes,
                keyboardType: TextInputType.number,
                decoration:
                    const InputDecoration(hintText: '周期飞行分钟（如 100）'),
              ),
              const SizedBox(height: 6),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                value: enabled,
                onChanged: (v) => setDialogState(() => enabled = v),
                title: const Text('启用计划', style: TextStyle(fontSize: 14)),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('取消'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('保存'),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true) {
      setState(() => _busy = true);
      try {
        await ref.read(apiServiceProvider).upsertMaintenancePlan(
              droneId: drone.id,
              intervalDays: int.tryParse(days.text.trim()),
              intervalFlightMinutes: int.tryParse(minutes.text.trim()),
              enabled: enabled,
            );
        if (!mounted) return;
        showAppSnack(context, '维保计划已保存');
        await _load();
      } on ApiException catch (e) {
        if (mounted) showAppSnack(context, e.message, error: true);
      } finally {
        if (mounted) setState(() => _busy = false);
      }
    }
    days.dispose();
    minutes.dispose();
  }
}
