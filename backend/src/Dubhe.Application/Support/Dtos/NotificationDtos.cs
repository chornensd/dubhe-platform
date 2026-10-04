namespace Dubhe.Application.Support.Dtos;

public sealed record NotificationDto(
    Guid Id,
    string Type,
    string Title,
    string Content,
    Guid? RelatedId,
    bool IsRead,
    DateTimeOffset? ReadAt,
    DateTimeOffset CreatedAt);

public sealed class NotificationQuery
{
    public int PageNum { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public bool UnreadOnly { get; init; }
}
