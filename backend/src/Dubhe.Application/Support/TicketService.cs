using System.Text.Json;
using Dubhe.Application.Abstractions;
using Dubhe.Application.Common;
using Dubhe.Application.Support.Dtos;
using Dubhe.Domain.Auth;
using Dubhe.Domain.Common;
using Dubhe.Domain.Support;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Support;

public interface ITicketService
{
    Task<ServiceTicketDto> SubmitAsync(CreateTicketRequest request, CancellationToken ct = default);
    Task<PagedResult<ServiceTicketDto>> SearchAsync(TicketQuery query, CancellationToken ct = default);
    Task<ServiceTicketDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<ServiceTicketDto> AssignAsync(Guid id, AssignTicketRequest request, CancellationToken ct = default);
    Task<ServiceTicketDto> ReplyAsync(Guid id, ReplyTicketRequest request, CancellationToken ct = default);
    Task<ServiceTicketDto> CompleteAsync(Guid id, CancellationToken ct = default);
    Task<ServiceTicketDto> CloseAsync(Guid id, CancellationToken ct = default);
    Task<ServiceTicketDto> RateAsync(Guid id, RateTicketRequest request, CancellationToken ct = default);
    Task<TicketStatsDto> StatsAsync(CancellationToken ct = default);
    Task<IReadOnlyList<CannedResponseDto>> ListCannedResponsesAsync(CancellationToken ct = default);
    Task<CannedResponseDto> CreateCannedResponseAsync(CreateCannedResponseRequest request, CancellationToken ct = default);
}

public sealed class TicketService : ITicketService
{
    private readonly IAppDbContext _db;
    private readonly MerchantContext _merchant;
    private readonly ICurrentUser _currentUser;
    private readonly IDateTime _clock;

    public TicketService(
        IAppDbContext db,
        MerchantContext merchant,
        ICurrentUser currentUser,
        IDateTime clock)
    {
        _db = db;
        _merchant = merchant;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<ServiceTicketDto> SubmitAsync(CreateTicketRequest request, CancellationToken ct = default)
    {
        if (!Enum.IsDefined(typeof(TicketType), request.Type))
        {
            throw AppException.Validation("工单类型不合法");
        }

        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Content))
        {
            throw AppException.Validation("工单标题与内容不能为空");
        }

        var me = await _merchant.GetCurrentUserAsync(ct);
        Guid? merchantId = null;

        if (request.OrderId is not null)
        {
            var order = await _db.Orders.AsNoTracking()
                .FirstOrDefaultAsync(o => o.Id == request.OrderId, ct)
                ?? throw AppException.Validation("关联订单不存在");

            var canAccess = order.CustomerId == me.Id
                            || _merchant.IsAdmin
                            || await _merchant.CanOperateMerchantAsync(order.MerchantId, ct);
            if (!canAccess)
            {
                throw AppException.Forbidden("无权关联该订单");
            }

            merchantId = order.MerchantId;
        }
        else if (me.UserType is UserType.Merchant or UserType.MerchantStaff)
        {
            merchantId = await _merchant.ResolveMerchantIdAsync(null, ct);
        }

        var ticket = new ServiceTicket
        {
            TicketNo = GenerateTicketNo(),
            Type = (TicketType)request.Type,
            Status = TicketStatus.Pending,
            Title = request.Title.Trim(),
            Content = request.Content.Trim(),
            Attachments = request.Attachments is { Count: > 0 } ? JsonSerializer.Serialize(request.Attachments) : null,
            SubmitterUserId = me.Id,
            MerchantId = merchantId,
            OrderId = request.OrderId
        };

