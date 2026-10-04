using Dubhe.Domain.Support;

namespace Dubhe.Application.Support.Dtos;

public sealed record CreateEmergencyAlertRequest(
    string Title,
    string Content,
    int Level,
    string? Source,
    Guid? RelatedId,
    Guid? MerchantId);

public sealed record DispatchEmergencyRequest(
    IReadOnlyList<Guid> Handlers,
    string Plan,
    DateTimeOffset? DeadlineAt);

public sealed record ProgressEmergencyRequest(
    string Note,
    IReadOnlyList<string>? Attachments,
    int? Status);

public sealed record CloseEmergencyRequest(string Result);

public sealed record EmergencyTimelineDto(
    Guid Id,
    string Action,
    string? Note,
    IReadOnlyList<string>? Attachments,
    Guid OperatorId,
    DateTimeOffset At);

public sealed record EmergencyAlertDto(
    Guid Id,
    string Title,
    string Content,
    string Level,
    string Status,
    string Source,
    Guid? RelatedId,
    Guid? MerchantId,
    Guid ReportedBy,
    DateTimeOffset ReportedAt,
    IReadOnlyList<Guid>? Handlers,
    string? DisposalPlan,
    DateTimeOffset? DeadlineAt,
    string? Result,
    DateTimeOffset? ClosedAt,
    DateTimeOffset CreatedAt,
    IReadOnlyList<EmergencyTimelineDto>? Timeline);

public sealed class EmergencyQuery
{
    public int PageNum { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public EmergencyAlertLevel? Level { get; init; }
    public EmergencyAlertStatus? Status { get; init; }
    public Guid? MerchantId { get; init; }
    public string? Keyword { get; init; }
}

public sealed record CreateTicketRequest(
    int Type,
    string Title,
    string Content,
    IReadOnlyList<string>? Attachments,
    Guid? OrderId);

public sealed record AssignTicketRequest(Guid AssigneeUserId);

public sealed record ReplyTicketRequest(string Content);

public sealed record RateTicketRequest(int Rating, string? Comment);

public sealed record TicketReplyDto(
    Guid Id,
    Guid UserId,
    string Content,
    bool IsStaff,
    DateTimeOffset At);

public sealed record ServiceTicketDto(
    Guid Id,
    string TicketNo,
    string Type,
    string Status,
    string Title,
    string Content,
    IReadOnlyList<string>? Attachments,
    Guid SubmitterUserId,
    Guid? MerchantId,
    Guid? OrderId,
    Guid? AssigneeUserId,
    DateTimeOffset? AssignedAt,
    DateTimeOffset? CompletedAt,
    DateTimeOffset? ClosedAt,
    int? SatisfactionRating,
    string? SatisfactionComment,
    DateTimeOffset CreatedAt,
    IReadOnlyList<TicketReplyDto>? Replies);

public sealed class TicketQuery
{
    public int PageNum { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public TicketType? Type { get; init; }
    public TicketStatus? Status { get; init; }
    public Guid? AssigneeUserId { get; init; }
    public Guid? MerchantId { get; init; }
    public string? Keyword { get; init; }
}

public sealed record TicketStatsDto(
    int Total,
    int Pending,
    int Processing,
    int Completed,
    int Closed,
    double AverageHandlingHours,
    int RatedCount,
    double AverageRating);

public sealed record CreateCannedResponseRequest(string Content, string? Category);

public sealed record CannedResponseDto(Guid Id, string Content, string? Category, DateTimeOffset CreatedAt);

public sealed record CreateHelpArticleRequest(
    string Title,
    string Category,
    string Tags,
    int ContentType,
    string? VideoUrl,
    string Content,
    bool IsPublished);

public sealed record UpdateHelpArticleRequest(
    string? Title,
    string? Category,
    string? Tags,
    int? ContentType,
    string? VideoUrl,
    string? Content,
    bool? IsPublished);

public sealed record HelpArticleDto(
    Guid Id,
    string Title,
    string Category,
    string Tags,
    string ContentType,
    string? VideoUrl,
    string Content,
    bool IsPublished,
    int ViewCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed class HelpQuery
{
    public int PageNum { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? Keyword { get; init; }
    public string? Category { get; init; }
    public HelpContentType? ContentType { get; init; }
}
