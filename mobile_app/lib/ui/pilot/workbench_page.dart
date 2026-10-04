import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/exceptions.dart';
import '../../core/format.dart';
import '../../core/session.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../services/providers.dart';
import '../theme.dart';
import '../widgets/common.dart';

class PilotWorkbenchPage extends ConsumerStatefulWidget {
  const PilotWorkbenchPage({super.key});

  @override
  ConsumerState<PilotWorkbenchPage> createState() => _PilotWorkbenchPageState();
}

class _PilotWorkbenchPageState extends ConsumerState<PilotWorkbenchPage> {
  List<OrderListItem> _pending = const [];
  List<OrderListItem> _inFlight = const [];
  int _todayDelivered = 0;
  int _totalDelivered = 0;
  bool _loading = true;
  String? _error;
  String? _busyId;

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
        api.searchOrders(pageNum: 1, pageSize: 50, status: 'PendingDispatch'),
        api.searchOrders(pageNum: 1, pageSize: 50, status: 'InFlight'),
        api.searchOrders(pageNum: 1, pageSize: 50, status: 'Delivered'),
      ]);
      final today = DateTime.now();
      final delivered = results[2];
      setState(() {
        _pending = results[0].items;
        _inFlight = results[1].items;
        _totalDelivered = delivered.total;
        _todayDelivered = delivered.items.where((order) {
          final at = order.deliveredAt;
          return at != null &&
              at.year == today.year &&
              at.month == today.month &&
              at.day == today.day;
        }).length;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _error = '$e';
      });
    }
  }

  Future<void> _startTask(OrderListItem order) async {
    final confirmed = await showConfirm(
      context,
      title: '接受任务',
      content: '确认接受 ${order.orderNo}（${order.receiverAddress}）并开始飞行？',
    );
    if (!confirmed) return;
    setState(() => _busyId = order.id);
    try {
      await ref.read(apiServiceProvider).startOrder(order.id);
      if (mounted) showAppSnack(context, '任务已接受，开始飞行');
      await _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _declineTask(OrderListItem order) async {
    final reason = await showPrompt(
      context,
      title: '拒绝任务',
      hint: '请填写拒绝原因（同步商家）',
      danger: true,
      okText: '拒绝任务',
    );
    if (reason == null) return;
    setState(() => _busyId = order.id);
    try {
      await ref.read(apiServiceProvider).declineOrder(order.id, reason: reason);
      if (mounted) showAppSnack(context, '已拒绝该任务并退回商家');
      await _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _completeTask(OrderListItem order) async {
    final confirmed = await showConfirm(
      context,
      title: '完成送达',
      content: '确认 ${order.orderNo} 已送达目的地？',
    );
    if (!confirmed) return;
    setState(() => _busyId = order.id);
    try {
      await ref.read(apiServiceProvider)
          .completeOrder(order.id, remark: '机长确认送达');
      if (mounted) showAppSnack(context, '任务已完成');
      await _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busyId = null);
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
                  colors: [Color(0xFF0958D9), Color(0xFF1677FF)],
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
                          Text(
                            '机长工作台',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${user?.displayName ?? ''} · 安全飞行，按规程操作',
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
                      child: Row(
                        children: [
                          Expanded(
                            child: StatTile(
                              label: '待执行',
                              value: '${_pending.length}',
                              unit: '单',
                              color: AppColors.warning,
                            ),
                          ),
                          Expanded(
                            child: StatTile(
                              label: '飞行中',
                              value: '${_inFlight.length}',
                              unit: '单',
                              color: AppColors.processing,
                            ),
                          ),
                          Expanded(
                            child: StatTile(
                              label: '今日完成',
                              value: '$_todayDelivered',
                              unit: '单',
                              color: AppColors.success,
                            ),
                          ),
                          Expanded(
                            child: StatTile(
                              label: '累计完成',
                              value: '$_totalDelivered',
                              unit: '单',
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    SectionCard(
                      padding:
                          const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                      child: Row(
                        children: [
                          Expanded(
                            child: QuickEntry(
                              icon: Icons.build_circle_outlined,
                              label: '故障上报',
                              color: AppColors.danger,
                              onTap: () => context.push('/faults/new'),
                            ),
                          ),
                          Expanded(
                            child: QuickEntry(
                              icon: Icons.warning_amber_rounded,
                              label: '应急告警',
                              color: AppColors.warning,
                              onTap: () => context.push('/alerts'),
                            ),
                          ),
                          Expanded(
                            child: QuickEntry(
                              icon: Icons.history_rounded,
                              label: '飞行记录',
                              onTap: () => context.go('/records'),
                            ),
                          ),
                          Expanded(
                            child: QuickEntry(
                              icon: Icons.radar_rounded,
                              label: '飞行监控',
                              onTap: () => context.go('/monitoring'),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (_loading)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 40),
                        child: LoadingView(text: '加载中…'),
                      )
                    else if (_error != null)
                      SectionCard(
                        child: ErrorView(message: _error!, onRetry: _load),
                      )
                    else ...[
                      _pendingSection(),
                      const SizedBox(height: 12),
                      _inFlightSection(),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _pendingSection() {
    return SectionCard(
      title: '待接任务（滑动接单 / 拒单）',
      child: _pending.isEmpty
          ? const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: EmptyView(
                  text: '暂无待接任务', icon: Icons.task_alt_outlined),
            )
          : Column(
              children: [
                for (final order in _pending)
                  Dismissible(
                    key: ValueKey(order.id),
                    background: _swipeBackground(
                      alignment: Alignment.centerLeft,
                      color: AppColors.success,
                      icon: Icons.play_arrow_rounded,
                      label: '接单起飞',
                    ),
                    secondaryBackground: _swipeBackground(
                      alignment: Alignment.centerRight,
                      color: AppColors.danger,
                      icon: Icons.close_rounded,
                      label: '拒单',
                    ),
                    confirmDismiss: (direction) async {
                      if (_busyId != null) return false;
                      if (direction == DismissDirection.startToEnd) {
                        final confirmed = await showConfirm(
                          context,
                          title: '接受任务',
                          content: '确认接受 ${order.orderNo} 并开始飞行？',
                        );
                        if (confirmed) {
                          await _startTask(order);
                        }
                      } else {
                        await _declineTask(order);
                      }
                      return false;
                    },
                    child: _taskTile(
                      order,
                      onTap: () => context.push('/orders/${order.id}'),
                      trailing: _busyId == order.id
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : null,
                    ),
                  ),
              ],
            ),
    );
  }

  Widget _inFlightSection() {
    return SectionCard(
      title: '执行中任务',
      child: _inFlight.isEmpty
          ? const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: EmptyView(
                  text: '暂无执行中的飞行任务', icon: Icons.airplanemode_inactive),
            )
          : Column(
              children: [
                for (final order in _inFlight)
                  _taskTile(
                    order,
                    tone: AppColors.processing,
                    onTap: () =>
                        context.push('/monitoring?orderId=${order.id}'),
                    trailing: _busyId == order.id
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : TextButton(
                            onPressed: () => _completeTask(order),
                            child: const Text('送达',
                                style: TextStyle(fontSize: 13)),
                          ),
                  ),
              ],
            ),
    );
  }

  Widget _taskTile(
    OrderListItem order, {
    VoidCallback? onTap,
    Widget? trailing,
    Color? tone,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.divider),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: (tone ?? AppColors.warning).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                order.status == 'InFlight'
                    ? Icons.flight_rounded
                    : Icons.assignment_outlined,
                size: 20,
                color: tone ?? AppColors.warning,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          order.orderNo,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 13.5, fontWeight: FontWeight.w600),
                        ),
                      ),
                      const SizedBox(width: 6),
                      StatusChip(
                        Dict.of(Dict.orderStatusNames, order.status),
                        compact: true,
                      ),
                      if (order.isUrgent) ...[
                        const SizedBox(width: 4),
                        const StatusChip('加急',
                            tone: AppColors.danger, compact: true),
                      ],
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    order.receiverAddress,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 12.5, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 6),
            if (trailing != null) trailing,
          ],
        ),
      ),
    );
  }

  Widget _swipeBackground({
    required Alignment alignment,
    required Color color,
    required IconData icon,
    required String label,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 18),
      alignment: alignment,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 22),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