        _db.ServiceTickets.Add(ticket);
        await _db.SaveChangesAsync(ct);
        return await MapAsync(ticket, includeReplies: true, ct);
    }

    public async Task<PagedResult<ServiceTicketDto>> SearchAsync(TicketQuery query, CancellationToken ct = default)
    {
        var pageNum = Math.Max(1, query.PageNum);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var q = _db.ServiceTickets.AsNoTracking();
        var me = await _merchant.GetCurrentUserAsync(ct);

        if (IsPlatformStaff(me))
        {
            if (query.MerchantId is not null)
            {
                q = q.Where(t => t.MerchantId == query.MerchantId);
            }
        }
        else if (me.UserType is UserType.Merchant or UserType.MerchantStaff)
        {
            var merchantId = await _merchant.ResolveMerchantIdAsync(null, ct);
            q = q.Where(t => t.MerchantId == merchantId || t.SubmitterUserId == me.Id);
        }
        else
        {
            q = q.Where(t => t.SubmitterUserId == me.Id);
        }

        if (query.Type is not null)
        {
            q = q.Where(t => t.Type == query.Type);
        }

        if (query.Status is not null)
        {
            q = q.Where(t => t.Status == query.Status);
        }

        if (query.AssigneeUserId is not null)
        {
            q = q.Where(t => t.AssigneeUserId == query.AssigneeUserId);
        }

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var keyword = query.Keyword.Trim();
            q = q.Where(t => t.TicketNo.Contains(keyword) || t.Title.Contains(keyword) || t.Content.Contains(keyword));
        }

        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(t => t.CreatedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = new List<ServiceTicketDto>();
        foreach (var row in rows)
        {
            items.Add(await MapAsync(row, includeReplies: false, ct));
        }

        return new PagedResult<ServiceTicketDto>
        {
            Items = items,
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task<ServiceTicketDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var ticket = await _db.ServiceTickets.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw AppException.NotFound("工单不存在");

        await EnsureVisibleAsync(ticket, ct);
        return await MapAsync(ticket, includeReplies: true, ct);
    }

    public async Task<ServiceTicketDto> AssignAsync(Guid id, AssignTicketRequest request, CancellationToken ct = default)
    {
        var ticket = await GetTrackedAsync(id, ct);
        await EnsureAgentAsync(ticket, ct);

        var assigneeValid = await _db.Users.AnyAsync(
            u => u.Id == request.AssigneeUserId && u.Status == AccountStatus.Active, ct);
        if (!assigneeValid)
        {
            throw AppException.Validation("处理人不存在或未激活");
        }

        ticket.AssigneeUserId = request.AssigneeUserId;
        ticket.AssignedAt = _clock.UtcNow;
        if (ticket.Status == TicketStatus.Pending)
        {
            ticket.Status = TicketStatus.Processing;
        }

        _db.Notifications.Add(new Notification
        {
            UserId = request.AssigneeUserId,
            Type = NotificationType.TicketUpdated,
            Title = "工单指派",
            Content = $"工单 {ticket.TicketNo}「{ticket.Title}」已指派给你",
            RelatedId = ticket.Id
        });

        await _db.SaveChangesAsync(ct);
        return await MapAsync(ticket, includeReplies: true, ct);
    }

    public async Task<ServiceTicketDto> ReplyAsync(Guid id, ReplyTicketRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Content))
        {
            throw AppException.Validation("回复内容不能为空");
        }

        var ticket = await GetTrackedAsync(id, ct);
        var me = await _merchant.GetCurrentUserAsync(ct);

        var isSubmitter = ticket.SubmitterUserId == me.Id;
        if (!isSubmitter)
        {
            await EnsureAgentAsync(ticket, ct);
        }

        _db.TicketReplies.Add(new TicketReply
        {
            TicketId = ticket.Id,
            UserId = me.Id,
            Content = request.Content.Trim(),
            IsStaff = !isSubmitter
        });

        if (!isSubmitter && ticket.Status == TicketStatus.Pending)
        {
            ticket.Status = TicketStatus.Processing;
        }

        var notifyUserId = isSubmitter ? ticket.AssigneeUserId : ticket.SubmitterUserId;
        if (notifyUserId is not null)
        {
            _db.Notifications.Add(new Notification
            {
                UserId = notifyUserId.Value,
                Type = NotificationType.TicketUpdated,
                Title = "工单回复",
                Content = $"工单 {ticket.TicketNo} 有新回复",
                RelatedId = ticket.Id
            });
        }

        await _db.SaveChangesAsync(ct);
        return await MapAsync(ticket, includeReplies: true, ct);
    }

    public async Task<ServiceTicketDto> CompleteAsync(Guid id, CancellationToken ct = default)
    {
        var ticket = await GetTrackedAsync(id, ct);
        await EnsureAgentAsync(ticket, ct);

        if (ticket.Status is TicketStatus.Completed or TicketStatus.Closed)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "工单已结束");
        }

        ticket.Status = TicketStatus.Completed;
        ticket.CompletedAt = _clock.UtcNow;

        _db.Notifications.Add(new Notification
        {
            UserId = ticket.SubmitterUserId,
            Type = NotificationType.TicketUpdated,
            Title = "工单已完成",
            Content = $"工单 {ticket.TicketNo} 已处理完成，可进行评价",
            RelatedId = ticket.Id
        });

        await _db.SaveChangesAsync(ct);
        return await MapAsync(ticket, includeReplies: true, ct);
    }

    public async Task<ServiceTicketDto> CloseAsync(Guid id, CancellationToken ct = default)
    {
        var ticket = await GetTrackedAsync(id, ct);
        var me = await _merchant.GetCurrentUserAsync(ct);

        if (ticket.SubmitterUserId != me.Id)
        {
            await EnsureAgentAsync(ticket, ct);
        }

        if (ticket.Status == TicketStatus.Closed)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "工单已关闭");
        }

        ticket.Status = TicketStatus.Closed;
        ticket.ClosedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await MapAsync(ticket, includeReplies: true, ct);
    }

    public async Task<ServiceTicketDto> RateAsync(Guid id, RateTicketRequest request, CancellationToken ct = default)
    {
        if (request.Rating is < 1 or > 5)
        {
            throw AppException.Validation("评分需在 1-5 之间");
        }

        var ticket = await GetTrackedAsync(id, ct);
        var me = await _merchant.GetCurrentUserAsync(ct);

        if (ticket.SubmitterUserId != me.Id)
        {
            throw AppException.Forbidden("仅提交人可评价工单");
        }

        if (ticket.Status != TicketStatus.Completed)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "仅已完成工单可评价");
        }

        if (ticket.SatisfactionRating is not null)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "该工单已评价");
        }

        ticket.SatisfactionRating = request.Rating;
        ticket.SatisfactionComment = request.Comment;
        await _db.SaveChangesAsync(ct);
        return await MapAsync(ticket, includeReplies: true, ct);
    }

    public async Task<TicketStatsDto> StatsAsync(CancellationToken ct = default)
    {
        var me = await _merchant.GetCurrentUserAsync(ct);
        var q = _db.ServiceTickets.AsNoTracking();

        if (!IsPlatformStaff(me))
        {
            var merchantId = await _merchant.ResolveMerchantIdAsync(null, ct);
            q = q.Where(t => t.MerchantId == merchantId || t.SubmitterUserId == me.Id);
        }

        var tickets = await q.ToListAsync(ct);
        var handled = tickets.Where(t => t.CompletedAt is not null).ToList();
        var avgHours = handled.Count == 0
            ? 0d
            : handled.Average(t => (t.CompletedAt!.Value - t.CreatedAt).TotalHours);
        var rated = tickets.Where(t => t.SatisfactionRating is not null).ToList();
        var avgRating = rated.Count == 0 ? 0d : rated.Average(t => t.SatisfactionRating!.Value);

        return new TicketStatsDto(
            tickets.Count,
            tickets.Count(t => t.Status == TicketStatus.Pending),
            tickets.Count(t => t.Status == TicketStatus.Processing),
            tickets.Count(t => t.Status == TicketStatus.Completed),
            tickets.Count(t => t.Status == TicketStatus.Closed),
            Math.Round(avgHours, 2),
            rated.Count,
            Math.Round(avgRating, 2));
    }

    public async Task<IReadOnlyList<CannedResponseDto>> ListCannedResponsesAsync(CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var rows = await _db.CannedResponses.AsNoTracking()
            .Where(c => c.OwnerUserId == userId)
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(ct);
        return rows.Select(MapCanned).ToList();
    }

    public async Task<CannedResponseDto> CreateCannedResponseAsync(
        CreateCannedResponseRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Content))
        {
            throw AppException.Validation("常用语内容不能为空");
        }

        var userId = RequireUserId();
        var canned = new CannedResponse
        {
            OwnerUserId = userId,
            Content = request.Content.Trim(),
            Category = request.Category
        };

        _db.CannedResponses.Add(canned);
        await _db.SaveChangesAsync(ct);
        return MapCanned(canned);
    }

    private bool IsPlatformStaff(User me) =>
        _merchant.IsAdmin
        || me.UserType == UserType.OperationsStaff
        || _merchant.HasRole(RoleCodes.OperationsStaff);

    private bool HasManagePermission() =>
        _currentUser.Permissions.Contains("support.ticket.manage");

    private async Task<ServiceTicket> GetTrackedAsync(Guid id, CancellationToken ct) =>
        await _db.ServiceTickets.FirstOrDefaultAsync(t => t.Id == id, ct)
        ?? throw AppException.NotFound("工单不存在");

    private async Task EnsureVisibleAsync(ServiceTicket ticket, CancellationToken ct)
    {
        var me = await _merchant.GetCurrentUserAsync(ct);
        if (IsPlatformStaff(me) || ticket.SubmitterUserId == me.Id)
        {
            return;
        }

        if (me.UserType is UserType.Merchant or UserType.MerchantStaff
            && ticket.MerchantId is not null
            && await _merchant.CanOperateMerchantAsync(ticket.MerchantId.Value, ct))
        {
            return;
        }

        throw AppException.Forbidden("无权查看该工单");
    }

    private async Task EnsureAgentAsync(ServiceTicket ticket, CancellationToken ct)
    {
        if (!HasManagePermission())
        {
            throw AppException.Forbidden("无权处理该工单");
        }

        var me = await _merchant.GetCurrentUserAsync(ct);
        if (IsPlatformStaff(me))
        {
            return;
        }

        if (me.UserType is UserType.Merchant or UserType.MerchantStaff
            && ticket.MerchantId is not null
            && await _merchant.CanOperateMerchantAsync(ticket.MerchantId.Value, ct))
        {
            return;
        }

        throw AppException.Forbidden("无权处理该工单");
    }

    private Guid RequireUserId() =>
        _currentUser.UserId ?? throw new AppException(ErrorCodes.Forbidden, "未登录");

    private async Task<ServiceTicketDto> MapAsync(
        ServiceTicket ticket,
        bool includeReplies,
        CancellationToken ct)
    {
        IReadOnlyList<TicketReplyDto>? replies = null;
        if (includeReplies)
        {
            var rows = await _db.TicketReplies.AsNoTracking()
                .Where(r => r.TicketId == ticket.Id)
                .OrderBy(r => r.CreatedAt)
                .ToListAsync(ct);

            replies = rows.Select(r => new TicketReplyDto(
                r.Id, r.UserId, r.Content, r.IsStaff, r.CreatedAt)).ToList();
        }

        return new ServiceTicketDto(
            ticket.Id,
            ticket.TicketNo,
            ticket.Type.ToString(),
            ticket.Status.ToString(),
            ticket.Title,
            ticket.Content,
            string.IsNullOrWhiteSpace(ticket.Attachments)
                ? null
                : JsonSerializer.Deserialize<List<string>>(ticket.Attachments),
            ticket.SubmitterUserId,
            ticket.MerchantId,
            ticket.OrderId,
            ticket.AssigneeUserId,
            ticket.AssignedAt,
            ticket.CompletedAt,
            ticket.ClosedAt,
            ticket.SatisfactionRating,
            ticket.SatisfactionComment,
            ticket.CreatedAt,
            replies);
    }

    private static CannedResponseDto MapCanned(CannedResponse canned) => new(
        canned.Id, canned.Content, canned.Category, canned.CreatedAt);

    private static string GenerateTicketNo() =>
        $"TK{DateTimeOffset.UtcNow:yyyyMMdd}{Guid.NewGuid():N}"[..20].ToUpperInvariant();
}
