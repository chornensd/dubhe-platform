import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/exceptions.dart';
import '../../core/format.dart';
import '../../core/paged_list.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../services/providers.dart';
import '../theme.dart';
import '../widgets/common.dart';

class NotificationsPage extends ConsumerStatefulWidget {
  const NotificationsPage({super.key});

  @override
  ConsumerState<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends ConsumerState<NotificationsPage> {
  late final PagedList<NotificationItem> _list;

  @override
  void initState() {
    super.initState();
    _list = PagedList(
      loader: (pageNum, pageSize) => ref
          .read(apiServiceProvider)
          .notifications(pageNum: pageNum, pageSize: pageSize),
    );
  }

  Future<void> _markAll() async {
    try {
      await ref.read(apiServiceProvider).readAllNotifications();
      ref.invalidate(unreadCountProvider);
      await _list.refresh();
    } on ApiException catch (e) {
      if (mounted) showAppSnack(context, e.message, error: true);
    }
  }

  Future<void> _open(NotificationItem item) async {
    if (!item.isRead) {
      try {
        await ref.read(apiServiceProvider).readNotification(item.id);
        _list.replaceWhere(
          (e) => e.id == item.id,
          (e) => NotificationItem(
            id: e.id,
            type: e.type,
            title: e.title,
            content: e.content,
            relatedId: e.relatedId,
            isRead: true,
            createdAt: e.createdAt,
          ),
        );
        ref.invalidate(unreadCountProvider);
      } on ApiException {
        // 忽略标记失败
      }
    }
    if (!mounted || item.relatedId == null) return;
    switch (item.type) {
      case 'OrderStatus':
        context.push('/orders/${item.relatedId}');
      case 'TicketUpdated':
        context.push('/tickets/${item.relatedId}');
      case 'EmergencyAlert':
      case 'Alert':
        context.push('/alerts/${item.relatedId}');
      case 'Violation':
        context.push('/alerts/${item.relatedId}');
      default:
        break;
    }
  }

  IconData _iconOf(String type) => switch (type) {
        'OrderStatus' => Icons.receipt_long_outlined,
        'TicketUpdated' => Icons.support_agent_outlined,
        'EmergencyAlert' || 'Alert' => Icons.warning_amber_rounded,
        'Violation' => Icons.gpp_maybe_outlined,
        'QualificationExpiry' => Icons.badge_outlined,
        'MaintenanceDue' => Icons.build_outlined,
        'FlightPlanApproved' => Icons.check_circle_outline_rounded,
        'FlightPlanRejected' => Icons.cancel_outlined,
        _ => Icons.notifications_none_rounded,
      };

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: '消息通知',
      actions: [
        TextButton(
          onPressed: _markAll,
          child: const Text('全部已读', style: TextStyle(fontSize: 13)),
        ),
      ],
      body: PagedListView<NotificationItem>(
        list: _list,
        emptyText: '暂无消息',
        emptyIcon: Icons.notifications_none_rounded,
        itemBuilder: (context, item, index) {
          return Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            child: InkWell(
              borderRadius: BorderRadius.circular(12),
              onTap: () => _open(item),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: (item.isRead
                                ? AppColors.textSecondary
                                : AppColors.primary)
                            .withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        _iconOf(item.type),
                        size: 20,
                        color: item.isRead
                            ? AppColors.textSecondary
                            : AppColors.primary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  item.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 14.5,
                                    fontWeight: item.isRead
                                        ? FontWeight.w500
                                        : FontWeight.w600,
                                    color: AppColors.text,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                Fmt.relative(item.createdAt),
                                style: const TextStyle(
                                  fontSize: 11.5,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            item.content,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                              height: 1.5,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              StatusChip(
                                Dict.of(Dict.notificationTypeNames, item.type),
                                compact: true,
                              ),
                              const Spacer(),
                              if (!item.isRead)
                                Container(
                                  width: 8,
                                  height: 8,
                                  decoration: const BoxDecoration(
                                    color: AppColors.danger,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
