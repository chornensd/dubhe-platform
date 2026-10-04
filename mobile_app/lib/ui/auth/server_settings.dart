import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/env.dart';
import '../../core/exceptions.dart';
import '../../core/session.dart';
import '../../services/api_service.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// 服务器地址设置（开发/演示环境用，可切换本机、局域网或远端 API）。
class ServerSettingsPage extends ConsumerStatefulWidget {
  const ServerSettingsPage({super.key});

  @override
  ConsumerState<ServerSettingsPage> createState() => _ServerSettingsPageState();
}

class _ServerSettingsPageState extends ConsumerState<ServerSettingsPage> {
  late final TextEditingController _controller;
  bool _testing = false;
  String? _result;
  bool _ok = false;

  @override
  void initState() {
    super.initState();
    final current =
        ref.read(settingsProvider).value?.baseUrl ?? Env.platformDefaultBase;
    _controller = TextEditingController(text: current);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _test() async {
    setState(() {
      _testing = true;
      _result = null;
    });
    try {
      final url = _controller.text.trim().replaceAll(RegExp(r'/+$'), '');
      await ref.read(settingsProvider.notifier).setBaseUrl(url);
      final context = await ref.read(apiServiceProvider).context();
      setState(() {
        _ok = true;
        _result =
            '连接成功：API ${context.apiVersion}，服务端识别设备为 ${context.deviceType}，服务器时间 ${context.serverTime ?? '—'}';
      });
    } on ApiException catch (e) {
      setState(() {
        _ok = false;
        _result = '连接失败：${e.message}';
      });
    } catch (e) {
      setState(() {
        _ok = false;
        _result = '连接失败：$e';
      });
    } finally {
      if (mounted) setState(() => _testing = false);
    }
  }

  Future<void> _save() async {
    final url = _controller.text.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      showAppSnack(context, '地址需以 http:// 或 https:// 开头', error: true);
      return;
    }
    await ref.read(settingsProvider.notifier).setBaseUrl(url);
    if (!mounted) return;
    showAppSnack(context, '已保存');
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      title: '服务器地址',
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SectionCard(
            title: '后端 API 地址',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _controller,
                  keyboardType: TextInputType.url,
                  autocorrect: false,
                  decoration: const InputDecoration(
                    hintText: 'http://10.0.2.2:5180',
                  ),
                ),
                const SizedBox(height: 10),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    '快捷选择',
                    style: TextStyle(
                        fontSize: 12.5, color: AppColors.textSecondary),
                  ),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final preset in const [
                      ('PC 热点', 'http://192.168.137.1:5180'),
                      ('USB 转发', 'http://127.0.0.1:5180'),
                      ('Android 模拟器', 'http://10.0.2.2:5180'),
                      ('本机 Web', 'http://localhost:5180'),
                    ])
                      ActionChip(
                        label: Text('${preset.$1} · ${preset.$2}',
                            style: const TextStyle(fontSize: 11.5)),
                        onPressed: () {
                          _controller.text = preset.$2;
                          setState(() {});
                        },
                      ),
                  ],
                ),
                const SizedBox(height: 10),
                const Text(
                  '· Android 模拟器访问本机后端使用 http://10.0.2.2:5180\n'
                  '· 真机调试请改为电脑局域网 IP（如 http://192.168.1.10:5180）\n'
                  '· Web 调试使用 http://localhost:5180',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                    height: 1.8,
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _testing ? null : _test,
                        child: _testing
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text('测试连接'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton(
                        onPressed: _save,
                        child: const Text('保存'),
                      ),
                    ),
                  ],
                ),
                if (_result != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: (_ok ? AppColors.success : AppColors.danger)
                          .withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      _result!,
                      style: TextStyle(
                        fontSize: 12.5,
                        height: 1.5,
                        color: _ok
                            ? const Color(0xFF389E0D)
                            : const Color(0xFFCF1322),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          SectionCard(
            title: '关于',
            child: Column(
              children: [
                InfoRow('应用名称', Env.appName),
                InfoRow('版本', Env.appVersion),
                const InfoRow('设备类型', '移动端（Device-Type: Mobile）'),
                const InfoRow('令牌时长', '2 小时（自动刷新）'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
