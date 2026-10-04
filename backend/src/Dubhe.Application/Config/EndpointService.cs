using Dubhe.Application.Abstractions;
using Dubhe.Application.Common;
using Dubhe.Application.Config.Dtos;
using Dubhe.Domain.Common;
using Dubhe.Domain.Config;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Config;

public interface IEndpointService
{
    Task<EndpointDto> CreateAsync(CreateEndpointRequest request, CancellationToken ct = default);
    Task<EndpointDto> UpdateAsync(Guid id, UpdateEndpointRequest request, CancellationToken ct = default);
    Task<PagedResult<EndpointDto>> SearchAsync(int pageNum, int pageSize, CancellationToken ct = default);
    Task<EndpointCallResult> TestAsync(Guid id, CancellationToken ct = default);
    Task<PagedResult<InterfaceCallLogDto>> SearchLogsAsync(EndpointLogQuery query, CancellationToken ct = default);
}

public sealed class EndpointService : IEndpointService
{
    private readonly IAppDbContext _db;
    private readonly IEndpointTester _tester;
    private readonly IDateTime _clock;

    public EndpointService(IAppDbContext db, IEndpointTester tester, IDateTime clock)
    {
        _db = db;
        _tester = tester;
        _clock = clock;
    }

    public async Task<EndpointDto> CreateAsync(CreateEndpointRequest request, CancellationToken ct = default)
    {
        var (name, url, method) = Validate(request.Name, request.Url, request.Method, request.TimeoutSeconds, request.MaxRetries);

        var endpoint = new ExternalEndpoint
        {
            Name = name,
            Url = url,
            Method = method,
            IsEnabled = request.IsEnabled,
            TimeoutSeconds = request.TimeoutSeconds,
            MaxRetries = request.MaxRetries,
            Headers = request.Headers
        };

        _db.ExternalEndpoints.Add(endpoint);
        await _db.SaveChangesAsync(ct);
        return Map(endpoint);
    }

    public async Task<EndpointDto> UpdateAsync(Guid id, UpdateEndpointRequest request, CancellationToken ct = default)
    {
        var endpoint = await _db.ExternalEndpoints.FirstOrDefaultAsync(e => e.Id == id, ct)
            ?? throw AppException.NotFound("接口不存在");

        var name = string.IsNullOrWhiteSpace(request.Name) ? endpoint.Name : request.Name.Trim();
        var url = string.IsNullOrWhiteSpace(request.Url) ? endpoint.Url : request.Url.Trim();
        var method = string.IsNullOrWhiteSpace(request.Method) ? endpoint.Method : request.Method.Trim();
        var timeout = request.TimeoutSeconds ?? endpoint.TimeoutSeconds;
        var retries = request.MaxRetries ?? endpoint.MaxRetries;
        (name, url, method) = Validate(name, url, method, timeout, retries);

        endpoint.Name = name;
        endpoint.Url = url;
        endpoint.Method = method;
        endpoint.TimeoutSeconds = timeout;
        endpoint.MaxRetries = retries;
        if (request.IsEnabled is not null)
        {
            endpoint.IsEnabled = request.IsEnabled.Value;
        }

        if (request.Headers is not null)
        {
            endpoint.Headers = string.IsNullOrWhiteSpace(request.Headers) ? null : request.Headers;
        }

        await _db.SaveChangesAsync(ct);
        return Map(endpoint);
    }

    public async Task<PagedResult<EndpointDto>> SearchAsync(
        int pageNum,
        int pageSize,
        CancellationToken ct = default)
    {
        pageNum = Math.Max(1, pageNum);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var total = await _db.ExternalEndpoints.LongCountAsync(ct);
        var rows = await _db.ExternalEndpoints.AsNoTracking()
            .OrderByDescending(e => e.CreatedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<EndpointDto>
        {
            Items = rows.Select(Map).ToList(),
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task<EndpointCallResult> TestAsync(Guid id, CancellationToken ct = default)
    {
        var endpoint = await _db.ExternalEndpoints.FirstOrDefaultAsync(e => e.Id == id, ct)
            ?? throw AppException.NotFound("接口不存在");

        var result = await _tester.TestAsync(endpoint.Method, endpoint.Url, endpoint.TimeoutSeconds, endpoint.Headers, ct);

        endpoint.TotalCalls++;
        if (!result.Succeeded)
        {
            endpoint.FailedCalls++;
        }

        endpoint.LastCallAt = _clock.UtcNow;
        endpoint.LastCallSucceeded = result.Succeeded;

        _db.InterfaceCallLogs.Add(new InterfaceCallLog
        {
            EndpointId = endpoint.Id,
            EndpointName = endpoint.Name,
            Url = endpoint.Url,
            Method = endpoint.Method,
            StatusCode = result.StatusCode,
            Succeeded = result.Succeeded,
            DurationMs = result.DurationMs,
            Error = result.Error
        });

        await _db.SaveChangesAsync(ct);
        return result;
    }

    public async Task<PagedResult<InterfaceCallLogDto>> SearchLogsAsync(
        EndpointLogQuery query,
        CancellationToken ct = default)
    {
        var pageNum = Math.Max(1, query.PageNum);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var q = _db.InterfaceCallLogs.AsNoTracking();

        if (query.EndpointId is not null)
        {
            q = q.Where(l => l.EndpointId == query.EndpointId);
        }

        if (query.Succeeded is not null)
        {
            q = q.Where(l => l.Succeeded == query.Succeeded);
        }

        if (query.From is not null)
        {
            q = q.Where(l => l.CreatedAt >= query.From);
        }

        if (query.To is not null)
        {
            q = q.Where(l => l.CreatedAt <= query.To);
        }

        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(l => l.CreatedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<InterfaceCallLogDto>
        {
            Items = rows.Select(l => new InterfaceCallLogDto(
                l.Id, l.EndpointId, l.EndpointName, l.Url, l.Method,
                l.StatusCode, l.Succeeded, l.DurationMs, l.Error, l.CreatedAt)).ToList(),
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    private static (string Name, string Url, string Method) Validate(
        string name,
        string url,
        string method,
        int timeoutSeconds,
        int maxRetries)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw AppException.Validation("接口名称不能为空");
        }

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw AppException.Validation("接口地址必须是合法的 http/https URL");
        }

        var normalizedMethod = method.Trim().ToUpperInvariant();
        if (normalizedMethod is not ("GET" or "POST"))
        {
            throw AppException.Validation("当前仅支持 GET/POST 方法");
        }

        if (timeoutSeconds is < 1 or > 60)
        {
            throw AppException.Validation("超时时间需在 1-60 秒之间");
        }

        if (maxRetries is < 0 or > 5)
        {
            throw AppException.Validation("重试次数需在 0-5 之间");
        }

        return (name.Trim(), url.Trim(), normalizedMethod);
    }

    private static EndpointDto Map(ExternalEndpoint endpoint)
    {
        var successRate = endpoint.TotalCalls == 0
            ? 0d
            : (double)(endpoint.TotalCalls - endpoint.FailedCalls) / endpoint.TotalCalls;

        return new EndpointDto(
            endpoint.Id,
            endpoint.Name,
            endpoint.Url,
            endpoint.Method,
            endpoint.IsEnabled,
            endpoint.TimeoutSeconds,
            endpoint.MaxRetries,
            endpoint.Headers,
            endpoint.LastCallAt,
            endpoint.LastCallSucceeded,
            endpoint.TotalCalls,
            endpoint.FailedCalls,
            Math.Round(successRate, 4),
            endpoint.CreatedAt);
    }
}
