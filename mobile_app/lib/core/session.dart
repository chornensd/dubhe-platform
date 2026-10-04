import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/models.dart';
import 'api_client.dart';
import 'auth_store.dart';
import 'env.dart';
import 'exceptions.dart';

/// 运行设置（服务器地址可在“我的-服务器地址”修改）。
class AppSettings {
  const AppSettings({required this.baseUrl});

  final String baseUrl;

  AppSettings copyWith({String? baseUrl}) =>
      AppSettings(baseUrl: baseUrl ?? this.baseUrl);
}

class SettingsController extends AsyncNotifier<AppSettings> {
  static const _baseUrlKey = 'dubhe.baseUrl';

  @override
  Future<AppSettings> build() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_baseUrlKey);
    return AppSettings(
      baseUrl: (saved == null || saved.isEmpty) ? Env.platformDefaultBase : saved,
    );
  }

  Future<void> setBaseUrl(String url) async {
    final normalized = url.trim().replaceAll(RegExp(r'/+$'), '');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_baseUrlKey, normalized);
    state = AsyncData(AppSettings(baseUrl: normalized));
  }
}

final settingsProvider =
    AsyncNotifierProvider<SettingsController, AppSettings>(SettingsController.new);

final authStoreProvider = Provider<AuthStore>((ref) => AuthStore());
final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

final apiProvider = Provider<ApiClient>((ref) {
  final baseUrl =
      ref.watch(settingsProvider).value?.baseUrl ?? Env.platformDefaultBase;
  final tokenStore = ref.watch(tokenStoreProvider);
  return ApiClient(
    baseUrl: baseUrl,
    tokenStore: tokenStore,
    onSessionExpired: () {
      try {
        ref.read(authProvider.notifier).handleSessionExpired();
      } catch (_) {
        // provider 已销毁时忽略
      }
    },
    onTokensRefreshed: () async {
      try {
        await ref.read(authProvider.notifier).persistTokens();
      } catch (_) {
        // 忽略
      }
    },
  );
});

class AuthController extends AsyncNotifier<AuthUser?> {
  @override
  Future<AuthUser?> build() async {
    final store = ref.read(authStoreProvider);
    // 兜底超时：存储层异常时不允许阻塞启动（否则会停留在启动页）
    final session = await store
        .load()
        .timeout(const Duration(seconds: 8), onTimeout: () => null);
    if (session == null) return null;

    final tokens = ref.read(tokenStoreProvider);
    tokens.set(
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      accessExpiresAt: session.accessExpiresAt,
      refreshExpiresAt: session.refreshExpiresAt,
    );

    if (tokens.accessExpired) {
      if (!tokens.canRefresh) {
        await _clear();
        return null;
      }
      final refreshed = await ref.read(apiProvider).tryRefresh();
      if (!refreshed) {
        await _clear();
        return null;
      }
    }

    try {
      final me = await ref
          .read(apiProvider)
          .get<AuthUser>('/api/users/me', parse: _parseUser);
      await store.saveUser(me);
      return me;
    } catch (_) {
      // 离线/服务不可用时容忍：使用本地缓存资料
      return session.user;
    }
  }

  static AuthUser _parseUser(dynamic data) =>
      AuthUser.fromJson(Map<String, dynamic>.from(data as Map));

  Future<void> persistTokens() async {
    final tokens = ref.read(tokenStoreProvider);
    if (!tokens.hasAccess) return;
    await ref.read(authStoreProvider).saveSession(
          accessToken: tokens.accessToken!,
          refreshToken: tokens.refreshToken ?? '',
          accessExpiresAt: tokens.accessExpiresAt,
          refreshExpiresAt: tokens.refreshExpiresAt,
        );
  }

  /// 返回 null 表示成功，否则返回错误提示。
  Future<String?> login(String account, String password) async {
    try {
      final result = await ref.read(apiProvider).post<AuthResult>(
            '/api/auth/login',
            body: {'account': account.trim(), 'password': password},
            parse: (data) => AuthResult.fromJson(
                Map<String, dynamic>.from(data as Map)),
          );

      final tokens = ref.read(tokenStoreProvider);
      tokens.set(
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        accessExpiresAt: result.accessTokenExpiresAt,
        refreshExpiresAt: result.refreshTokenExpiresAt,
      );

      final store = ref.read(authStoreProvider);
      await store.saveSession(
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        accessExpiresAt: result.accessTokenExpiresAt,
        refreshExpiresAt: result.refreshTokenExpiresAt,
      );
      await store.saveUser(result.user);

      state = AsyncData(result.user);
      return null;
    } on ApiException catch (e) {
      return e.message;
    } catch (e) {
      return '$e';
    }
  }

  /// 注册（注册接口不返回令牌，成功后需登录）。返回 null 表示成功。
  Future<String?> register({
    required String username,
    required String phone,
    required String password,
    required String displayName,
    required int userType,
    String? companyName,
  }) async {
    try {
      await ref.read(apiProvider).post<AuthUser>(
            '/api/auth/register',
            body: {
              'username': username.trim(),
              'phone': phone.trim(),
              'password': password,
              'displayName': displayName.trim(),
              'userType': userType,
              'companyName': companyName,
            },
            parse: _parseUser,
          );
      return null;
    } on ApiException catch (e) {
      return e.message;
    } catch (e) {
      return '$e';
    }
  }

  Future<void> refreshProfile() async {
    try {
      final me = await ref
          .read(apiProvider)
          .get<AuthUser>('/api/users/me', parse: _parseUser);
      await ref.read(authStoreProvider).saveUser(me);
      state = AsyncData(me);
    } catch (_) {
      // 忽略
    }
  }

  Future<void> updateProfile({
    String? displayName,
    String? email,
    String? avatarUrl,
  }) async {
    final me = await ref.read(apiProvider).put<AuthUser>(
          '/api/users/me',
          body: {
            'displayName': displayName,
            'email': email,
            'avatarUrl': avatarUrl,
          },
          parse: _parseUser,
        );
    await ref.read(authStoreProvider).saveUser(me);
    state = AsyncData(me);
  }

  Future<void> logout() async {
    final refreshToken = ref.read(tokenStoreProvider).refreshToken;
    try {
      if (refreshToken != null && refreshToken.isNotEmpty) {
        await ref
            .read(apiProvider)
            .post<void>('/api/auth/logout', body: {'refreshToken': refreshToken});
      }
    } catch (_) {
      // 忽略登出接口异常，本地登出为准
    }
    await _clear();
    state = const AsyncData(null);
  }

  void handleSessionExpired() {
    unawaited(_clear());
    state = const AsyncData(null);
  }

  Future<void> _clear() async {
    ref.read(tokenStoreProvider).clear();
    await ref.read(authStoreProvider).clear();
  }
}

final authProvider =
    AsyncNotifierProvider<AuthController, AuthUser?>(AuthController.new);

/// 当前登录用户（未登录为 null）。
final currentUserProvider = Provider<AuthUser?>(
  (ref) => ref.watch(authProvider).value,
);
