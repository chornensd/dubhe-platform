import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format.dart';
import '../../core/session.dart';
import '../../services/providers.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// 非客户/机长角色的移动端工作台（运维、管理员等；功能随批次扩展）。
class SimpleWorkbenchPage extends ConsumerWidget {
  const SimpleWorkbenchPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final unread = ref.watch(unreadCountProvider).value ?? 0;
    if (user == null) {
      return const AppScaffold(title: '工作台', body: LoadingView());
    }
    final roleText = user.roles.isEmpty
        ? Dict.of(Dict.userTypeNames, user.userType)
        : user.roles.map((r) => Dict.of(Dict.roleNames, r)).join(' / ');

    return AppScaffold(
      title: '工作台',
      body: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          SectionCard(
            child: Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.primary, Color(0xFF4096FF)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: Text(
                    user.displayName.isEmpty
                        ? '枢'
                        : user.displayName.substring(0, 1),
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w600),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user.displayName,
                        style: const TextStyle(
                            fontSize: 16.5, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        roleText,
                        style: const TextStyle(
                            fontSize: 12.5, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                if (unread > 0)
                  Badge(
                    label: Text(unread > 99 ? '99+' : '$unread'),
                    child: IconButton(
                      onPressed: () => context.push('/notifications'),
                      icon: const Icon(Icons.notifications_none_rounded),
                    ),
                  )
                else
                  IconButton(
                    onPressed: () => context.push('/notifications'),
                    icon: const Icon(Icons.notifications_none_rounded),
                  ),
              ],
            ),
          ),
          SectionCard(
            title: '可用功能',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '当前角色的移动端功能将在后续批次交付（运维：设备/维保/场站；管理员：审批/告警处置）。',
                  style: TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      height: 1.7),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => context.push('/orders'),
                        icon: const Icon(Icons.receipt_long_outlined, size: 17),
                        label: const Text('订单查询'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => context.push('/orders/create'),
                        icon: const Icon(Icons.add_box_outlined, size: 17),
                        label: const Text('代客下单'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => context.push('/alerts'),
                        icon: const Icon(Icons.warning_amber_rounded, size: 17),
                        label: const Text('应急告警'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => context.push('/help'),
                        icon: const Icon(Icons.menu_book_outlined, size: 17),
                        label: const Text('帮助中心'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          SectionCard(
            title: '我的权限',
            child: Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final role in user.roles)
                  StatusChip(Dict.of(Dict.roleNames, role)),
                if (user.isAdmin)
                  const StatusChip('全部权限', tone: AppColors.primary),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
