import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/session.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../services/providers.dart';
import '../theme.dart';
import '../widgets/common.dart';

class CustomerHomePage extends ConsumerStatefulWidget {
  const CustomerHomePage({super.key});

  @override
  ConsumerState<CustomerHomePage> createState() => _CustomerHomePageState();
}

class _CustomerHomePageState extends ConsumerState<CustomerHomePage> {
  final _pageController = PageController();
  Timer? _bannerTimer;
  int _bannerIndex = 0;

  Map<String, int> _statusCounts = const {};
  List<OrderListItem> _recent = const [];
  bool _loading = true;
  String? _error;

  static const _banners = <(String, String, List<Color>)>[
    (
      '低空物流 · 城市速达',
      '下单后自动匹配航线与飞行器，全程可视化追踪',
      [Color(0xFF1677FF), Color(0xFF4096FF)]
    ),
    (
      '空域合规 · 一次申报',
      '飞行计划自动校验禁限飞区，审批进度实时同步',
      [Color(0xFF13C2C2), Color(0xFF36CFC9)]
    ),
    (
      '安全飞行 · 全程监控',
      '轨迹、电量、告警一站式掌握，异常秒级通知',
      [Color(0xFF722ED1), Color(0xFF9254DE)]
    ),
  ];

  @override
  void initState() {
    super.initState();
    _bannerTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted || !_pageController.hasClients) return;
      final next = (_bannerIndex + 1) % _banners.length;
      _pageController.animateToPage(
        next,
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOut,
      );
    });
    _load();
  }

  @override
  void dispose() {
    _bannerTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final api = ref.read(apiServiceProvider);
      final results = await Future.wait([
        api.searchOrders(pageNum: 1, pageSize: 1, status: 'PendingAccept'),
        api.searchOrders(pageNum: 1, pageSize: 1, status: 'PendingDispatch'),
        api.searchOrders(pageNum: 1, pageSize: 1, status: 'InFlight'),
        api.searchOrders(pageNum: 1, pageSize: 5),
      ]);
      setState(() {
        _statusCounts = {
          'PendingAccept': results[0].total,
          'PendingDispatch': results[1].total,
          'InFlight': results[2].total,
        };
        _recent = results[3].items;
        _loading = false;
      });
    } catch (e) {
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
            _header(context, user, unread),
            Transform.translate(
              offset: const Offset(0, -26),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14),
                child: Column(
                  children: [
                    _searchBar(context),
                    const SizedBox(height: 12),
                    _banner(),
                    const SizedBox(height: 12),
                    _quickEntries(context, user),
                    const SizedBox(height: 4),
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
                      _statusSummary(context),
                      const SizedBox(height: 12),
                      _recentOrders(context),
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

  Widget _header(BuildContext context, AuthUser? user, int unread) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 14, 12, 48),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF1677FF), Color(0xFF4096FF)],
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
                    '你好，${user?.displayName ?? '用户'}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 19,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    '欢迎使用天枢低空物流服务',
                    style: TextStyle(
                      color: Color(0xCCFFFFFF),
                      fontSize: 12.5,
                    ),
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
    );
  }

  Widget _searchBar(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/orders?focus=search'),
      child: Container(
        height: 46,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: const [
            BoxShadow(
              color: Color(0x14000000),
              blurRadius: 12,
              offset: Offset(0, 4),
            ),
          ],
        ),
        child: const Row(
          children: [
            Icon(Icons.search_rounded, size: 20, color: AppColors.textSecondary),
            SizedBox(width: 8),
            Text(
              '搜索订单号 / 收件地址',
              style: TextStyle(fontSize: 13.5, color: AppColors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _banner() {
    return SizedBox(
      height: 108,
      child: PageView.builder(
        controller: _pageController,
        onPageChanged: (index) => _bannerIndex = index,
        itemCount: _banners.length,
        itemBuilder: (context, index) {
          final banner = _banners[index];
          return Container(
            margin: const EdgeInsets.symmetric(horizontal: 2),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: banner.$3,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        banner.$1,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        banner.$2,
                        style: const TextStyle(
                          color: Color(0xD9FFFFFF),
                          fontSize: 12,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.flight_rounded,
                    color: Color(0x66FFFFFF), size: 54),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _quickEntries(BuildContext context, AuthUser? user) {
    return SectionCard(
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
      child: Row(
        children: [
          Expanded(
            child: QuickEntry(
              icon: Icons.add_box_outlined,
              label: '快速下单',
              onTap: () => context.push('/orders/create'),
            ),
          ),
          Expanded(
            child: QuickEntry(
              icon: Icons.receipt_long_outlined,
              label: '我的订单',
              onTap: () => context.go('/orders'),
            ),
          ),
          Expanded(
            child: QuickEntry(
              icon: Icons.support_agent_outlined,
              label: '客服工单',
              onTap: () => context.push('/tickets'),
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
    );
  }

  Widget _statusSummary(BuildContext context) {
    const items = <(String, String, Color)>[
      ('PendingAccept', '待接单', AppColors.warning),
      ('PendingDispatch', '待调度', AppColors.processing),
      ('InFlight', '飞行中', AppColors.success),
    ];
    return SectionCard(
      title: '订单状态',
      child: Row(
        children: [
          for (final item in items)
            Expanded(
              child: InkWell(
                onTap: () => context.push('/orders?status=${item.$1}'),
                borderRadius: BorderRadius.circular(8),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Column(
                    children: [
                      Text(
                        '${_statusCounts[item.$1] ?? 0}',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          color: item.$3,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        item.$2,
                        style: const TextStyle(
                          fontSize: 12.5,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _recentOrders(BuildContext context) {
    return SectionCard(
      title: '最近订单',
      trailing: TextButton(
        onPressed: () => context.go('/orders'),
        child: const Text('查看全部', style: TextStyle(fontSize: 13)),
      ),
      child: _recent.isEmpty
          ? const Padding(
              padding: EdgeInsets.symmetric(vertical: 18),
              child: EmptyView(text: '还没有订单，去下一单吧', icon: Icons.receipt_long_outlined),
            )
          : Column(
              children: [
                for (final order in _recent)
                  InkWell(
                    onTap: () => context.push('/orders/${order.id}'),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      order.orderNo,
                                      style: const TextStyle(
                                        fontSize: 13.5,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    if (order.isUrgent) ...[
                                      const SizedBox(width: 6),
                                      const StatusChip('加急',
                                          tone: AppColors.danger, compact: true),
                                    ],
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${order.receiverAddress} · ${Fmt.monthDay(order.createdAt)}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 12.5,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              StatusChip(
                                  Dict.of(Dict.orderStatusNames, order.status),
                                  compact: true),
                              const SizedBox(height: 4),
                              Text(
                                Fmt.amount(order.totalAmount),
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}
