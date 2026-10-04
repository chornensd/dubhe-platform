import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/session.dart';
import '../theme.dart';
import '../widgets/common.dart';

class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key});

  @override
  ConsumerState<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends ConsumerState<RegisterPage> {
  final _username = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _displayName = TextEditingController();
  final _companyName = TextEditingController();

  int _userType = 1;
  bool _submitting = false;

  static const _userTypes = <(int, String, String)>[
    (1, '个人客户', '手机号注册，即时可用'),
    (2, '企业客户', '需管理员审核后可用'),
    (3, '商家', '需营业执照与对公账户认证'),
  ];

  @override
  void dispose() {
    _username.dispose();
    _phone.dispose();
    _password.dispose();
    _displayName.dispose();
    _companyName.dispose();
    super.dispose();
  }

  bool _validPhone(String phone) =>
      RegExp(r'^1[3-9]\d{9}$').hasMatch(phone);

  Future<void> _submit() async {
    final username = _username.text.trim();
    final phone = _phone.text.trim();
    final password = _password.text;
    final displayName = _displayName.text.trim();

    if (username.length < 3) return _error('用户名至少 3 个字符');
    if (!_validPhone(phone)) return _error('请输入有效的 11 位手机号');
    if (password.length < 8) return _error('密码至少 8 位');
    if (displayName.isEmpty) return _error('请填写昵称 / 姓名');
    if (_userType != 1 && _companyName.text.trim().isEmpty) {
      return _error('企业/商家请填写企业名称');
    }

    setState(() => _submitting = true);
    final error = await ref.read(authProvider.notifier).register(
          username: username,
          phone: phone,
          password: password,
          displayName: displayName,
          userType: _userType,
          companyName: _userType == 1 ? null : _companyName.text.trim(),
        );
    if (!mounted) return;
    setState(() => _submitting = false);

    if (error != null) {
      _error(error);
      return;
    }
    showAppSnack(
      context,
      _userType == 1 ? '注册成功，请登录' : '注册资料已提交，等待管理员审核后登录',
    );
    context.pop();
  }

  void _error(String message) => showAppSnack(context, message, error: true);

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: '注册账号',
      backgroundColor: Colors.white,
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              '账号类型',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 8),
            for (final type in _userTypes)
              GestureDetector(
                onTap: () => setState(() => _userType = type.$1),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: _userType == type.$1
                        ? AppColors.primary.withValues(alpha: 0.06)
                        : const Color(0xFFF7F8FA),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: _userType == type.$1
                          ? AppColors.primary
                          : Colors.transparent,
                      width: 1.2,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _userType == type.$1
                            ? Icons.radio_button_checked_rounded
                            : Icons.radio_button_off_rounded,
                        size: 19,
                        color: _userType == type.$1
                            ? AppColors.primary
                            : AppColors.textSecondary,
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            type.$2,
                            style: const TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            type.$3,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 12),
            TextField(
              controller: _username,
              decoration: const InputDecoration(hintText: '用户名（登录用，≥3 位）'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(hintText: '手机号'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              obscureText: true,
              decoration: const InputDecoration(hintText: '密码（≥8 位，含大小写/数字）'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _displayName,
              decoration: const InputDecoration(hintText: '昵称 / 联系人姓名'),
            ),
            if (_userType != 1) ...[
              const SizedBox(height: 12),
              TextField(
                controller: _companyName,
                decoration: const InputDecoration(hintText: '企业名称（用于资质审核）'),
              ),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text('提交注册'),
            ),
            const SizedBox(height: 14),
            const Text(
              '注册即表示同意平台服务协议与隐私政策；企业/商家账号经管理员审核后方可登录。',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
                height: 1.6,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
