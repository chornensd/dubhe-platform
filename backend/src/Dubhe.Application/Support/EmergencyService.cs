using System.Text.Json;
using Dubhe.Application.Abstractions;
using Dubhe.Application.Common;
using Dubhe.Application.Support.Dtos;
using Dubhe.Domain.Auth;
using Dubhe.Domain.Common;
using Dubhe.Domain.Support;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Support;

public interface IEmergencyService
{
    Task<EmergencyAlertDto> ReportAsync(CreateEmergencyAlertRequest request, CancellationToken ct = default);
    Task<PagedResult<EmergencyAlertDto>> SearchAsync(EmergencyQuery query, CancellationToken ct = default);
    Task<EmergencyAlertDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<EmergencyAlertDto> DispatchAsync(Guid id, DispatchEmergencyRequest request, CancellationToken ct = default);
    Task<EmergencyAlertDto> AddProgressAsync(Guid id, ProgressEmergencyRequest request, CancellationToken ct = default);
    Task<EmergencyAlertDto> CloseAsync(Guid id, CloseEmergencyRequest request, CancellationToken ct = default);
}

public sealed class EmergencyService : IEmergencyService
{
    private readonly IAppDbContext _db;
    private readonly MerchantContext _merchant;
    private readonly IDateTime _clock;

    public EmergencyService(IAppDbContext db, MerchantContext merchant, IDateTime clock)
    {
        _db = db;
        _merchant = merchant;
        _clock = clock;
    }

