import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/exceptions.dart';
import '../../core/format.dart';
import '../../core/paged_list.dart';
import '../../core/permissions.dart';
import '../../core/session.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// 应急告警（机长/运维/管理员共用；按权限显示操作）。
class AlertsPage extends ConsumerStatefulWidget {
  const AlertsPage({super.key});

  @override
  ConsumerState<AlertsPage> createState() => _AlertsPageState();
}

class _AlertsPageState extends ConsumerState<AlertsPage> {
  static const _filters = <(int?, String)>[
    (null, '全部'),
    (3, '紧急'),
    (2, '严重'),
    (1, '一般'),
  ];

  int? _level;
  late PagedList<EmergencyAlert> _list;

  @override
  void initState() {
    super.initState();
    _list = _createList();
  }

  PagedList<EmergencyAlert> _createList() {
    final level = _level;
    return PagedList(
      loader: (pageNum, pageSize) => ref
          .read(apiServiceProvider)
          .emergencyAlerts(pageNum: pageNum, pageSize: pageSize, level: level),
    );
  }

  Color _levelColor(String level) => switch (level) {
        'Critical' => AppColors.danger,
        'Serious' => AppColors.warning,
        _ => AppColors.neutral,
      };

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: '应急告警',
      actions: [
        IconButton(
          onPressed: () => context.push('/alerts/new'),
          icon: const Icon(Icons.add_alert_outlined),
        ),
      ],
      body: Column(
        children: [
          SizedBox(
            height: 48,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              scrollDirection: Axis.horizontal,
              itemCount: _filters.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final item = _filters[index];
                final selected = _level == item.$1;
                return GestureDetector(
                  onTap: () => setState(() {
                    _level = item.$1;
                    _list = _createList();
                  }),
                  child: Container(
                    alignment: Alignment.center,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color:
                          selected ? AppColors.primary : const Color(0xFFF3F5F7),
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
          Expanded(
            child: PagedListView<EmergencyAlert>(
              key: ValueKey(_level),
              list: _list,
              emptyText: '暂无告警记录',
              emptyIcon: Icons.warning_amber_rounded,
              itemBuilder: (context, alert, index) => Material(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => context.push('/alerts/${alert.id}'),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: _levelColor(alert.level),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                alert.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w600),
                              ),
                            ),
                            StatusChip(
                              Dict.of(Dict.emergencyStatusNames, alert.status),
                              compact: true,
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          alert.content,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                              height: 1.5),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            StatusChip(
                              Dict.of(Dict.emergencyLevelNames, alert.level),
                              tone: _levelColor(alert.level),
                              compact: true,
                            ),
                            const SizedBox(width: 8),
                            if (alert.source != null)
                              Text(
                                alert.source!,
                                style: const TextStyle(
                                    fontSize: 11.5,
                                    color: AppColors.textSecondary),
                              ),
                            const Spacer(),
                            Text(
                              Fmt.relative(alert.reportedAt ?? alert.createdAt),
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

class AlertCreatePage extends ConsumerStatefulWidget {
  const AlertCreatePage({super.key});

  @override
  ConsumerState<AlertCreatePage> createState() => _AlertCreatePageState();
}

class _AlertCreatePageState extends ConsumerState<AlertCreatePage> {
  final _title = TextEditingController();
  final _content = TextEditingController();
  int _level = 2;
  bool _submitting = false;

  @override
  void dispose() {
    _title.dispose();
    _content.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_title.text.trim().isEmpty || _content.text.trim().length < 5) {
      showAppSnack(context, '请填写标题与详细内容', error: true);
      return;
    }
    setState(() => _submitting = true);
    try {
      final alert =
          await ref.read(apiServiceProvider).createEmergencyAlert(
                title: _title.text.trim(),
                content: _content.text.trim(),
                level: _level,
                source: '人工上报',
              );
      if (!mounted) return;
      showAppSnack(context, '告警已上报');
      context.pushReplacement('/alerts/${alert.id}');
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: '上报应急告警',
      body: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          SectionCard(
            title: '告警级别',
            child: Column(
              children: [
                for (final level in const [
                  (1, '一般', AppColors.neutral),
                  (2, '严重', AppColors.warning),
                  (3, '紧急', AppColors.danger),
                ])
                  RadioListTile<int>(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    value: level.$1,
                    groupValue: _level,
                    onChanged: (value) => setState(() => _level = value ?? 2),
                    title: Row(
                      children: [
                        Container(
                          width: 9,
                          height: 9,
                          decoration: BoxDecoration(
                            color: level.$3,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(level.$2,
                            style: const TextStyle(fontSize: 14)),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          SectionCard(
            title: '告警内容',
            child: Column(
              children: [
                TextField(
                  controller: _title,
                  decoration: const InputDecoration(hintText: '告警标题'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _content,
                  maxLines: 5,
                  decoration: const InputDecoration(
                    hintText: '描述现场情况、风险与已采取的措施',
                  ),
                ),
              ],
            ),
          ),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Text('提交告警'),
          ),
        ],
      ),
    );
  }
}

class AlertDetailPage extends ConsumerStatefulWidget {
  const AlertDetailPage({super.key, required this.alertId});

  final String alertId;

  @override
  ConsumerState<AlertDetailPage> createState() => _AlertDetailPageState();
}

class _AlertDetailPageState extends ConsumerState<AlertDetailPage> {
  EmergencyAlert? _alert;
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
      final alert =
          await ref.read(apiServiceProvider).emergencyAlert(widget.alertId);
      if (!mounted) return;
      setState(() {
        _alert = alert;
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

  Future<void> _addProgress() async {
    final note = await showPrompt(
      context,
      title: '添加处置进展',
      hint: '记录已采取的措施与当前状态',
    );
    if (note == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(apiServiceProvider).progressEmergency(
            widget.alertId,
            note: note,
            status: _alert?.status == 'Open' ? 2 : null,
          );
      await _load();
      if (mounted) showAppSnack(context, '进展已记录');
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _close() async {
    final result = await showPrompt(
      context,
      title: '关闭告警',
      hint: '填写处置结果后归档',
      okText: '关闭归档',
    );
    if (result == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(apiServiceProvider)
          .closeEmergency(widget.alertId, result: result);
      await _load();
      if (mounted) showAppSnack(context, '告警已关闭');
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Color _levelColor(String level) => switch (level) {
        'Critical' => AppColors.danger,
        'Serious' => AppColors.warning,
        _ => AppColors.neutral,
      };

  /// 管理员（可读账号列表）才能选择处理人下发处置。
  bool _canDispatch(EmergencyAlert alert) {
    final user = ref.read(currentUserProvider);
    if (user == null) return false;
    final handled = (alert.handlers.isNotEmpty) ||
        (alert.disposalPlan ?? '').isNotEmpty;
    return user.can('support.alert.handle') &&
        user.can('account.user.read') &&
        !handled;
  }

  Future<void> _dispatch() async {
    final api = ref.read(apiServiceProvider);
    List<AdminUserItem> candidates;
    try {
      final page = await api.adminUsers(pageNum: 1, pageSize: 50, status: 1);
      candidates = page.items.where((u) {
        return u.roles.any((r) =>
            r == 'OperationsStaff' || r == 'Pilot' || r == 'Dispatcher');
      }).toList();
      if (candidates.isEmpty) candidates = page.items.take(20).toList();
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, '处理人列表加载失败：${e.message}', error: true);
      return;
    }
    if (!mounted) return;
    if (candidates.isEmpty) {
      showAppSnack(context, '暂无可用处理人', error: true);
      return;
    }

    final selected = <String>{};
    final plan = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('下发处置', style: TextStyle(fontSize: 16)),
          content: SizedBox(
            width: double.maxFinite,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text('选择处理人（可多选）',
                      style: TextStyle(
                          fontSize: 12.5, color: AppColors.textSecondary)),
                ),
                const SizedBox(height: 6),
                SizedBox(
                  height: 180,
                  child: ListView.builder(
                    itemCount: candidates.length,
                    itemBuilder: (context, index) {
                      final candidate = candidates[index];
                      return CheckboxListTile(
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                        value: selected.contains(candidate.id),
                        onChanged: (value) => setDialogState(() {
                          if (value == true) {
                            selected.add(candidate.id);
                          } else {
                            selected.remove(candidate.id);
                          }
                        }),
                        title: Text(
                          candidate.displayName,
                          style: const TextStyle(fontSize: 13.5),
                        ),
                        subtitle: Text(
                          candidate.roles
                              .map((r) => Dict.of(Dict.roleNames, r))
                              .join(' / '),
                          style: const TextStyle(fontSize: 11.5),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: plan,
                  maxLines: 2,
                  decoration: const InputDecoration(hintText: '处置方案'),
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
              child: const Text('下发'),
            ),
          ],
        ),
      ),
    );

    if (confirmed == true) {
      if (selected.isEmpty || plan.text.trim().length < 2) {
        if (mounted) showAppSnack(context, '请选择处理人并填写处置方案', error: true);
      } else {
        setState(() => _busy = true);
        try {
          await api.dispatchEmergency(
                widget.alertId,
                handlers: selected.toList(),
                plan: plan.text.trim(),
              );
          await _load();
          if (mounted) showAppSnack(context, '已下发处置');
        } on ApiException catch (e) {
          if (mounted) showAppSnack(context, e.message, error: true);
        } finally {
          if (mounted) setState(() => _busy = false);
        }
      }
    }
    plan.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final alert = _alert;
    return AppScaffold(
      title: '告警详情',
      body: _loading
          ? const LoadingView()
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(14),
                    children: [
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: _levelColor(alert!.level)
                              .withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: _levelColor(alert.level)
                                .withValues(alpha: 0.4),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(Icons.warning_amber_rounded,
                                    color: _levelColor(alert.level), size: 22),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    alert.title,
                                    style: const TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w700),
                                  ),
                                ),
                                StatusChip(
                                  Dict.of(Dict.emergencyLevelNames, alert.level),
                                  tone: _levelColor(alert.level),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              alert.content,
                              style: const TextStyle(
                                  fontSize: 13.5, height: 1.6),
                            ),
                            const SizedBox(height: 10),
                            Row(
                              children: [
                                StatusChip(Dict.of(
                                    Dict.emergencyStatusNames, alert.status)),
                                const SizedBox(width: 8),
                                if (alert.source != null)
                                  Text(
                                    alert.source!,
                                    style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.textSecondary),
                                  ),
                                const Spacer(),
                                Text(
                                  Fmt.dateTime(
                                      alert.reportedAt ?? alert.createdAt),
                                  style: const TextStyle(
                                      fontSize: 11.5,
                                      color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      SectionCard(
                        title: '处置信息',
                        child: Column(
                          children: [
                            InfoRow('处置人', '${alert.handlers.length} 人'),
                            InfoRow('处置方案', alert.disposalPlan ?? '—'),
                            InfoRow('时限',
                                alert.deadlineAt == null
                                    ? '—'
                                    : Fmt.dateTime(alert.deadlineAt)),
                            if (alert.result != null)
                              InfoRow('处置结果', alert.result!),
                            if (alert.closedAt != null)
                              InfoRow('关闭时间', Fmt.dateTime(alert.closedAt)),
                          ],
                        ),
                      ),
                      if (alert.timeline.isNotEmpty)
                        SectionCard(
                          title: '处置时间线',
                          child: TimelineView(
                            entries: [
                              for (final item in alert.timeline)
                                TimelineEntry(
                                  title: item.action,
                                  subtitle: item.note,
                                  time: Fmt.monthDay(item.at),
                                ),
                            ],
                          ),
                        ),
                      if (alert.isOpen) ...[
                        if (_canDispatch(alert))
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: OutlinedButton.icon(
                              onPressed: _busy ? null : _dispatch,
                              icon: const Icon(Icons.assignment_ind_outlined,
                                  size: 18),
                              label: const Text('下发处置（指派处理人）'),
                            ),
                          ),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: _busy ? null : _close,
                                child: const Text('关闭归档'),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: FilledButton(
                                onPressed: _busy ? null : _addProgress,
                                child: const Text('添加进展'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
    );
  }
}
