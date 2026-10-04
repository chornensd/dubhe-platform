import 'dart:async';

import 'package:dio/dio.dart';

import 'auth_store.dart';
import 'env.dart';
import 'exceptions.dart';

/// HTTP 客户端：统一响应解包、Bearer 鉴权、Device-Type: Mobile、401 自动刷新重放。
class ApiClient {
  ApiClient({
    required this.baseUrl,
    required this.tokenStore,
    this.onSessionExpired,
    this.onTokensRefreshed,
  }) {
    final options = BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 25),
      sendTimeout: const Duration(seconds: 30),
      headers: {'Accept': 'application/json', 'Device-Type': Env.deviceType},
      responseType: ResponseType.json,
    );
    _dio = Dio(options);
    _retryDio = Dio(options);
    _refreshDio = Dio(options);

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) {
        final token = tokenStore.accessToken;
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        options.headers['Device-Type'] = Env.deviceType;
        handler.next(options);
      },
      onError: (error, handler) async {
        final status = error.response?.statusCode;
        final path = error.requestOptions.path;
        final isAuthCall = path.contains('/auth/login') ||
            path.contains('/auth/refresh') ||
            path.contains('/auth/register');
        final retried = error.requestOptions.extra['retried'] == true;

        if (status == 401 && !isAuthCall && !retried) {
          final refreshed = await _refreshTokens();
          if (refreshed) {
            final options = error.requestOptions;
            options.extra['retried'] = true;
            options.headers['Authorization'] =
                'Bearer ${tokenStore.accessToken}';
            try {
              final response = await _retryDio.fetch(options);
              return handler.resolve(response);
            } on DioException catch (e) {
              return handler.next(e);
            }
          } else {
            onSessionExpired?.call();
          }
        }
        handler.next(error);
      },
    ));
  }

  final String baseUrl;
  final TokenStore tokenStore;
  final void Function()? onSessionExpired;
  final Future<void> Function()? onTokensRefreshed;

  late final Dio _dio;
  late final Dio _retryDio;
  late final Dio _refreshDio;
  Future<bool>? _refreshing;

  Future<bool> tryRefresh() => _refreshTokens();

  Future<bool> _refreshTokens() {
    final pending = _refreshing;
    if (pending != null) return pending;
    final future = _doRefresh();
    _refreshing = future;
    return future.whenComplete(() => _refreshing = null);
  }

  Future<bool> _doRefresh() async {
    final refreshToken = tokenStore.refreshToken;
    if (refreshToken == null || refreshToken.isEmpty) return false;

    try {
      final res = await _refreshDio.post(
        '/api/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final body = res.data;
      if (body is Map && body['success'] == true && body['data'] is Map) {
        final data = Map<String, dynamic>.from(body['data'] as Map);
        tokenStore.set(
          accessToken: data['accessToken']?.toString(),
          refreshToken: data['refreshToken']?.toString(),
          accessExpiresAt:
              DateTime.tryParse(data['accessTokenExpiresAt']?.toString() ?? ''),
          refreshExpiresAt:
              DateTime.tryParse(data['refreshTokenExpiresAt']?.toString() ?? ''),
        );
        await onTokensRefreshed?.call();
        return tokenStore.hasAccess;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? query,
    T Function(dynamic data)? parse,
  }) =>
      _request<T>(
        (dio) => dio.get(path, queryParameters: _clean(query)),
        parse: parse,
      );

  Future<T> post<T>(
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    T Function(dynamic data)? parse,
  }) =>
      _request<T>(
        (dio) => dio.post(path, data: body, queryParameters: _clean(query)),
        parse: parse,
      );

  Future<T> put<T>(
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    T Function(dynamic data)? parse,
  }) =>
      _request<T>(
        (dio) => dio.put(path, data: body, queryParameters: _clean(query)),
        parse: parse,
      );

  Future<T> delete<T>(String path, {Object? body}) =>
      _request<T>((dio) => dio.delete(path, data: body));

  /// 上传文件（multipart/form-data）。
  Future<T> upload<T>(
    String path, {
    required String filename,
    required List<int> bytes,
    String field = 'file',
    Map<String, dynamic>? query,
    T Function(dynamic data)? parse,
  }) async {
    final form = FormData.fromMap({
      field: MultipartFile.fromBytes(bytes, filename: filename),
    });
    return _request<T>(
      (dio) => dio.post(path, data: form, queryParameters: _clean(query)),
      parse: parse,
    );
  }

  Future<T> _request<T>(
    Future<Response<dynamic>> Function(Dio dio) send, {
    T Function(dynamic data)? parse,
  }) async {
    try {
      final response = await send(_dio);
      final body = response.data;
      if (parse != null) {
        final data = _extractData(body);
        return parse(data);
      }
      return _cast<T>(_extractData(body));
    } on DioException catch (e) {
      throw mapError(e);
    }
  }

  dynamic _extractData(dynamic body) {
    if (body is Map) {
      final map = Map<String, dynamic>.from(body);
      if (map.containsKey('success') && map['success'] != true) {
        throw ApiException(
          map['code']?.toString() ?? 'internal_error',
          map['message']?.toString() ?? '请求失败',
        );
      }
      return map['data'];
    }
    return body;
  }

  T _cast<T>(dynamic data) {
    if (data == null) {
      if (null is T) return null as T;
      throw ApiException('internal_error', '响应数据为空');
    }
    if (data is T) return data;
    if (data is Map) return Map<String, dynamic>.from(data) as T;
    throw ApiException('internal_error', '响应数据格式不正确');
  }

  static Map<String, dynamic>? _clean(Map<String, dynamic>? query) {
    if (query == null) return null;
    final result = <String, dynamic>{};
    query.forEach((key, value) {
      if (value == null) return;
      if (value is String && value.isEmpty) return;
      result[key] = value;
    });
    return result;
  }

  static ApiException mapError(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ApiException('timeout', '请求超时，请稍后重试');
      case DioExceptionType.cancel:
        return ApiException('cancelled', '请求已取消');
      case DioExceptionType.connectionError:
        return ApiException('network_error', '无法连接服务器，请检查网络与服务器地址');
      case DioExceptionType.badCertificate:
        return ApiException('network_error', '安全连接失败');
      case DioExceptionType.transformTimeout:
        return ApiException('timeout', '响应解析超时，请重试');
      case DioExceptionType.badResponse:
        final response = e.response;
        final data = response?.data;
        if (data is Map) {
          return ApiException(
            data['code']?.toString() ?? 'internal_error',
            data['message']?.toString() ?? '请求失败（${response?.statusCode}）',
            statusCode: response?.statusCode,
          );
        }
        return ApiException(
          'internal_error',
          '请求失败（${response?.statusCode}）',
          statusCode: response?.statusCode,
        );
      case DioExceptionType.unknown:
        if (e.error is ApiException) return e.error as ApiException;
        return ApiException('network_error', '网络异常，请稍后重试');
    }
  }
}
