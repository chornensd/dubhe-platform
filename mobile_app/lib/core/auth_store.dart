import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/models.dart';

/// 登录态持久化。
///
/// - Android / iOS：flutter_secure_storage（Keystore / Keychain）；
/// - Web：SharedPreferences（localStorage）—— 浏览器环境 secure_storage 的实现
///   在部分浏览器/Headless 环境下 Promise 不返回，会导致会话恢复挂起；且浏览器
///   localStorage 本身无额外安全收益。
class AuthStore {
  AuthStore([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const _kAccessToken = 'dubhe.accessToken';
  static const _kRefreshToken = 'dubhe.refreshToken';
  static const _kAccessExpires = 'dubhe.accessTokenExpiresAt';
  static const _kRefreshExpires = 'dubhe.refreshTokenExpiresAt';
  static const _kUser = 'dubhe.user';

  static const _timeout = Duration(seconds: 4);

  Future<String?> _read(String key) async {
    try {
      if (kIsWeb) {
        final prefs = await SharedPreferences.getInstance().timeout(_timeout);
        return prefs.getString(key);
      }
      return await _storage.read(key: key).timeout(_timeout);
    } catch (_) {
      return null;
    }
  }

  Future<void> _write(String key, String value) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance().timeout(_timeout);
      await prefs.setString(key, value);
      return;
    }
    await _storage.write(key: key, value: value).timeout(_timeout);
  }

  Future<void> _delete(String key) async {
    if (kIsWeb) {
      final prefs = await SharedPreferences.getInstance().timeout(_timeout);
      await prefs.remove(key);
      return;
    }
    await _storage.delete(key: key).timeout(_timeout);
  }

  Future<void> saveSession({
    required String accessToken,
    required String refreshToken,
    DateTime? accessExpiresAt,
    DateTime? refreshExpiresAt,
  }) async {
    await _write(_kAccessToken, accessToken);
    await _write(_kRefreshToken, refreshToken);
    await _write(_kAccessExpires, accessExpiresAt?.toIso8601String() ?? '');
    await _write(_kRefreshExpires, refreshExpiresAt?.toIso8601String() ?? '');
  }

  Future<void> saveUser(AuthUser user) =>
      _write(_kUser, jsonEncode(user.toJson()));

  Future<StoredSession?> load() async {
    final access = await _read(_kAccessToken);
    final refresh = await _read(_kRefreshToken);
    if (access == null || refresh == null) return null;

    AuthUser? user;
    final rawUser = await _read(_kUser);
    if (rawUser != null && rawUser.isNotEmpty) {
      try {
        user = AuthUser.fromJson(
            Map<String, dynamic>.from(jsonDecode(rawUser) as Map));
      } catch (_) {
        user = null;
      }
    }

    return StoredSession(
      accessToken: access,
      refreshToken: refresh,
      accessExpiresAt: DateTime.tryParse(await _read(_kAccessExpires) ?? ''),
      refreshExpiresAt: DateTime.tryParse(await _read(_kRefreshExpires) ?? ''),
      user: user,
    );
  }

  Future<void> clear() async {
    for (final key in const [
      _kAccessToken,
      _kRefreshToken,
      _kAccessExpires,
      _kRefreshExpires,
      _kUser,
    ]) {
      try {
        await _delete(key);
      } catch (_) {
        // 忽略单个键删除失败
      }
    }
  }
}

class StoredSession {
  StoredSession({
    required this.accessToken,
    required this.refreshToken,
    this.accessExpiresAt,
    this.refreshExpiresAt,
    this.user,
  });

  final String accessToken;
  final String refreshToken;
  final DateTime? accessExpiresAt;
  final DateTime? refreshExpiresAt;
  final AuthUser? user;
}

/// 内存中的令牌镜像（供 API 客户端与业务层读取）。
class TokenStore {
  String? accessToken;
  String? refreshToken;
  DateTime? accessExpiresAt;
  DateTime? refreshExpiresAt;

  void set({
    String? accessToken,
    String? refreshToken,
    DateTime? accessExpiresAt,
    DateTime? refreshExpiresAt,
  }) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.accessExpiresAt = accessExpiresAt;
    this.refreshExpiresAt = refreshExpiresAt;
  }

  void clear() {
    accessToken = null;
    refreshToken = null;
    accessExpiresAt = null;
    refreshExpiresAt = null;
  }

  bool get hasAccess => (accessToken ?? '').isNotEmpty;

  bool get accessExpired =>
      accessExpiresAt != null && accessExpiresAt!.isBefore(DateTime.now());

  bool get canRefresh =>
      (refreshToken ?? '').isNotEmpty &&
      (refreshExpiresAt == null || refreshExpiresAt!.isAfter(DateTime.now()));
}
