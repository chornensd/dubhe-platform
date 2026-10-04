using System.Text.Json;
using Dubhe.Application.Abstractions;
using Dubhe.Application.Airspace.Dtos;
using Dubhe.Application.Common;
using Dubhe.Domain.Airspace;
using Dubhe.Domain.Auth;
using Dubhe.Domain.Common;
using Dubhe.Domain.Support;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Airspace;

public interface IFlightPlanService
{
    Task<FlightPlanDto> CreateAsync(CreateFlightPlanRequest request, CancellationToken ct = default);
    Task<FlightPlanDto> UpdateAsync(Guid id, CreateFlightPlanRequest request, CancellationToken ct = default);
    Task<FlightPlanDto> SubmitAsync(Guid id, CancellationToken ct = default);
    Task<FlightPlanDto> ApproveAsync(Guid id, ApproveFlightPlanRequest request, CancellationToken ct = default);
    Task<FlightPlanDto> RejectAsync(Guid id, RejectFlightPlanRequest request, CancellationToken ct = default);
    Task<FlightPlanDto> CancelAsync(Guid id, CancellationToken ct = default);
    Task<FlightPlanDto> CompleteAsync(Guid id, CancellationToken ct = default);
    Task<ApprovalSuggestionDto> SuggestAsync(Guid id, CancellationToken ct = default);
    Task<PagedResult<FlightPlanDto>> SearchAsync(FlightPlanQuery query, CancellationToken ct = default);
    Task<FlightPlanDto> GetAsync(Guid id, CancellationToken ct = default);
}

public sealed class FlightPlanService : IFlightPlanService
{
    private const double ProximityCautionKm = 0.5;

    private readonly IAppDbContext _db;
    private readonly MerchantContext _merchant;
    private readonly IDateTime _clock;
    private readonly IAirspaceCheckService _checkService;

    public FlightPlanService(
        IAppDbContext db,
        MerchantContext merchant,
        IDateTime clock,
        IAirspaceCheckService checkService)
    {
        _db = db;
        _merchant = merchant;
        _clock = clock;
        _checkService = checkService;
    }

    public async Task<FlightPlanDto> CreateAsync(CreateFlightPlanRequest request, CancellationToken ct = default)
    {
        var (merchantId, route) = await ValidateAsync(request, ct);
        var plan = new FlightPlan
        {
            MerchantId = merchantId,
            Status = FlightPlanStatus.Draft,
            Waypoints = JsonSerializer.Serialize(request.Waypoints)
        };
        Apply(plan, request, route.Count);
        _db.FlightPlans.Add(plan);
        await _db.SaveChangesAsync(ct);
        return await MapAsync(plan, ct);
    }

