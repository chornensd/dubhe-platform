import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/exceptions.dart';
import '../../core/format.dart';
import '../../core/permissions.dart';
import '../../core/session.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../theme.dart';
import '../widgets/app_map.dart';
import '../widgets/common.dart';

class OrderDetailPage extends ConsumerStatefulWidget {
  const OrderDetailPage({super.key, required this.orderId});

  final String orderId;

  @override
  ConsumerState<OrderDetailPage> createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends ConsumerState<OrderDetailPage> {
  OrderDetail? _order;
  List<PaymentRecord> _payments = const [];
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
      final order = await api.orderDetail(widget.orderId);
      List<PaymentRecord> payments = const [];
      try {
        payments = await api.orderPayments(widget.orderId);
      } on ApiException {
        payments = const [];
      }
      if (!mounted) return;
      setState(() {
        _order = order;
        _payments = payments;
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

  Future<void> _run(Future<Object?> Function() action,
      {String success = '操作成功'}) async {
    setState(() => _busy = true);
    try {
      await action();
      if (!mounted) return;
      showAppSnack(context, success);
      await _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    final order = _order;

    return AppScaffold(
      title: '订单详情',
      body: _loading
          ? const LoadingView(text: '加载中…')
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(14, 12, 14, 30),
                    children: [
                      _statusHeader(order!),
                      const SizedBox(height: 12),
                      _mapCard(order),
                      const SizedBox(height: 12),
                      _addressCard(order),
                      const SizedBox(height: 12),
                      _itemCard(order),
                      const SizedBox(height: 12),
                      _feeCard(order),
                      const SizedBox(height: 12),
                      _paymentCard(order),
                      const SizedBox(height: 12),
                      _timelineCard(order),
                      if (order.rating != null) ...[
                        const SizedBox(height: 12),
                        SectionCard(
                          title: '客户评价',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              StarRating(value: order.rating!),
                              if ((order.reviewComment ?? '').isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(top: 8),
                                  child: Text(order.reviewComment!,
                                      style: const TextStyle(fontSize: 13.5)),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
      bottomNavigationBar:
          (_loading || _error != null || order == null || user == null)
              ? null
              : _actions(user, order),
    );
  }

  Widget _statusHeader(OrderDetail order) {
    final tone = AppColors.toneOf(order.status);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [tone, tone.withValues(alpha: 0.75)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                Dict.of(Dict.orderStatusNames, order.status),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              if (order.isUrgent)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.22),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text('加急',
                      style: TextStyle(color: Colors.white, fontSize: 12)),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Text(
                order.orderNo,
                style: const TextStyle(color: Color(0xD9FFFFFF), fontSize: 13),
              ),
              const SizedBox(width: 6),
              GestureDetector(
                onTap: () {
                  Clipboard.setData(ClipboardData(text: order.orderNo));
                  showAppSnack(context, '订单号已复制');
                },
                child: const Icon(Icons.copy_rounded,
                    color: Color(0xD9FFFFFF), size: 15),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            _statusHint(order),
            style: const TextStyle(
              color: Color(0xE6FFFFFF),
              fontSize: 12.5,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  String _statusHint(OrderDetail order) {
    switch (order.status) {
      case 'PendingAccept':
        return '订单已提交，等待商家接单';
      case 'PendingDispatch':
        return order.pilotId != null ? '已分配机长与飞行器，等待起飞' : '商家已接单，等待调度飞行器';
      case 'InFlight':
        return '飞行任务执行中，可在监控页查看实时轨迹';
      case 'Delivered':
        return '订单已送达${order.rating == null ? '，快去评价吧' : ''}';
      case 'Cancelled':
        return order.cancelReason ?? '订单已取消';
      default:
        return '';
    }
  }

  Widget _mapCard(OrderDetail order) {
    return SectionCard(
      title: '配送轨迹',
      child: AppMap(
        height: 210,
        path: order.plannedRoute,
        markers: [
          MapMarker(
            lat: order.sender.lat,
            lng: order.sender.lng,
            color: AppColors.success,
          ),
          MapMarker(
            lat: order.receiver.lat,
            lng: order.receiver.lng,
            color: AppColors.warning,
            pulse: order.status == 'InFlight',
          ),
        ],
        showLegend: false,
      ),
    );
  }

  Widget _addressCard(OrderDetail order) {
    return SectionCard(
      title: '寄收信息',
      child: Column(
        children: [
          InfoRow('寄件人', order.sender.name),
          InfoRow('寄件电话', order.sender.phone),
          InfoRow('寄件地址', order.sender.address),
          const Divider(height: 18),
          InfoRow('收件人', order.receiver.name),
          InfoRow('收件电话', order.receiver.phone),
          InfoRow('收件地址', order.receiver.address),
        ],
      ),
    );
  }

  Widget _itemCard(OrderDetail order) {
    final categoryName = Dict.of(
      {for (final c in Dict.itemCategories) c.key: c.value},
      order.itemCategory,
    );
    return SectionCard(
      title: '物品信息',
      child: Column(
        children: [
          InfoRow('物品类型', categoryName),
          InfoRow('物品名称', order.itemName),
          InfoRow('重量', '${Fmt.number(order.weightKg)} kg'),
          InfoRow('体积', '${Fmt.number(order.volumeM3, digits: 2)} m³'),
          InfoRow('数量', '${order.quantity}'),
          InfoRow('时效', order.isUrgent ? '加急配送' : '标准配送'),
          InfoRow('预约时间',
              order.scheduledAt == null ? '立即配送' : Fmt.dateTime(order.scheduledAt)),
          if ((order.remark ?? '').isNotEmpty) InfoRow('备注', order.remark!),
          if (order.merchantName != null) InfoRow('运营商家', order.merchantName!),
          if (order.dispatchRemark != null)
            InfoRow('调度说明', order.dispatchRemark!),
        ],
      ),
    );
  }

  Widget _feeCard(OrderDetail order) {
    final fee = order.fee;
    return SectionCard(
      title: '费用明细',
      child: Column(
        children: [
          InfoRow('配送距离', Fmt.distanceKm(fee.distanceKm)),
          InfoRow('基础费', Fmt.amount(fee.baseFee)),
          InfoRow('距离费', Fmt.amount(fee.distanceFee)),
          InfoRow('重量费', Fmt.amount(fee.weightFee)),
          InfoRow('空域费', Fmt.amount(fee.airspaceFee)),
          if (fee.urgentFee > 0) InfoRow('加急费', Fmt.amount(fee.urgentFee)),
          if (fee.discountAmount > 0)
            InfoRow('优惠抵扣', '-${Fmt.amount(fee.discountAmount)}',
                valueColor: AppColors.success),
          const Divider(height: 18),
          Row(
            children: [
              const Text('订单总价', style: TextStyle(fontSize: 14)),
              const Spacer(),
              Text(
                Fmt.amount(fee.totalAmount),
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.danger,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _paymentCard(OrderDetail order) {
    return SectionCard(
      title: '支付信息',
      child: Column(
        children: [
          InfoRow(
            '支付状态',
            Dict.of(Dict.paymentStatusNames, order.paymentStatus),
            valueColor: AppColors.toneOf(order.paymentStatus),
          ),
          if (order.paidAt != null) InfoRow('支付时间', Fmt.dateTime(order.paidAt)),
          if (_payments.isNotEmpty) ...[
            const Divider(height: 18),
            for (final payment in _payments)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${Dict.of(Dict.paymentMethodNames, payment.method)} · ${Fmt.monthDay(payment.createdAt)}',
                        style: const TextStyle(fontSize: 13),
                      ),
                    ),
                    Text(
                      Fmt.amount(payment.amount),
                      style: const TextStyle(fontSize: 13),
                    ),
                    const SizedBox(width: 8),
                    StatusChip(
                      Dict.of(Dict.paymentStatusNames, payment.status,
                          fallback: payment.status),
                      compact: true,
                    ),
                  ],
                ),
              ),
          ],
        ],
      ),
    );
  }

  Widget _timelineCard(OrderDetail order) {
    final entries = [
      for (final item in order.history.reversed)
        TimelineEntry(
          title: Dict.of(Dict.orderStatusNames, item.toStatus),
          subtitle: item.remark,
          time: Fmt.monthDay(item.at),
          color: AppColors.toneOf(item.toStatus),
        ),
    ];
    return SectionCard(
      title: '订单动态',
      child: TimelineView(entries: entries),
    );
  }

  Widget? _actions(AuthUser user, OrderDetail order) {
    final isCustomer = user.id == order.customerId;
    final isPilot = order.pilotId == user.id;
    final canPilot = isPilot;
    final buttons = <Widget>[];

    if (isCustomer && order.isUnpaid && order.status != 'Cancelled') {
      buttons.add(
        Expanded(
          child: FilledButton(
            onPressed: _busy ? null : () => _payDialog(order),
            child: const Text('去支付'),
          ),
        ),
      );
    }

    if ((canPilot || user.can('order.dispatch')) &&
        order.status == 'PendingDispatch') {
      buttons.add(
        Expanded(
          child: FilledButton(
            onPressed: _busy
                ? null
                : () => _run(() => ref
                    .read(apiServiceProvider)
                    .startOrder(order.id), success: '已开始飞行'),
            child: const Text('开始飞行'),
          ),
        ),
      );
    }

    if ((canPilot || user.can('order.dispatch')) &&
        order.status == 'InFlight') {
      buttons.add(
        Expanded(
          child: FilledButton(
            onPressed: _busy ? null : () => _completeDialog(order),
            child: const Text('完成送达'),
          ),
        ),
      );
    }

    if (canPilot && order.status == 'PendingDispatch') {
      buttons.add(
        Expanded(
          child: OutlinedButton(
            onPressed: _busy
                ? null
                : () async {
                    final reason = await showPrompt(
                      context,
                      title: '拒绝任务',
                      hint: '请填写拒绝原因（同步商家）',
                      danger: true,
                    );
                    if (reason == null) return;
                    await _run(
                      () => ref
                          .read(apiServiceProvider)
                          .declineOrder(order.id, reason: reason),
                      success: '已退回任务',
                    );
                  },
            child: const Text('拒绝任务'),
          ),
        ),
      );
    }

    if (user.can('order.accept') && order.status == 'PendingAccept') {
      buttons.add(
        Expanded(
          child: FilledButton(
            onPressed: _busy
                ? null
                : () => _run(() => ref
                    .read(apiServiceProvider)
                    .acceptOrder(order.id), success: '已接单'),
            child: const Text('接单'),
          ),
        ),
      );
      buttons.add(
        Expanded(
          child: OutlinedButton(
            onPressed: _busy
                ? null
                : () async {
                    final reason = await showPrompt(
                      context,
                      title: '拒单',
                      hint: '请填写拒单原因（同步客户）',
                      danger: true,
                    );
                    if (reason == null) return;
                    await _run(
                      () => ref
                          .read(apiServiceProvider)
                          .rejectOrder(order.id, reason),
                      success: '已拒单',
                    );
                  },
            child: const Text('拒单'),
          ),
        ),
      );
    }

    if (isCustomer && order.status == 'Delivered' && order.rating == null) {
      buttons.add(
        Expanded(
          child: FilledButton(
            onPressed: _busy ? null : () => _reviewDialog(order),
            child: const Text('评价'),
          ),
        ),
      );
    }

    if (isCustomer && order.isActive) {
      buttons.add(
        Expanded(
          child: OutlinedButton(
            onPressed: _busy
                ? null
                : () async {
                    final confirmed = await showConfirm(
                      context,
                      title: '取消订单',
                      content: '订单取消后不可恢复，确定继续？',
                      okText: '取消订单',
                      danger: true,
                    );
                    if (!confirmed) return;
                    await _run(
                      () => ref
                          .read(apiServiceProvider)
                          .cancelOrder(order.id, reason: '客户取消'),
                      success: '订单已取消',
                    );
                  },
            child: const Text('取消订单'),
          ),
        ),
      );
    }

    buttons.add(
      SizedBox(
        width: 46,
        child: OutlinedButton(
          style: OutlinedButton.styleFrom(
            padding: EdgeInsets.zero,
            minimumSize: const Size(46, 46),
          ),
          onPressed: () => context.push('/tickets/new?orderId=${order.id}'),
          child: const Icon(Icons.headset_mic_outlined, size: 20),
        ),
      ),
    );

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.divider)),
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            for (var i = 0; i < buttons.length; i++) ...[
              buttons[i],
              if (i != buttons.length - 1) const SizedBox(width: 10),
            ],
          ],
        ),
      ),
    );
  }

  Future<void> _payDialog(OrderDetail order) async {
    var method = 1;
    var simulateFailure = false;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('订单支付', style: TextStyle(fontSize: 16)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '应付金额 ${Fmt.amount(order.fee.totalAmount)}',
                style: const TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 12),
              for (final item in const [
                (1, '微信支付'),
                (2, '支付宝'),
                (3, '对公转账'),
              ])
                RadioListTile<int>(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  value: item.$1,
                  groupValue: method,
                  onChanged: (value) =>
                      setDialogState(() => method = value ?? 1),
                  title:
                      Text(item.$2, style: const TextStyle(fontSize: 14)),
                ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                value: simulateFailure,
                onChanged: (value) =>
                    setDialogState(() => simulateFailure = value),
                title: const Text('模拟支付失败', style: TextStyle(fontSize: 13)),
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
              child: const Text('确认支付'),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true) return;
    await _run(
      () => ref.read(apiServiceProvider).payOrder(
            order.id,
            method: method,
            simulateFailure: simulateFailure,
            failureReason: simulateFailure ? '用户选择模拟支付失败' : null,
          ),
      success: simulateFailure ? '支付流程已触发（模拟失败）' : '支付成功',
    );
  }

  Future<void> _completeDialog(OrderDetail order) async {
    final remark = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('完成送达', style: TextStyle(fontSize: 16)),
        content: TextField(
          controller: remark,
          maxLines: 2,
          decoration: const InputDecoration(hintText: '送达说明（可选）'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('确认送达'),
          ),
        ],
      ),
    );
    if (confirmed != true) {
      remark.dispose();
      return;
    }
    await _run(
      () => ref.read(apiServiceProvider).completeOrder(
            order.id,
            remark: remark.text.trim().isEmpty ? null : remark.text.trim(),
          ),
      success: '订单已送达',
    );
    remark.dispose();
  }

  Future<void> _reviewDialog(OrderDetail order) async {
    var rating = 5;
    final comment = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('服务评价', style: TextStyle(fontSize: 16)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              StarInput(
                value: rating,
                onChanged: (value) => setDialogState(() => rating = value),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: comment,
                maxLines: 3,
                decoration: const InputDecoration(hintText: '评价内容（可选）'),
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
              child: const Text('提交评价'),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true) {
      comment.dispose();
      return;
    }
    await _run(
      () => ref.read(apiServiceProvider).reviewOrder(
            order.id,
            rating,
            comment: comment.text.trim().isEmpty ? null : comment.text.trim(),
          ),
      success: '感谢您的评价',
    );
    comment.dispose();
  }
}
