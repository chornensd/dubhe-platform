using Dubhe.Api.Common;
using Dubhe.Domain.Common;
using Microsoft.AspNetCore.Diagnostics;

namespace Dubhe.Api.Middleware;

public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private static readonly IReadOnlyDictionary<string, int> StatusMap = new Dictionary<string, int>
    {
        [ErrorCodes.ValidationError] = StatusCodes.Status400BadRequest,
        [ErrorCodes.InvalidCredentials] = StatusCodes.Status401Unauthorized,
        [ErrorCodes.TokenInvalid] = StatusCodes.Status401Unauthorized,
        [ErrorCodes.TokenExpired] = StatusCodes.Status401Unauthorized,
        [ErrorCodes.RefreshTokenInvalid] = StatusCodes.Status401Unauthorized,
        [ErrorCodes.Forbidden] = StatusCodes.Status403Forbidden,
        [ErrorCodes.AccountFrozen] = StatusCodes.Status403Forbidden,
        [ErrorCodes.AccountPendingReview] = StatusCodes.Status403Forbidden,
        [ErrorCodes.AccountRejected] = StatusCodes.Status403Forbidden,
        [ErrorCodes.NotFound] = StatusCodes.Status404NotFound,
        [ErrorCodes.UserExists] = StatusCodes.Status409Conflict,
        [ErrorCodes.Conflict] = StatusCodes.Status409Conflict,
        [ErrorCodes.AccountLocked] = StatusCodes.Status423Locked,
        [ErrorCodes.OrderStateInvalid] = StatusCodes.Status409Conflict,
        [ErrorCodes.DroneUnavailable] = StatusCodes.Status409Conflict,
        [ErrorCodes.ResourceConflict] = StatusCodes.Status409Conflict,
        [ErrorCodes.AirspaceConflict] = StatusCodes.Status409Conflict,
        [ErrorCodes.OutOfServiceArea] = StatusCodes.Status400BadRequest,
        [ErrorCodes.ProhibitedItem] = StatusCodes.Status400BadRequest
    };

    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (httpContext.Response.HasStarted)
        {
            return false;
        }

        var (statusCode, code, message) = exception switch
        {
            AppException appException => (
                StatusMap.GetValueOrDefault(appException.ErrorCode, StatusCodes.Status400BadRequest),
                appException.ErrorCode,
                appException.Message),
            _ => (
                StatusCodes.Status500InternalServerError,
                ErrorCodes.InternalError,
                "服务器内部错误，请稍后重试")
        };

        if (statusCode >= 500)
        {
            _logger.LogError(exception, "未处理异常: {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);
        }
        else
        {
            _logger.LogInformation("业务异常 {Code}: {Message}", code, message);
        }

        httpContext.Response.StatusCode = statusCode;
        httpContext.Response.ContentType = "application/json; charset=utf-8";
        await httpContext.Response.WriteAsJsonAsync(
            ApiResponse.Fail(code, message, httpContext.TraceIdentifier),
            cancellationToken);

        return true;
    }
}
