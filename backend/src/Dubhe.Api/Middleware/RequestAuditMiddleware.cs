using System.Diagnostics;
using Dubhe.Application.Abstractions;
using Dubhe.Domain.Admin;

namespace Dubhe.Api.Middleware;

public sealed class RequestAuditMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<RequestAuditMiddleware> _logger;

    public RequestAuditMiddleware(
        RequestDelegate next,
        IServiceScopeFactory scopeFactory,
        ILogger<RequestAuditMiddleware> logger)
    {
        _next = next;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        var failed = false;

        try
        {
            await _next(context);
            failed = context.Response.StatusCode >= 400;
        }
        catch
        {
            failed = true;
            throw;
        }
        finally
        {
            stopwatch.Stop();
            await TryWriteAuditAsync(context, stopwatch.ElapsedMilliseconds, failed);
        }
    }

    private async Task TryWriteAuditAsync(HttpContext context, long elapsedMs, bool failed)
    {
        if (HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsOptions(context.Request.Method))
        {
            return;
        }

        var path = context.Request.Path.Value ?? string.Empty;
        if (!path.StartsWith("/api", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
            var currentUser = scope.ServiceProvider.GetRequiredService<ICurrentUser>();
            var client = scope.ServiceProvider.GetRequiredService<IClientContext>();

            var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
            var module = segments.Length > 1 ? segments[1] : "api";

            db.AuditLogs.Add(new AuditLog
            {
                UserId = currentUser.UserId,
                Username = currentUser.Username,
                Module = module,
                Action = $"{context.Request.Method} {path}",
                Ip = client.Ip,
                Succeeded = !failed,
                DurationMs = (int)elapsedMs
            });

            await db.SaveChangesAsync(CancellationToken.None);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "写入操作日志失败");
        }
    }
}
