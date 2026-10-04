import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/exceptions.dart';
import '../../core/format.dart';
import '../../core/permissions.dart';
import '../../core/session.dart';
import '../theme.dart';
import '../widgets/common.dart';

class ProfilePage extends ConsumerWidget {
  const ProfilePage({super.key});

  Future<void> _editProfile(BuildContext context, WidgetRef ref) async {
    final user = ref.read(currentUserProvider);
    if (user == null) return;
    final nameController = TextEditingController(text: user.displayName);
    final emailController = TextEditingController(text: user.email ?? '');

    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('修改资料', style: TextStyle(fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(hintText: '昵称 / 姓名'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: emailController,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(hintText: '邮箱（可选）'),
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
            child: const Text('保存'),
          ),
        ],
      ),
    );

    if (saved != true) {
      nameController.dispose();
      emailController.dispose();
      return;
    }
    try {
      await ref.read(authProvider.notifier).updateProfile(
            displayName: nameController.text.trim(),
            email: emailController.text.trim(),
          );
      if (context.mounted) showAppSnack(context, '已保存');
    } on ApiException catch (e) {
      if (context.mounted) showAppSnack(context, e.message, error: true);
    } finally {
      nameController.dispose();
      emailController.dispose();
    }
  }

  Future<void> _logout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showConfirm(
      context,
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      danger: true,
    );
    if (!confirmed) return;
    await ref.read(authProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    if (user == null) {
      return const AppScaffold(title: '我的', body: LoadingView());
    }

    final roleText = user.roles.isEmpty
        ? Dict.of(Dict.userTypeNames, user.userType)
        : user.roles.map((r) => Dict.of(Dict.roleNames, r)).join(' / ');

    return AppScaffold(
      title: '我的',
      body: ListView(
        padding: const EdgeInsets.all(14),
        children: [
          SectionCard(
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.primary, Color(0xFF4096FF)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    user.displayName.isEmpty
                        ? '枢'
                        : user.displayName.substring(0, 1),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w600,
                    ),
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
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '@${user.username} · ${user.phone}',
                        style: const TextStyle(
                          fontSize: 12.5,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      if (user.companyName != null) ...[
                        const SizedBox(height: 3),
                        Text(
                          user.companyName!,
                          style: const TextStyle(
                            fontSize: 12.5,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                IconButton(
                  onPressed: () => _editProfile(context, ref),
                  icon: const Icon(Icons.edit_outlined, size: 20),
                ),
              ],
            ),
          ),
          SectionCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                ListTile(
                  dense: true,
                  leading: const Icon(Icons.badge_outlined, size: 21),
                  title: const Text('角色', style: TextStyle(fontSize: 14)),
                  trailing: Text(
                    roleText,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
                const Divider(height: 1),
                ListTile(
                  dense: true,
                  leading: const Icon(Icons.verified_user_outlined, size: 21),
                  title: const Text('账号状态', style: TextStyle(fontSize: 14)),
                  trailing: StatusChip(
                    Dict.of(Dict.accountStatusNames, user.status),
                  ),
                ),
                const Divider(height: 1),
                ListTile(
                  dense: true,
                  leading: const Icon(Icons.cloud_outlined, size: 21),
                  title: const Text('服务器地址', style: TextStyle(fontSize: 14)),
                  trailing: const Icon(Icons.chevron_right_rounded, size: 20),
                  onTap: () => context.push('/settings/server'),
                ),
              ],
            ),
          ),
          SectionCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              children: [
                if (user.can('order.invoice.apply'))
                  _menu(
                    context,
                    icon: Icons.request_quote_outlined,
                    label: '我的发票',
                    path: '/invoices',
                  ),
                if (user.can('support.ticket.apply'))
                  _menu(
                    context,
                    icon: Icons.support_agent_outlined,
                    label: '我的工单',
                    path: '/tickets',
                  ),
                if (user.isPilot) ...[
                  _menu(
                    context,
                    icon: Icons.build_outlined,
                    label: '故障记录',
                    path: '/faults',
                  ),
                  _menu(
                    context,
                    icon: Icons.warning_amber_rounded,
                    label: '应急告警',
                    path: '/alerts',
                  ),
                ],
                _menu(
                  context,
                  icon: Icons.notifications_none_rounded,
                  label: '消息通知',
                  path: '/notifications',
                ),
                _menu(
                  context,
                  icon: Icons.menu_book_outlined,
                  label: '帮助中心',
                  path: '/help',
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          SectionCard(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: ListTile(
              dense: true,
              leading: const Icon(Icons.logout_rounded,
                  size: 21, color: AppColors.danger),
              title: const Text(
                '退出登录',
                style: TextStyle(fontSize: 14, color: AppColors.danger),
              ),
              onTap: () => _logout(context, ref),
            ),
          ),
          const SizedBox(height: 20),
          const Center(
            child: Text(
              '天枢 · 低空智能运营管控平台（移动端）',
              style: TextStyle(fontSize: 11.5, color: AppColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _menu(
    BuildContext context, {
    required IconData icon,
    required String label,
    required String path,
  }) {
    return Column(
      children: [
        ListTile(
          dense: true,
          leading: Icon(icon, size: 21),
          title: Text(label, style: const TextStyle(fontSize: 14)),
          trailing: const Icon(Icons.chevron_right_rounded, size: 20),
          onTap: () => context.push(path),
        ),
        const Divider(height: 1),
      ],
    );
  }
}
