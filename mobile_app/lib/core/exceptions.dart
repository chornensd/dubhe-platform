/// 统一业务异常（来自后端 `{ success, code, message, traceId }` 或网络层）。
class ApiException implements Exception {
  ApiException(this.code, this.message, {this.statusCode});

  final String code;
  final String message;
  final int? statusCode;

  bool get isUnauthorized =>
      statusCode == 401 ||
      code == 'token_invalid' ||
      code == 'token_expired' ||
      code == 'refresh_token_invalid';

  bool get isForbidden => statusCode == 403 || code == 'forbidden';

  bool get isNotFound => statusCode == 404 || code == 'not_found';

  bool get isValidation => code == 'validation_error';

  bool get isConflict => statusCode == 409;

  bool get isNetwork =>
      code == 'network_error' || code == 'timeout' || code == 'cancelled';

  @override
  String toString() => message;
}
