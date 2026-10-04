using Dubhe.Domain.Agent;

namespace Dubhe.Application.Agent.Dtos;

public sealed record CreateKnowledgeDocRequest(
    string Title,
    string Category,
    string Tags,
    string Content,
    string? Version,
    bool IsPublished);

public sealed record UpdateKnowledgeDocRequest(
    string? Title,
    string? Category,
    string? Tags,
    string? Content,
    string? Version,
    bool? IsPublished);

public sealed class KnowledgeDocQuery
{
    public int PageNum { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? Keyword { get; init; }
    public string? Category { get; init; }
    public bool? PublishedOnly { get; init; }
}

public sealed record KnowledgeDocDto(
    Guid Id,
    string Title,
    string Category,
    string Tags,
    string Content,
    string Version,
    bool IsPublished,
    Guid CreatedBy,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record CreateAgentTaskRequest(
    int Type,
    string Title,
    string Input);

public sealed class AgentTaskQuery
{
    public int PageNum { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public AgentTaskType? Type { get; init; }
    public AgentTaskStatus? Status { get; init; }
}

public sealed record AgentTaskDto(
    Guid Id,
    string Type,
    string Title,
    string Input,
    string? Output,
    string Status,
    string? Error,
    Guid CreatedBy,
    DateTimeOffset? StartedAt,
    DateTimeOffset? FinishedAt,
    int DurationMs,
    DateTimeOffset CreatedAt);

public sealed record CreateAgentProtocolRequest(
    string Name,
    string Version,
    string? Description,
    string Content);

public sealed record AgentProtocolDto(
    Guid Id,
    string Name,
    string Version,
    string? Description,
    string Content,
    bool IsActive,
    DateTimeOffset CreatedAt);

public sealed record AgentInfoDto(
    string Implementation,
    string Description,
    IReadOnlyList<string> SupportedTaskTypes,
    IReadOnlyList<string> Roadmap);
