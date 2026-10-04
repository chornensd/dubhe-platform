import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

/// 运行环境与默认配置。
class Env {
  Env._();

  /// 编译期覆盖：flutter run --dart-define=DUBHE_API_BASE=http://192.168.x.x:5180
  static const String definedBase = String.fromEnvironment('DUBHE_API_BASE');

  /// 平台默认后端地址（Android 模拟器访问宿主机用 10.0.2.2；真机请在“我的-服务器地址”中改为电脑局域网 IP）。
  static String get platformDefaultBase {
    if (definedBase.isNotEmpty) return definedBase;
    if (kIsWeb) return 'http://localhost:5180';
    if (Platform.isAndroid) return 'http://10.0.2.2:5180';
    return 'http://localhost:5180';
  }

  static const String appName = '天枢 · 低空运营';
  static const String appVersion = '1.0.0';
  static const String deviceType = 'Mobile';
}
