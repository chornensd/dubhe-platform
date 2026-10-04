namespace Dubhe.Api.Common;

public sealed record ApiResponse<T>(bool Success, string Code, string Message, T? Data, string? TraceId);

public static class ApiResponse
{
    public static ApiResponse<T> Ok<T>(T data, string? traceId = null) =>
        new(true, "ok", "success", data, traceId);

    public static ApiResponse<object?> Fail(string code, string message, string? traceId = null) =>
        new(false, code, message, null, traceId);
}
