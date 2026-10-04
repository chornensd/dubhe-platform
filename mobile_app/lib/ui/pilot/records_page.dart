import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/paged_list.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/order_card.dart';

/// 机长记录：飞行记录 + 故障记录。
class PilotRecordsPage extends ConsumerStatefulWidget {
  const PilotRecordsPage({super.key, this.initialTab = 0});

  final int initialTab;

  @override
  ConsumerState<PilotRecordsPage> createState() => _PilotRecordsPageState();
}

class _PilotRecordsPageState extends ConsumerState<PilotRecordsPage> {
  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      initialIndex: widget.initialTab,
      child: AppScaffold(
        title: '我的记录',
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () => context.push('/faults/new'),
          icon: const Icon(Icons.build_outlined, size: 20),
          label: const Text('故障上报'),
        ),
        body: Column(
          children: [
            Container(
              color: Colors.white,
              child: const TabBar(
                tabs: [Tab(text: '飞行记录'), Tab(text: '故障记录')],
              ),
            ),
            const Expanded(
              child: TabBarView(
                children: [_FlightsTab(), _FaultsTab()],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FlightsTab extends ConsumerStatefulWidget {
  const _FlightsTab();

  @override
  ConsumerState<_FlightsTab> createState() => _FlightsTabState();
}

class _FlightsTabState extends ConsumerState<_FlightsTab>
    with AutomaticKeepAliveClientMixin {
  late final PagedList<OrderListItem> _list;
  int _todayCount = 0;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _list = PagedList(
      loader: (pageNum, pageSize) => ref
          .read(apiServiceProvider)
          .searchOrders(pageNum: pageNum, pageSize: pageSize, status: 'Delivered'),
    );
    _loadToday();
  }

  Future<void> _loadToday() async {
    try {
      final page = await ref
          .read(apiServiceProvider)
          .searchOrders(pageNum: 1, pageSize: 50, status: 'Delivered');
      final now = DateTime.now();
      if (!mounted) return;
      setState(() {
        _todayCount = page.items.where((order) {
          final at = order.deliveredAt;
          return at != null &&
              at.year == now.year &&
              at.month == now.month &&
              at.day == now.day;
        }).length;
      });
    } catch (_) {
      // 忽略
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return PagedListView<OrderListItem>(
      list: _list,
      header: SectionCard(
        child: Row(
          children: [
            Expanded(
              child: StatTile(
                label: '累计完成架次',
                value: '${_list.total}',
                unit: '次',
              ),
            ),
            Expanded(
              child: StatTile(
                label: '今日完成',
                value: '$_todayCount',
                unit: '次',
                color: AppColors.success,
              ),
            ),
          ],
        ),
      ),
      emptyText: '暂无飞行记录',
      emptyIcon: Icons.history_rounded,
      itemBuilder: (context, order, index) => OrderCard(
        order: order,
        trailing: Text(
          order.deliveredAt == null
              ? '—'
              : '送达 ${Fmt.monthDay(order.deliveredAt)}',
          style:
              const TextStyle(fontSize: 12, color: AppColors.textSecondary),
        ),
        onTap: () => context.push('/orders/${order.id}'),
      ),
    );
  }
}

class _FaultsTab extends ConsumerStatefulWidget {
  const _FaultsTab();

  @override
  ConsumerState<_FaultsTab> createState() => _FaultsTabState();
}

class _FaultsTabState extends ConsumerState<_FaultsTab>
    with AutomaticKeepAliveClientMixin {
  late final PagedList<FaultItem> _list;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _list = PagedList(
      loader: (pageNum, pageSize) => ref
          .read(apiServiceProvider)
          .faults(pageNum: pageNum, pageSize: pageSize),
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return PagedListView<FaultItem>(
      list: _list,
      emptyText: '暂无故障记录，可点击右下角上报',
      emptyIcon: Icons.build_outlined,
      itemBuilder: (context, fault, index) => Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => context.push('/faults/${fault.id}'),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        fault.faultType,
                        style: const TextStyle(
                            fontSize: 14.5, fontWeight: FontWeight.w600),
                      ),
                    ),
                    StatusChip(
                        Dict.of(Dict.faultStatusNames, fault.status),
                        compact: true),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  fault.description,
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
                    Text(
                      '飞行器 ${fault.droneId.substring(0, 8)}…',
                      style: const TextStyle(
                          fontSize: 11.5, color: AppColors.textSecondary),
                    ),
                    const Spacer(),
                    Text(
                      Fmt.monthDay(fault.reportedAt),
                      style: const TextStyle(
                          fontSize: 11.5, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
