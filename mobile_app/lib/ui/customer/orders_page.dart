import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/paged_list.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/order_card.dart';

class CustomerOrdersPage extends ConsumerStatefulWidget {
  const CustomerOrdersPage({super.key, this.initialStatus, this.initialKeyword});

  final String? initialStatus;
  final String? initialKeyword;

  @override
  ConsumerState<CustomerOrdersPage> createState() => _CustomerOrdersPageState();
}

class _CustomerOrdersPageState extends ConsumerState<CustomerOrdersPage> {
  static const _statuses = <(String?, String)>[
    (null, '全部'),
    ('PendingAccept', '待接单'),
    ('PendingDispatch', '待调度'),
    ('InFlight', '飞行中'),
    ('Delivered', '已送达'),
    ('Cancelled', '已取消'),
  ];

  String? _status;
  late final TextEditingController _keyword;
  bool _searching = false;
  late PagedList<OrderListItem> _list;

  @override
  void initState() {
    super.initState();
    _status = widget.initialStatus;
    _keyword = TextEditingController(text: widget.initialKeyword ?? '');
    _searching = (widget.initialKeyword ?? '').isNotEmpty;
    _createList();
  }

  void _createList() {
    final status = _status;
    final keyword = _keyword.text.trim();
    _list = PagedList(
      loader: (pageNum, pageSize) => ref.read(apiServiceProvider).searchOrders(
            pageNum: pageNum,
            pageSize: pageSize,
            status: status,
            keyword: keyword.isEmpty ? null : keyword,
          ),
    );
  }

  @override
  void dispose() {
    _keyword.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: '我的订单',
      actions: [
        IconButton(
          onPressed: () => setState(() => _searching = !_searching),
          icon: Icon(
            _searching ? Icons.close_rounded : Icons.search_rounded,
            size: 22,
          ),
        ),
      ],
      body: Column(
        children: [
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(0, 6, 0, 8),
            child: Column(
              children: [
                SizedBox(
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
                        onTap: () {
                          setState(() {
                            _status = item.$1;
                            _createList();
                          });
                        },
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
                              fontWeight: selected
                                  ? FontWeight.w600
                                  : FontWeight.w400,
                              color: selected
                                  ? Colors.white
                                  : AppColors.text,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
                if (_searching)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
                    child: TextField(
                      controller: _keyword,
                      autofocus: true,
                      textInputAction: TextInputAction.search,
                      onSubmitted: (_) => setState(_createList),
                      decoration: InputDecoration(
                        hintText: '订单号 / 收件地址',
                        prefixIcon:
                            const Icon(Icons.search_rounded, size: 19),
                        suffixIcon: IconButton(
                          icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                          onPressed: () => setState(_createList),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: PagedListView<OrderListItem>(
              key: ValueKey('${_status ?? 'all'}|${_keyword.text.trim()}'),
              list: _list,
              emptyText: '暂无符合条件的订单',
              itemBuilder: (context, order, index) => OrderCard(
                order: order,
                onTap: () => context.push('/orders/${order.id}'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
