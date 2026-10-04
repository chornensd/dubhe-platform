using Dubhe.Application.Abstractions;
using Dubhe.Domain.Auth;
using Microsoft.AspNetCore.Http;

namespace Dubhe.Infrastructure.Identity;

public sealed class HttpClientContext : IClientContext
{
    public const string DeviceTypeHeader = "Device-Type";

    private readonly IHttpContextAccessor _accessor;

    public HttpClientContext(IHttpContextAccessor accessor)
    {
        _accessor = accessor;
    }

    public DeviceType DeviceType
    {
        get
        {
            var raw = _accessor.HttpContext?.Request.Headers[DeviceTypeHeader].FirstOrDefault();
            return raw?.Trim().ToLowerInvariant() switch
            {
                "mobile" => DeviceType.Mobile,
                "pc" => DeviceType.Pc,
                _ => DeviceType.Unknown
            };
        }
    }

    public string? Ip
    {
        get
        {
            var context = _accessor.HttpContext;
            if (context is null)
            {
                return null;
            }

            var forwarded = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(forwarded))
            {
                return forwarded.Split(',')[0].Trim();
            }

            return context.Connection.RemoteIpAddress?.ToString();
        }
    }
}
