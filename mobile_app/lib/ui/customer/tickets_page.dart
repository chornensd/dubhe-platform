import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/exceptions.dart';
import '../../core/format.dart';
import '../../core/paged_list.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../theme.dart';
import '../widgets/common.dart';

class TicketsPage extends ConsumerStatefulWidget {
  const TicketsPage({super.key});

  @override
  ConsumerState<TicketsPage> createState() => _TicketsPageState();
}

class _TicketsPageState extends ConsumerState<TicketsPage> {
  static const _statuses = <(int?, String)>[
    (null, '全部'),
    (1, '待处理'),
    (2, '处理中'),
    (3, '已完成'),
    (4, '已关闭'),
  ];

  int? _status;
  late PagedList<ServiceTicket> _list;

  @override
  void initState() {
    super.initState();
    _list = _createList();
  }

  PagedList<ServiceTicket> _createList() {
    final status = _status;
    return PagedList(
      loader: (pageNum, pageSize) => ref
          .read(apiServiceProvider)
          .tickets(pageNum: pageNum, pageSize: pageSize, status: status),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: '客服工单',
      actions: [
        IconButton(
          onPressed: () => context.push('/tickets/new'),
          icon: const Icon(Icons.add_rounded),
        ),
      ],
      body: Column(
        children: [
          SizedBox(
            height: 48,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
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
            child: PagedListView<ServiceTicket>(
              key: ValueKey(_status),
              list: _list,
              emptyText: '暂无工单，遇到问题可随时提交',
              emptyIcon: Icons.support_agent_outlined,
              itemBuilder: (context, ticket, index) => Material(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: () => context.push('/tickets/${ticket.id}'),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                ticket.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            StatusChip(
                              Dict.of(Dict.ticketStatusNames, ticket.status),
                              compact: true,
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          ticket.content,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                            height: 1.5,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            StatusChip(
                              Dict.of(Dict.ticketTypeNames, ticket.type),
                              tone: AppColors.textSecondary,
                              compact: true,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              ticket.ticketNo,
                              style: const TextStyle(
                                  fontSize: 11.5,
                                  color: AppColors.textSecondary),
                            ),
                            const Spacer(),
                            Text(
                              Fmt.monthDay(ticket.createdAt),
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

class TicketCreatePage extends ConsumerStatefulWidget {
  const TicketCreatePage({super.key, this.orderId});

  final String? orderId;

  @override
  ConsumerState<TicketCreatePage> createState() => _TicketCreatePageState();
}

class _TicketCreatePageState extends ConsumerState<TicketCreatePage> {
  final _title = TextEditingController();
  final _content = TextEditingController();
  final _orderId = TextEditingController();
  int _type = 2;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _orderId.text = widget.orderId ?? '';
  }

  @override
  void dispose() {
    _title.dispose();
    _content.dispose();
    _orderId.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_title.text.trim().isEmpty) {
      showAppSnack(context, '请填写标题', error: true);
      return;
    }
    if (_content.text.trim().length < 5) {
      showAppSnack(context, '请详细描述问题（至少 5 个字）', error: true);
      return;
    }
    setState(() => _submitting = true);
    try {
      final ticket = await ref.read(apiServiceProvider).createTicket(
            type: _type,
            title: _title.text.trim(),
            content: _content.text.trim(),
            orderId: _orderId.text.trim().isEmpty ? null : _orderId.text.trim(),
          );
      if (!mounted) return;
      showAppSnack(context, '工单已提交');
      context.pushReplacement('/tickets/${ticket.id}');
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: '提交工单',
      body: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          SectionCard(
            title: '工单类型',
            child: Wrap(
              spacing: 10,
              children: [
                for (final type in const [
                  (1, '投诉'),
                  (2, '咨询'),
                  (3, '建议'),
                ])
                  ChoiceChip(
                    label: Text(type.$2),
                    selected: _type == type.$1,
                    onSelected: (_) => setState(() => _type = type.$1),
                  ),
              ],
            ),
          ),
          SectionCard(
            title: '问题描述',
            child: Column(
              children: [
                TextField(
                  controller: _title,
                  decoration: const InputDecoration(hintText: '标题'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _content,
                  maxLines: 6,
                  decoration: const InputDecoration(
                    hintText: '请描述遇到的问题、发生时间与期望结果',
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _orderId,
                  decoration:
                      const InputDecoration(hintText: '关联订单号（可选，可留空）'),
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
                : const Text('提交工单'),
          ),
        ],
      ),
    );
  }
}

class TicketDetailPage extends ConsumerStatefulWidget {
  const TicketDetailPage({super.key, required this.ticketId});

  final String ticketId;

  @override
  ConsumerState<TicketDetailPage> createState() => _TicketDetailPageState();
}

class _TicketDetailPageState extends ConsumerState<TicketDetailPage> {
  ServiceTicket? _ticket;
  bool _loading = true;
  String? _error;
  bool _sending = false;
  final _reply = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _reply.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final ticket = await ref.read(apiServiceProvider).ticket(widget.ticketId);
      if (!mounted) return;
      setState(() {
        _ticket = ticket;
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

  Future<void> _sendReply() async {
    final content = _reply.text.trim();
    if (content.isEmpty) return;
    setState(() => _sending = true);
    try {
      await ref.read(apiServiceProvider).replyTicket(widget.ticketId, content);
      _reply.clear();
      await _load();
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _rate() async {
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
              TextField(
                controller: comment,
                maxLines: 2,
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
              child: const Text('提交'),
            ),
          ],
        ),
      ),
    );
    if (confirmed == true) {
      try {
        await ref.read(apiServiceProvider).rateTicket(
              widget.ticketId,
              rating,
              comment:
                  comment.text.trim().isEmpty ? null : comment.text.trim(),
            );
        await _load();
      } on ApiException catch (e) {
        if (mounted) showAppSnack(context, e.message, error: true);
      }
    }
    comment.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ticket = _ticket;
    return AppScaffold(
      title: '工单详情',
      body: _loading
          ? const LoadingView()
          : _error != null
              ? ErrorView(message: _error!, onRetry: _load)
              : Column(
                  children: [
                    Expanded(
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
                                        ticket!.title,
                                        style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                    StatusChip(Dict.of(
                                        Dict.ticketStatusNames, ticket.status)),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    StatusChip(
                                      Dict.of(
                                          Dict.ticketTypeNames, ticket.type),
                                      tone: AppColors.textSecondary,
                                      compact: true,
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      ticket.ticketNo,
                                      style: const TextStyle(
                                          fontSize: 12,
                                          color: AppColors.textSecondary),
                                    ),
                                    const Spacer(),
                                    Text(
                                      Fmt.monthDay(ticket.createdAt),
                                      style: const TextStyle(
                                          fontSize: 12,
                                          color: AppColors.textSecondary),
                                    ),
                                  ],
                                ),
                                const Divider(height: 20),
                                Text(
                                  ticket.content,
                                  style: const TextStyle(
                                      fontSize: 14, height: 1.7),
                                ),
                                if (ticket.orderId != null) ...[
                                  const SizedBox(height: 10),
                                  OutlinedButton.icon(
                                    onPressed: () => context
                                        .push('/orders/${ticket.orderId}'),
                                    icon: const Icon(Icons.receipt_long_outlined,
                                        size: 17),
                                    label: const Text('查看关联订单',
                                        style: TextStyle(fontSize: 13)),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          SectionCard(
                            title: '沟通记录',
                            child: ticket.replies.isEmpty
                                ? const Text(
                                    '暂无回复，客服会尽快处理',
                                    style: TextStyle(
                                        fontSize: 13,
                                        color: AppColors.textSecondary),
                                  )
                                : Column(
                                    children: [
                                      for (final reply in ticket.replies)
                                        Padding(
                                          padding: const EdgeInsets.symmetric(
                                              vertical: 6),
                                          child: Row(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Container(
                                                width: 32,
                                                height: 32,
                                                alignment: Alignment.center,
                                                decoration: BoxDecoration(
                                                  color: (reply.isStaff
                                                          ? AppColors.primary
                                                          : AppColors.success)
                                                      .withValues(alpha: 0.12),
                                                  shape: BoxShape.circle,
                                                ),
                                                child: Icon(
                                                  reply.isStaff
                                                      ? Icons.support_agent_rounded
                                                      : Icons.person_rounded,
                                                  size: 17,
                                                  color: reply.isStaff
                                                      ? AppColors.primary
                                                      : AppColors.success,
                                                ),
                                              ),
                                              const SizedBox(width: 10),
                                              Expanded(
                                                child: Column(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment.start,
                                                  children: [
                                                    Row(
                                                      children: [
                                                        Text(
                                                          reply.isStaff
                                                              ? '客服'
                                                              : '我',
                                                          style: const TextStyle(
                                                              fontSize: 12.5,
                                                              fontWeight:
                                                                  FontWeight
                                                                      .w600),
                                                        ),
                                                        const Spacer(),
                                                        Text(
                                                          Fmt.monthDay(reply.at),
                                                          style: const TextStyle(
                                                              fontSize: 11.5,
                                                              color: AppColors
                                                                  .textSecondary),
                                                        ),
                                                      ],
                                                    ),
                                                    const SizedBox(height: 3),
                                                    Text(
                                                      reply.content,
                                                      style: const TextStyle(
                                                          fontSize: 13.5,
                                                          height: 1.6),
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
                          if (ticket.satisfactionRating != null)
                            SectionCard(
                              title: '满意度评价',
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  StarRating(
                                      value: ticket.satisfactionRating!),
                                  if ((ticket.satisfactionComment ?? '')
                                      .isNotEmpty)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 6),
                                      child: Text(ticket.satisfactionComment!,
                                          style:
                                              const TextStyle(fontSize: 13.5)),
                                    ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (ticket.status == 'Completed' &&
                        ticket.satisfactionRating == null)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                        child: SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            onPressed: _rate,
                            child: const Text('评价服务'),
                          ),
                        ),
                      ),
                    if (ticket.status == 'Pending' ||
                        ticket.status == 'Processing')
                      Container(
                        padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
                        decoration: const BoxDecoration(
                          color: Colors.white,
                          border:
                              Border(top: BorderSide(color: AppColors.divider)),
                        ),
                        child: SafeArea(
                          top: false,
                          child: Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: _reply,
                                  minLines: 1,
                                  maxLines: 3,
                                  decoration: const InputDecoration(
                                      hintText: '补充说明或追问…'),
                                ),
                              ),
                              const SizedBox(width: 8),
                              IconButton.filled(
                                onPressed: _sending ? null : _sendReply,
                                icon: const Icon(Icons.send_rounded, size: 20),
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