    public async Task<FlightPlanDto> UpdateAsync(Guid id, CreateFlightPlanRequest request, CancellationToken ct = default)
    {
        var plan = await GetTrackedAsync(id, ct);
        await EnsureOperatorAsync(plan, ct);
        if (plan.Status != FlightPlanStatus.Draft)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "仅草稿状态飞行计划可修改");
        }

        var (_, route) = await ValidateAsync(request, ct);
        Apply(plan, request, route.Count);
        await _db.SaveChangesAsync(ct);
        return await MapAsync(plan, ct);
    }

    public async Task<FlightPlanDto> SubmitAsync(Guid id, CancellationToken ct = default)
    {
        var plan = await GetTrackedAsync(id, ct);
        await EnsureOperatorAsync(plan, ct);
        if (plan.Status is not (FlightPlanStatus.Draft or FlightPlanStatus.Rejected))
        {
            throw new AppException(ErrorCodes.ResourceConflict, "仅草稿或已驳回的飞行计划可提交审批");
        }

        var route = ParseWaypoints(plan.Waypoints).Select(w => new GeoPoint(w.Lat, w.Lng)).ToList();
        var result = await _checkService.CheckAsync(
            plan.MerchantId,
            plan.Id,
            plan.DroneId,
            plan.StartAt,
            plan.EndAt,
            plan.MaxAltitudeM,
            route,
            ct);

        plan.CheckResult = JsonSerializer.Serialize(result.Conflicts);

        if (!result.Passed)
        {
            await _db.SaveChangesAsync(ct);
            var detail = string.Join("；", result.Conflicts.Take(3).Select(c => c.Reason));
            throw new AppException(ErrorCodes.AirspaceConflict, $"空域校验未通过：{detail}");
        }

        plan.Status = FlightPlanStatus.Submitted;
        plan.SubmittedAt = _clock.UtcNow;
        plan.RejectReason = null;
        await _db.SaveChangesAsync(ct);
        return await MapAsync(plan, ct);
    }

    public async Task<FlightPlanDto> ApproveAsync(Guid id, ApproveFlightPlanRequest request, CancellationToken ct = default)
    {
        var plan = await GetTrackedAsync(id, ct);
        if (plan.Status != FlightPlanStatus.Submitted)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "仅待审批飞行计划可通过");
        }

        var me = await _merchant.GetCurrentUserAsync(ct);
        var now = _clock.UtcNow;
        plan.Status = FlightPlanStatus.Approved;
        plan.PlanNo = $"FP{now:yyyyMMdd}{Guid.NewGuid():N}"[..18].ToUpperInvariant();
        plan.ApprovedAt = now;
        plan.ApproverId = me.Id;
        plan.ApprovalComment = request.Comment;

        _db.Notifications.Add(new Notification
        {
            UserId = plan.MerchantId,
            Type = NotificationType.FlightPlanApproved,
            Title = "飞行计划已批准",
            Content = $"飞行计划 {plan.PlanNo} 已批准，飞行时段 {plan.StartAt.LocalDateTime:MM-dd HH:mm} ~ {plan.EndAt.LocalDateTime:MM-dd HH:mm}",
            RelatedId = plan.Id
        });

        await _db.SaveChangesAsync(ct);
        return await MapAsync(plan, ct);
    }

    public async Task<FlightPlanDto> RejectAsync(Guid id, RejectFlightPlanRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw AppException.Validation("驳回原因不能为空");
        }

        var plan = await GetTrackedAsync(id, ct);
        if (plan.Status != FlightPlanStatus.Submitted)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "仅待审批飞行计划可驳回");
        }

        plan.Status = FlightPlanStatus.Rejected;
        plan.RejectReason = request.Reason.Trim();

        _db.Notifications.Add(new Notification
        {
            UserId = plan.MerchantId,
            Type = NotificationType.FlightPlanRejected,
            Title = "飞行计划已驳回",
            Content = $"飞行计划被驳回：{plan.RejectReason}",
            RelatedId = plan.Id
        });

        await _db.SaveChangesAsync(ct);
        return await MapAsync(plan, ct);
    }

    public async Task<FlightPlanDto> CancelAsync(Guid id, CancellationToken ct = default)
    {
        var plan = await GetTrackedAsync(id, ct);
        await EnsureOperatorAsync(plan, ct);
        if (plan.Status is FlightPlanStatus.Cancelled or FlightPlanStatus.Completed)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "飞行计划已结束，无法取消");
        }

        plan.Status = FlightPlanStatus.Cancelled;
        plan.CancelledAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await MapAsync(plan, ct);
    }

    public async Task<FlightPlanDto> CompleteAsync(Guid id, CancellationToken ct = default)
    {
        var plan = await GetTrackedAsync(id, ct);
        await EnsureOperatorAsync(plan, ct);
        if (plan.Status != FlightPlanStatus.Approved)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "仅已批准的飞行计划可完成");
        }

        plan.Status = FlightPlanStatus.Completed;
        await _db.SaveChangesAsync(ct);
        return await MapAsync(plan, ct);
    }

    public async Task<ApprovalSuggestionDto> SuggestAsync(Guid id, CancellationToken ct = default)
    {
        var plan = await GetTrackedAsync(id, ct);
        var route = ParseWaypoints(plan.Waypoints).Select(w => new GeoPoint(w.Lat, w.Lng)).ToList();
        var result = await _checkService.CheckAsync(
            plan.MerchantId,
            plan.Id,
            plan.DroneId,
            plan.StartAt,
            plan.EndAt,
            plan.MaxAltitudeM,
            route,
            ct);

        if (result.Conflicts.Count > 0)
        {
            return new ApprovalSuggestionDto("Reject", result.Conflicts.Select(c => c.Reason).ToList());
        }

        if (result.NearestNoFlyDistanceKm < ProximityCautionKm)
        {
            return new ApprovalSuggestionDto("Review", new[]
            {
                $"航线距离禁飞区仅 {result.NearestNoFlyDistanceKm:0.00} 公里，建议人工复核"
            });
        }

        var history = await _db.FlightPlans.AsNoTracking()
            .Where(p => p.MerchantId == plan.MerchantId
                        && (p.Status == FlightPlanStatus.Approved || p.Status == FlightPlanStatus.Rejected))
            .GroupBy(p => p.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var approved = history.FirstOrDefault(h => h.Status == FlightPlanStatus.Approved)?.Count ?? 0;
        var rejected = history.FirstOrDefault(h => h.Status == FlightPlanStatus.Rejected)?.Count ?? 0;
        var decided = approved + rejected;

        if (decided >= 3 && (double)approved / decided < 0.6)
        {
            return new ApprovalSuggestionDto("Review", new[]
            {
                $"该商家历史审批通过率 {(double)approved / decided:P0}，建议人工复核"
            });
        }

        return new ApprovalSuggestionDto("Approve", new[]
        {
            "未发现空域冲突，历史记录良好"
        });
    }

    public async Task<PagedResult<FlightPlanDto>> SearchAsync(FlightPlanQuery query, CancellationToken ct = default)
    {
        var pageNum = Math.Max(1, query.PageNum);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var q = _db.FlightPlans.AsNoTracking();

        var me = await _merchant.GetCurrentUserAsync(ct);
        var overseer = _merchant.IsAdmin || me.UserType == UserType.AirTrafficController;

        if (overseer)
        {
            if (query.MerchantId is not null)
            {
                q = q.Where(p => p.MerchantId == query.MerchantId);
            }
        }
        else
        {
            var merchantId = await _merchant.ResolveMerchantIdAsync(query.MerchantId, ct);
            q = q.Where(p => p.MerchantId == merchantId);
        }

        if (query.Status is not null)
        {
            q = q.Where(p => p.Status == query.Status);
        }

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var keyword = query.Keyword.Trim();
            q = q.Where(p => (p.PlanNo != null && p.PlanNo.Contains(keyword)) || p.Purpose.Contains(keyword));
        }

        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(p => p.CreatedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var items = new List<FlightPlanDto>();
        foreach (var row in rows)
        {
            items.Add(await MapAsync(row, ct));
        }

        return new PagedResult<FlightPlanDto>
        {
            Items = items,
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task<FlightPlanDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var plan = await _db.FlightPlans.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw AppException.NotFound("飞行计划不存在");

        var me = await _merchant.GetCurrentUserAsync(ct);
        var overseer = _merchant.IsAdmin || me.UserType == UserType.AirTrafficController;
        if (!overseer && !await _merchant.CanOperateMerchantAsync(plan.MerchantId, ct))
        {
            throw AppException.Forbidden("无权查看该飞行计划");
        }

        return await MapAsync(plan, ct);
    }

    private async Task<(Guid MerchantId, List<GeoPoint> Route)> ValidateAsync(
        CreateFlightPlanRequest request,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Purpose))
        {
            throw AppException.Validation("飞行目的不能为空");
        }

        if (request.EndAt <= request.StartAt)
        {
            throw AppException.Validation("结束时间必须晚于开始时间");
        }

        if (request.StartAt < _clock.UtcNow.AddMinutes(-5))
        {
            throw AppException.Validation("开始时间不能早于当前时间");
        }

        if (request.MaxAltitudeM is < 10 or > 1000)
        {
            throw AppException.Validation("飞行高度需在 10-1000 米之间");
        }

        if (request.Waypoints is null || request.Waypoints.Count < 2)
        {
            throw AppException.Validation("航线至少需要 2 个航点");
        }

        if (request.Waypoints.Any(w =>
                w.Lat is < -90 or > 90 || w.Lng is < -180 or > 180 || (w.Lat == 0 && w.Lng == 0)))
        {
            throw AppException.Validation("航点坐标不合法");
        }

        var merchantId = await _merchant.ResolveMerchantIdAsync(request.MerchantId, ct);

        var drone = await _db.Drones.AsNoTracking().FirstOrDefaultAsync(d => d.Id == request.DroneId, ct)
            ?? throw AppException.NotFound("飞行器不存在");
        if (drone.MerchantId != merchantId)
        {
            throw AppException.Forbidden("飞行器不属于该商家");
        }

        if (request.OrderId is not null)
        {
            var orderOk = await _db.Orders.AnyAsync(
                o => o.Id == request.OrderId && o.MerchantId == merchantId, ct);
            if (!orderOk)
            {
                throw AppException.Validation("关联订单不存在或不属于该商家");
            }
        }

        if (request.PilotCrewId is not null)
        {
            var crewOk = await _db.CrewMembers.AnyAsync(
                c => c.Id == request.PilotCrewId && c.MerchantId == merchantId, ct);
            if (!crewOk)
            {
                throw AppException.Validation("机长不存在或不属于该商家");
            }
        }

        return (merchantId, request.Waypoints.Select(w => new GeoPoint(w.Lat, w.Lng)).ToList());
    }

    private static void Apply(FlightPlan plan, CreateFlightPlanRequest request, int routeCount)
    {
        plan.OrderId = request.OrderId;
        plan.DroneId = request.DroneId;
        plan.PilotCrewId = request.PilotCrewId;
        plan.Purpose = request.Purpose.Trim();
        plan.StartAt = request.StartAt.ToUniversalTime();
        plan.EndAt = request.EndAt.ToUniversalTime();
        plan.MaxAltitudeM = request.MaxAltitudeM;
        plan.Waypoints = JsonSerializer.Serialize(request.Waypoints);
    }

    private async Task<FlightPlan> GetTrackedAsync(Guid id, CancellationToken ct) =>
        await _db.FlightPlans.FirstOrDefaultAsync(p => p.Id == id, ct)
        ?? throw AppException.NotFound("飞行计划不存在");

    private async Task EnsureOperatorAsync(FlightPlan plan, CancellationToken ct)
    {
        if (!await _merchant.CanOperateMerchantAsync(plan.MerchantId, ct))
        {
            throw AppException.Forbidden("无权操作该飞行计划");
        }
    }

    private static List<FlightPlanWaypointDto> ParseWaypoints(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<FlightPlanWaypointDto>>(json) ?? new List<FlightPlanWaypointDto>();
        }
        catch
        {
            return new List<FlightPlanWaypointDto>();
        }
    }

    private async Task<FlightPlanDto> MapAsync(FlightPlan plan, CancellationToken ct)
    {
        var droneSerial = await _db.Drones.AsNoTracking()
            .Where(d => d.Id == plan.DroneId)
            .Select(d => d.SerialNo)
            .FirstOrDefaultAsync(ct);

        string? pilotName = null;
        if (plan.PilotCrewId is not null)
        {
            pilotName = await _db.CrewMembers.AsNoTracking()
                .Where(c => c.Id == plan.PilotCrewId)
                .Select(c => c.Name)
                .FirstOrDefaultAsync(ct);
        }

        List<AirspaceConflictDto>? conflicts = null;
        if (!string.IsNullOrWhiteSpace(plan.CheckResult))
        {
            try
            {
                conflicts = JsonSerializer.Deserialize<List<AirspaceConflictDto>>(plan.CheckResult);
            }
            catch
            {
                conflicts = null;
            }
        }

        return new FlightPlanDto(
            plan.Id,
            plan.PlanNo,
            plan.MerchantId,
            plan.OrderId,
            plan.DroneId,
            droneSerial,
            plan.PilotCrewId,
            pilotName,
            plan.Purpose,
            plan.StartAt,
            plan.EndAt,
            plan.MaxAltitudeM,
            ParseWaypoints(plan.Waypoints),
            plan.Status.ToString(),
            conflicts,
            plan.SubmittedAt,
            plan.ApprovedAt,
            plan.ApprovalComment,
            plan.RejectReason,
            plan.CancelledAt,
            plan.CreatedAt);
    }
}
