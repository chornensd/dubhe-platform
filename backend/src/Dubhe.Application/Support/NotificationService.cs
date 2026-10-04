using Dubhe.Application.Abstractions;
using Dubhe.Application.Common;
using Dubhe.Application.Support.Dtos;
using Dubhe.Domain.Common;
using Dubhe.Domain.Support;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Support;

public interface INotificationService
{
    Task<PagedResult<NotificationDto>> SearchAsync(NotificationQuery query, CancellationToken ct = default);
    Task<int> MarkReadAsync(Guid id, CancellationToken ct = default);
    Task<int> MarkAllReadAsync(CancellationToken ct = default);
}

public sealed class NotificationService : INotificationService
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly IDateTime _clock;

    public NotificationService(IAppDbContext db, ICurrentUser currentUser, IDateTime clock)
    {
        _db = db;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<PagedResult<NotificationDto>> SearchAsync(
        NotificationQuery query,
        CancellationToken ct = default)
    {
        var userId = _currentUser.UserId ?? throw new AppException(ErrorCodes.Forbidden, "未登录");
        var pageNum = Math.Max(1, query.PageNum);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        var q = _db.Notifications.AsNoTracking().Where(n => n.UserId == userId);
        if (query.UnreadOnly)
        {
            q = q.Where(n => !n.IsRead);
        }

        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(n => n.CreatedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<NotificationDto>
        {
            Items = rows.Select(Map).ToList(),
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task<int> MarkReadAsync(Guid id, CancellationToken ct = default)
    {
        var userId = _currentUser.UserId ?? throw new AppException(ErrorCodes.Forbidden, "未登录");
        var notification = await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId, ct)
            ?? throw AppException.NotFound("消息不存在");

        if (!notification.IsRead)
        {
            notification.IsRead = true;
            notification.ReadAt = _clock.UtcNow;
            await _db.SaveChangesAsync(ct);
        }

        return 1;
    }

    public async Task<int> MarkAllReadAsync(CancellationToken ct = default)
    {
        var userId = _currentUser.UserId ?? throw new AppException(ErrorCodes.Forbidden, "未登录");
        var unread = await _db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync(ct);

        if (unread.Count == 0)
        {
            return 0;
        }

        var now = _clock.UtcNow;
        foreach (var notification in unread)
        {
            notification.IsRead = true;
            notification.ReadAt = now;
        }

        await _db.SaveChangesAsync(ct);
        return unread.Count;
    }

    private static NotificationDto Map(Notification notification) => new(
        notification.Id,
        notification.Type.ToString(),
        notification.Title,
        notification.Content,
        notification.RelatedId,
        notification.IsRead,
        notification.ReadAt,
        notification.CreatedAt);
}
