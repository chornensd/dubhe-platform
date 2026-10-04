namespace Dubhe.Application.Config.Dtos;

public sealed record SystemConfigDto(
    Guid Id,
    string Key,
    string Value,
    string Group,
    string Name,
    string? Description,
    string ValueType,
    DateTimeOffset UpdatedAt);

public sealed record UpdateConfigItemDto(string Key, string Value);

public sealed record UpdateConfigRequest(IReadOnlyList<UpdateConfigItemDto> Items);

public sealed record CreateEndpointRequest(
    string Name,
    string Url,
    string Method,
    bool IsEnabled,
    int TimeoutSeconds,
    int MaxRetries,
    string? Headers);

public sealed record UpdateEndpointRequest(
    string? Name,
    string? Url,
    string? Method,
    bool? IsEnabled,
    int? TimeoutSeconds,
    int? MaxRetries,
    string? Headers);

public sealed record EndpointDto(
    Guid Id,
    string Name,
    string Url,
    string Method,
    bool IsEnabled,
    int TimeoutSeconds,
    int MaxRetries,
    string? Headers,
    DateTimeOffset? LastCallAt,
    bool? LastCallSucceeded,
    int TotalCalls,
    int FailedCalls,
    double SuccessRate,
    DateTimeOffset CreatedAt);

public sealed record EndpointCallResult(
    bool Succeeded,
    int? StatusCode,
    int DurationMs,
    string? ResponseSnippet,
    string? Error);

public interface IEndpointTester
{
    Task<EndpointCallResult> TestAsync(
        string method,
        string url,
        int timeoutSeconds,
        string? headersJson,
        CancellationToken ct = default);
}

public sealed class EndpointLogQuery
{
    public int PageNum { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public Guid? EndpointId { get; init; }
    public bool? Succeeded { get; init; }
    public DateTimeOffset? From { get; init; }
    public DateTimeOffset? To { get; init; }
}

public sealed record InterfaceCallLogDto(
    Guid Id,
    Guid? EndpointId,
    string EndpointName,
    string Url,
    string Method,
    int? StatusCode,
    bool Succeeded,
    int DurationMs,
    string? Error,
    DateTimeOffset CreatedAt);

public sealed record CreateBackupRequest(string Scope);

public sealed record BackupRecordDto(
    Guid Id,
    string FileName,
    string Scope,
    long SizeBytes,
    string Status,
    string? Error,
    DateTimeOffset? RestoredAt,
    Guid CreatedBy,
    DateTimeOffset CreatedAt);

public sealed record RestoreResultDto(
    Guid BackupId,
    int ConfigCount,
    int KnowledgeDocCount,
    int HelpArticleCount,
    DateTimeOffset RestoredAt);

public sealed class AuditLogQuery
{
    public int PageNum { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? Module { get; init; }
    public string? Keyword { get; init; }
    public bool? Succeeded { get; init; }
    public DateTimeOffset? From { get; init; }
    public DateTimeOffset? To { get; init; }
}

public sealed record AuditLogDto(
    Guid Id,
    Guid? UserId,
    string? Username,
    string Module,
    string Action,
    string? Detail,
    string? Ip,
    bool Succeeded,
    int DurationMs,
    DateTimeOffset CreatedAt);

public sealed record CleanupLogsResultDto(int Deleted);
