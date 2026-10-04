import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/exceptions.dart';
import '../../core/format.dart';
import '../../core/paged_list.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../theme.dart';
import '../widgets/common.dart';

class InvoicesPage extends ConsumerStatefulWidget {
  const InvoicesPage({super.key});

  @override
  ConsumerState<InvoicesPage> createState() => _InvoicesPageState();
}

class _InvoicesPageState extends ConsumerState<InvoicesPage> {
  late final PagedList<InvoiceItem> _list;

  @override
  void initState() {
    super.initState();
    _list = PagedList(
      loader: (pageNum, pageSize) => ref
          .read(apiServiceProvider)
          .invoices(pageNum: pageNum, pageSize: pageSize),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: '我的发票',
      actions: [
        IconButton(
          onPressed: _applyDialog,
          icon: const Icon(Icons.add_rounded),
        ),
      ],
      body: PagedListView<InvoiceItem>(
        list: _list,
        emptyText: '暂无发票申请',
        emptyIcon: Icons.request_quote_outlined,
        itemBuilder: (context, invoice, index) => Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        invoice.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 14.5, fontWeight: FontWeight.w600),
                      ),
                    ),
                    StatusChip(
                      Dict.of(Dict.invoiceStatusNames, invoice.status),
                      compact: true,
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  '税号：${invoice.taxNo}',
                  style: const TextStyle(
                      fontSize: 12.5, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    Text(
                      Fmt.amount(invoice.amount),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.danger,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '${invoice.orderIds.length} 笔订单 · ${Fmt.monthDay(invoice.createdAt)}',
                      style: const TextStyle(
                          fontSize: 11.5, color: AppColors.textSecondary),
                    ),
                  ],
                ),
                if (invoice.status == 'Issued' &&
                    (invoice.invoiceNo ?? '').isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    '发票号：${invoice.invoiceNo}',
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textSecondary),
                  ),
                ],
                if (invoice.status == 'Rejected' &&
                    (invoice.rejectedReason ?? '').isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    '驳回原因：${invoice.rejectedReason}',
                    style:
                        const TextStyle(fontSize: 12, color: AppColors.danger),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _applyDialog() async {
    final selected = <String>{};
    final title = TextEditingController();
    final taxNo = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) {
          return AlertDialog(
            title: const Text('申请开票', style: TextStyle(fontSize: 16)),
            content: SizedBox(
              width: double.maxFinite,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: title,
                    decoration: const InputDecoration(hintText: '发票抬头'),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: taxNo,
                    decoration: const InputDecoration(hintText: '税号'),
                  ),
                  const SizedBox(height: 10),
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: Text('选择可开票订单（已送达且已支付）',
                        style: TextStyle(
                            fontSize: 12, color: AppColors.textSecondary)),
                  ),
                  const SizedBox(height: 6),
                  SizedBox(
                    height: 200,
                    child: _InvoiceOrderPicker(
                      selected: selected,
                      onToggle: (id, checked) => setDialogState(() {
                        if (checked) {
                          selected.add(id);
                        } else {
                          selected.remove(id);
                        }
                      }),
                    ),
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
                child: const Text('提交申请'),
              ),
            ],
          );
        },
      ),
    );

    if (confirmed == true) {
      if (selected.isEmpty) {
        if (mounted) showAppSnack(context, '请选择至少一笔订单', error: true);
      } else if (title.text.trim().isEmpty || taxNo.text.trim().isEmpty) {
        if (mounted) showAppSnack(context, '请填写抬头与税号', error: true);
      } else {
        try {
          await ref.read(apiServiceProvider).applyInvoice(
                orderIds: selected.toList(),
                title: title.text.trim(),
                taxNo: taxNo.text.trim(),
              );
          if (mounted) {
            showAppSnack(context, '发票申请已提交');
            await _list.refresh();
          }
        } on ApiException catch (e) {
          if (mounted) showAppSnack(context, e.message, error: true);
        }
      }
    }
    title.dispose();
    taxNo.dispose();
  }
}

class _InvoiceOrderPicker extends ConsumerStatefulWidget {
  const _InvoiceOrderPicker({required this.selected, required this.onToggle});

  final Set<String> selected;
  final void Function(String id, bool checked) onToggle;

  @override
  ConsumerState<_InvoiceOrderPicker> createState() =>
      _InvoiceOrderPickerState();
}

class _InvoiceOrderPickerState extends ConsumerState<_InvoiceOrderPicker> {
  List<OrderListItem> _orders = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final page = await ref
          .read(apiServiceProvider)
          .searchOrders(pageNum: 1, pageSize: 50, status: 'Delivered');
      if (!mounted) return;
      setState(() {
        _orders = page.items;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const LoadingView();
    if (_orders.isEmpty) {
      return const EmptyView(text: '暂无可开票订单', icon: Icons.receipt_outlined);
    }
    return ListView.builder(
      itemCount: _orders.length,
      itemBuilder: (context, index) {
        final order = _orders[index];
        return CheckboxListTile(
          dense: true,
          contentPadding: EdgeInsets.zero,
          value: widget.selected.contains(order.id),
          onChanged: (value) => widget.onToggle(order.id, value ?? false),
          title: Text(order.orderNo,
              style: const TextStyle(fontSize: 13.5)),
          subtitle: Text(
            '${order.receiverAddress} · ${Fmt.amount(order.totalAmount)}',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 12),
          ),
        );
      },
    );
  }
}