    public async Task<EmergencyAlertDto> ReportAsync(
        CreateEmergencyAlertRequest request,
        CancellationToken ct = default)
    {
        if (!Enum.IsDefined(typeof(EmergencyAlertLevel), request.Level))
        {
            throw AppException.Validation("告警级别不合法");
        }

        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Content))
        {
            throw AppException.Validation("告警标题与内容不能为空");
        }

        var me = await _merchant.GetCurrentUserAsync(ct);
        Guid? merchantId = null;
        if (me.UserType is UserType.Merchant or UserType.MerchantStaff)
        {
            merchantId = await _merchant.ResolveMerchantIdAsync(request.MerchantId, ct);
        }
        else if (_merchant.IsAdmin || me.UserType == UserType.OperationsStaff)
        {
            merchantId = request.MerchantId;
        }

        var alert = new EmergencyAlert
        {
            Title = request.Title.Trim(),
            Content = request.Content.Trim(),
            Level = (EmergencyAlertLevel)request.Level,
            Source = string.IsNullOrWhiteSpace(request.Source) ? "Manual" : request.Source.Trim(),
            RelatedId = request.RelatedId,
            MerchantId = merchantId,
            ReportedBy = me.Id,
            ReportedAt = _clock.UtcNow,
            Status = EmergencyAlertStatus.Open
        };

        _db.EmergencyAlerts.Add(alert);
        AddTimeline(alert, me.Id, "Report", "告警已上报");
        await _db.SaveChangesAsync(ct);
        return await MapAsync(alert, includeTimeline: true, ct);
    }

    public async Task<PagedResult<EmergencyAlertDto>> SearchAsync(
        EmergencyQuery query,
        CancellationToken ct = default)
    {
        var pageNum = Math.Max(1, query.PageNum);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var q = _db.EmergencyAlerts.AsNoTracking();
        var me = await _merchant.GetCurrentUserAsync(ct);

        if (!IsStaff(me))
        {
            if (me.UserType is UserType.Merchant or UserType.MerchantStaff)
            {
                var merchantId = await _merchant.ResolveMerchantIdAsync(null, ct);
                q = q.Where(a => a.MerchantId == merchantId || a.ReportedBy == me.Id);
            }
            else
            {
                q = q.Where(a => a.ReportedBy == me.Id);
            }
        }
        else if (query.MerchantId is not null)
        {
            q = q.Where(a => a.MerchantId == query.MerchantId);
        }

        if (query.Level is not null)
        {
            q = q.Where(a => a.Level == query.Level);
        }

        if (query.Status is not null)
        {
            q = q.Where(a => a.Status == query.Status);
        }

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var keyword = query.Keyword.Trim();
            q = q.Where(a => a.Title.Contains(keyword) || a.Content.Contains(keyword));
        }

        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(a => a.Level).ThenByDescending(a => a.ReportedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = new List<EmergencyAlertDto>();
        foreach (var row in rows)
        {
            items.Add(await MapAsync(row, includeTimeline: false, ct));
        }

        return new PagedResult<EmergencyAlertDto>
        {
            Items = items,
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task<EmergencyAlertDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var alert = await _db.EmergencyAlerts.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw AppException.NotFound("告警不存在");

        await EnsureVisibleAsync(alert, ct);
        return await MapAsync(alert, includeTimeline: true, ct);
    }

    public async Task<EmergencyAlertDto> DispatchAsync(
        Guid id,
        DispatchEmergencyRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Plan))
        {
            throw AppException.Validation("处置方案不能为空");
        }

        if (request.Handlers is not { Count: > 0 })
        {
            throw AppException.Validation("请至少选择一名处理人");
        }

        if (request.DeadlineAt is { } deadline && deadline <= _clock.UtcNow)
        {
            throw AppException.Validation("处置时限必须晚于当前时间");
        }

        var alert = await GetTrackedAsync(id, ct);
        await EnsureOperableAsync(alert, ct);

        if (alert.Status is EmergencyAlertStatus.Closed)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "告警已关闭，无法重新处置");
        }

        var handlerIds = request.Handlers.Distinct().ToList();
        var validHandlers = await _db.Users.CountAsync(u => handlerIds.Contains(u.Id) && u.Status == AccountStatus.Active, ct);
        if (validHandlers != handlerIds.Count)
        {
            throw AppException.Validation("存在无效的处理人");
        }

        alert.Handlers = JsonSerializer.Serialize(handlerIds);
        alert.DisposalPlan = request.Plan.Trim();
        alert.DeadlineAt = request.DeadlineAt?.ToUniversalTime();
        if (alert.Status == EmergencyAlertStatus.Open)
        {
            alert.Status = EmergencyAlertStatus.Handling;
        }

        AddTimeline(alert, _currentOperatorId, "Dispatch", $"下发处置指令：{alert.DisposalPlan}");

        foreach (var handlerId in handlerIds)
        {
            _db.Notifications.Add(new Notification
            {
                UserId = handlerId,
                Type = NotificationType.EmergencyAlert,
                Title = "应急处置任务",
                Content = $"告警「{alert.Title}」已指派给你：{alert.DisposalPlan}",
                RelatedId = alert.Id
            });
        }

        await _db.SaveChangesAsync(ct);
        return await MapAsync(alert, includeTimeline: true, ct);
    }

    public async Task<EmergencyAlertDto> AddProgressAsync(
        Guid id,
        ProgressEmergencyRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Note))
        {
            throw AppException.Validation("处置进展说明不能为空");
        }

        var alert = await GetTrackedAsync(id, ct);
        await EnsureOperableAsync(alert, ct);

        if (alert.Status is EmergencyAlertStatus.Closed)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "告警已关闭");
        }

        if (request.Status is not null)
        {
            if (!Enum.IsDefined(typeof(EmergencyAlertStatus), request.Status.Value))
            {
                throw AppException.Validation("告警状态不合法");
            }

            var status = (EmergencyAlertStatus)request.Status.Value;
            if (status is EmergencyAlertStatus.Open or EmergencyAlertStatus.Closed)
            {
                throw AppException.Validation("进展更新仅支持处理中或已解决");
            }

            alert.Status = status;
        }

        AddTimeline(alert, _currentOperatorId, "Progress", request.Note.Trim(), request.Attachments);

        await _db.SaveChangesAsync(ct);
        return await MapAsync(alert, includeTimeline: true, ct);
    }

    public async Task<EmergencyAlertDto> CloseAsync(
        Guid id,
        CloseEmergencyRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Result))
        {
            throw AppException.Validation("处置结果不能为空");
        }

        var alert = await GetTrackedAsync(id, ct);
        await EnsureOperableAsync(alert, ct);

        if (alert.Status == EmergencyAlertStatus.Closed)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "告警已关闭");
        }

        alert.Status = EmergencyAlertStatus.Closed;
        alert.Result = request.Result.Trim();
        alert.ClosedAt = _clock.UtcNow;
        AddTimeline(alert, _currentOperatorId, "Close", $"处置结果：{alert.Result}");

        if (alert.MerchantId is not null)
        {
            _db.Notifications.Add(new Notification
            {
                UserId = alert.MerchantId.Value,
                Type = NotificationType.EmergencyAlert,
                Title = "应急告警已关闭",
                Content = $"告警「{alert.Title}」已处置完成：{alert.Result}",
                RelatedId = alert.Id
            });
        }

        await _db.SaveChangesAsync(ct);
        return await MapAsync(alert, includeTimeline: true, ct);
    }

    private Guid _currentOperatorId = Guid.Empty;

    private async Task<EmergencyAlert> GetTrackedAsync(Guid id, CancellationToken ct) =>
        await _db.EmergencyAlerts.FirstOrDefaultAsync(a => a.Id == id, ct)
        ?? throw AppException.NotFound("告警不存在");

    private async Task EnsureVisibleAsync(EmergencyAlert alert, CancellationToken ct)
    {
        var me = await _merchant.GetCurrentUserAsync(ct);
        if (IsStaff(me) || alert.ReportedBy == me.Id || IsHandler(alert, me.Id))
        {
            return;
        }

        if (me.UserType is UserType.Merchant or UserType.MerchantStaff
            && alert.MerchantId is not null
            && await _merchant.CanOperateMerchantAsync(alert.MerchantId.Value, ct))
        {
            return;
        }

        throw AppException.Forbidden("无权查看该告警");
    }

    private async Task EnsureOperableAsync(EmergencyAlert alert, CancellationToken ct)
    {
        var me = await _merchant.GetCurrentUserAsync(ct);
        _currentOperatorId = me.Id;

        if (IsStaff(me) || alert.ReportedBy == me.Id || IsHandler(alert, me.Id))
        {
            return;
        }

        if (me.UserType is UserType.Merchant or UserType.MerchantStaff
            && alert.MerchantId is not null
            && await _merchant.CanOperateMerchantAsync(alert.MerchantId.Value, ct))
        {
            return;
        }

        throw AppException.Forbidden("无权操作该告警");
    }

    private bool IsStaff(User me) =>
        _merchant.IsAdmin
        || me.UserType == UserType.OperationsStaff
        || _merchant.HasRole(RoleCodes.OperationsStaff);

    /// <summary>被指派为处理人的用户可查看与更新该告警。</summary>
    private static bool IsHandler(EmergencyAlert alert, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(alert.Handlers))
        {
            return false;
        }

        try
        {
            var handlers = JsonSerializer.Deserialize<List<Guid>>(alert.Handlers);
            return handlers is not null && handlers.Contains(userId);
        }
        catch
        {
            return false;
        }
    }

    private void AddTimeline(
        EmergencyAlert alert,
        Guid operatorId,
        string action,
        string? note,
        IReadOnlyList<string>? attachments = null)
    {
        _db.EmergencyTimelineEntries.Add(new EmergencyTimelineEntry
        {
            AlertId = alert.Id,
            Action = action,
            Note = note,
            Attachments = attachments is { Count: > 0 } ? JsonSerializer.Serialize(attachments) : null,
            OperatorId = operatorId
        });
    }

    private async Task<EmergencyAlertDto> MapAsync(
        EmergencyAlert alert,
        bool includeTimeline,
        CancellationToken ct)
    {
        IReadOnlyList<EmergencyTimelineDto>? timeline = null;
        if (includeTimeline)
        {
            var entries = await _db.EmergencyTimelineEntries.AsNoTracking()
                .Where(t => t.AlertId == alert.Id)
                .OrderBy(t => t.CreatedAt)
                .ToListAsync(ct);

            timeline = entries.Select(t => new EmergencyTimelineDto(
                t.Id,
                t.Action,
                t.Note,
                string.IsNullOrWhiteSpace(t.Attachments)
                    ? null
                    : JsonSerializer.Deserialize<List<string>>(t.Attachments),
                t.OperatorId,
                t.CreatedAt)).ToList();
        }

        return new EmergencyAlertDto(
            alert.Id,
            alert.Title,
            alert.Content,
            alert.Level.ToString(),
            alert.Status.ToString(),
            alert.Source,
            alert.RelatedId,
            alert.MerchantId,
            alert.ReportedBy,
            alert.ReportedAt,
            string.IsNullOrWhiteSpace(alert.Handlers)
                ? null
                : JsonSerializer.Deserialize<List<Guid>>(alert.Handlers),
            alert.DisposalPlan,
            alert.DeadlineAt,
            alert.Result,
            alert.ClosedAt,
            alert.CreatedAt,
            timeline);
    }
}
