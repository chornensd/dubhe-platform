using System.Text.Json;
using Dubhe.Application.Abstractions;
using Dubhe.Application.Airspace.Dtos;
using Dubhe.Application.Common;
using Dubhe.Domain.Airspace;
using Dubhe.Domain.Auth;
using Dubhe.Domain.Common;
using Dubhe.Domain.Order;
using Dubhe.Domain.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Dubhe.Application.Airspace;

public interface IViolationService
{
    Task<ViolationDto> ReportAsync(ReportViolationRequest request, CancellationToken ct = default);
    Task<PagedResult<ViolationDto>> SearchAsync(ViolationQuery query, CancellationToken ct = default);
    Task<ViolationDto> HandleAsync(Guid id, HandleViolationRequest request, CancellationToken ct = default);
    Task<ViolationDto> ResolveAsync(Guid id, ResolveViolationRequest request, CancellationToken ct = default);
    Task<PenaltyDto> IssuePenaltyAsync(Guid id, IssuePenaltyRequest request, CancellationToken ct = default);
}

public sealed class ViolationService : IViolationService
{
    private readonly IAppDbContext _db;
    private readonly MerchantContext _merchant;
    private readonly IDateTime _clock;

    public ViolationService(IAppDbContext db, MerchantContext merchant, IDateTime clock)
    {
        _db = db;
        _merchant = merchant;
        _clock = clock;
    }

    public async Task<ViolationDto> ReportAsync(ReportViolationRequest request, CancellationToken ct = default)
    {
        if (!Enum.IsDefined(typeof(ViolationType), request.Type))
        {
            throw AppException.Validation("违规类型不合法");
        }

        if (string.IsNullOrWhiteSpace(request.Description))
        {
            throw AppException.Validation("违规描述不能为空");
        }

        var merchantExists = await _db.Users.AnyAsync(
            u => u.Id == request.MerchantId && u.UserType == UserType.Merchant, ct);
        if (!merchantExists)
        {
            throw AppException.Validation("商家不存在");
        }

        if (request.DroneId is not null)
        {
            var droneOk = await _db.Drones.AnyAsync(
                d => d.Id == request.DroneId && d.MerchantId == request.MerchantId, ct);
            if (!droneOk)
            {
                throw AppException.Validation("飞行器不存在或不属于该商家");
            }
        }

        var violation = CreateViolation(
            request.MerchantId,
            request.DroneId,
            request.OrderId,
            request.FlightPlanId,
            (ViolationType)request.Type,
            request.Description.Trim(),
            request.Lat,
            request.Lng,
            request.AltitudeM,
            request.OccurredAt?.ToUniversalTime() ?? _clock.UtcNow);

        _db.ViolationRecords.Add(violation);
        await _db.SaveChangesAsync(ct);
        return Map(violation, null);
    }

    public async Task<PagedResult<ViolationDto>> SearchAsync(ViolationQuery query, CancellationToken ct = default)
    {
        var pageNum = Math.Max(1, query.PageNum);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var q = _db.ViolationRecords.AsNoTracking();

        var me = await _merchant.GetCurrentUserAsync(ct);
        var overseer = _merchant.IsAdmin || me.UserType == UserType.AirTrafficController;
        if (overseer)
        {
            if (query.MerchantId is not null)
            {
                q = q.Where(v => v.MerchantId == query.MerchantId);
            }
        }
        else
        {
            var merchantId = await _merchant.ResolveMerchantIdAsync(null, ct);
            q = q.Where(v => v.MerchantId == merchantId);
        }

        if (query.Status is not null)
        {
            q = q.Where(v => v.Status == query.Status);
        }

        if (query.Type is not null)
        {
            q = q.Where(v => v.Type == query.Type);
        }

        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(v => v.OccurredAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var ids = rows.Select(v => v.Id).ToList();
        var penalties = await _db.PenaltyRecords.AsNoTracking()
            .Where(p => ids.Contains(p.ViolationId))
            .ToListAsync(ct);

        return new PagedResult<ViolationDto>
        {
            Items = rows.Select(v => Map(v, penalties.Where(p => p.ViolationId == v.Id).Select(Map).ToList())).ToList(),
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task<ViolationDto> HandleAsync(Guid id, HandleViolationRequest request, CancellationToken ct = default)
    {
        var violation = await GetTrackedAsync(id, ct);
        if (violation.Status == ViolationStatus.Resolved)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "该违规记录已处理完成");
        }

        violation.Status = ViolationStatus.Handling;
        if (!string.IsNullOrWhiteSpace(request.Remark))
        {
            violation.Description = $"{violation.Description}（处理备注：{request.Remark.Trim()}）";
        }

        await _db.SaveChangesAsync(ct);
        return Map(violation, null);
    }

    public async Task<ViolationDto> ResolveAsync(Guid id, ResolveViolationRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Resolution))
        {
            throw AppException.Validation("处理结果不能为空");
        }

        var violation = await GetTrackedAsync(id, ct);
        violation.Status = ViolationStatus.Resolved;
        violation.Resolution = request.Resolution.Trim();
        await _db.SaveChangesAsync(ct);
        return Map(violation, null);
    }

    public async Task<PenaltyDto> IssuePenaltyAsync(Guid id, IssuePenaltyRequest request, CancellationToken ct = default)
    {
        if (!Enum.IsDefined(typeof(PenaltyType), request.Type))
        {
            throw AppException.Validation("处罚类型不合法");
        }

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw AppException.Validation("处罚依据不能为空");
        }

        var type = (PenaltyType)request.Type;
        if (type == PenaltyType.Fine && request.FineAmount is not > 0)
        {
            throw AppException.Validation("罚款金额必须大于 0");
        }

        if (type == PenaltyType.Suspend && request.SuspendDays is not (>= 1 and <= 7))
        {
            throw AppException.Validation("暂停服务天数需在 1-7 天之间");
        }

        var violation = await GetTrackedAsync(id, ct);
        var me = await _merchant.GetCurrentUserAsync(ct);
        var now = _clock.UtcNow;

        var penalty = new PenaltyRecord
        {
            ViolationId = violation.Id,
            MerchantId = violation.MerchantId,
            Type = type,
            FineAmount = type == PenaltyType.Fine ? request.FineAmount : null,
            SuspendDays = type == PenaltyType.Suspend ? request.SuspendDays : null,
            Reason = request.Reason.Trim(),
            IssuedBy = me.Id,
            IssuedAt = now
        };

        if (violation.Status == ViolationStatus.Open)
        {
            violation.Status = ViolationStatus.Handling;
        }

        _db.PenaltyRecords.Add(penalty);
        _db.Notifications.Add(new Notification
        {
            UserId = violation.MerchantId,
            Type = NotificationType.Violation,
            Title = "违规处罚通知",
            Content = $"违规记录已处罚：{type switch { PenaltyType.Warning => "警告", PenaltyType.Fine => $"罚款 {request.FineAmount:0.00} 元", PenaltyType.Suspend => $"暂停服务 {request.SuspendDays} 天", _ => "永久封禁" }}，依据：{penalty.Reason}",
            RelatedId = violation.Id
        });

        await _db.SaveChangesAsync(ct);
        return Map(penalty);
    }

    private ViolationRecord CreateViolation(
        Guid merchantId,
        Guid? droneId,
        Guid? orderId,
        Guid? flightPlanId,
        ViolationType type,
        string description,
        double? lat,
        double? lng,
        double? altitudeM,
        DateTimeOffset occurredAt) => new()
    {
        MerchantId = merchantId,
        DroneId = droneId,
        OrderId = orderId,
        FlightPlanId = flightPlanId,
        Type = type,
        Description = description,
        Lat = lat,
        Lng = lng,
        AltitudeM = altitudeM,
        Status = ViolationStatus.Open,
        OccurredAt = occurredAt
    };

    private async Task<ViolationRecord> GetTrackedAsync(Guid id, CancellationToken ct) =>
        await _db.ViolationRecords.FirstOrDefaultAsync(v => v.Id == id, ct)
        ?? throw AppException.NotFound("违规记录不存在");

    private static ViolationDto Map(ViolationRecord violation, IReadOnlyList<PenaltyDto>? penalties) => new(
        violation.Id,
        violation.MerchantId,
        violation.DroneId,
        violation.OrderId,
        violation.FlightPlanId,
        violation.Type.ToString(),
        violation.Description,
        violation.Lat,
        violation.Lng,
        violation.AltitudeM,
        violation.Status.ToString(),
        violation.Resolution,
        violation.OccurredAt,
        violation.CreatedAt,
        penalties);

    private static PenaltyDto Map(PenaltyRecord penalty) => new(
        penalty.Id,
        penalty.ViolationId,
        penalty.Type.ToString(),
        penalty.FineAmount,
        penalty.SuspendDays,
        penalty.Reason,
        penalty.IssuedBy,
        penalty.IssuedAt);
}

public interface IMonitoringService
{
    Task<PositionReportResultDto> ReportPositionAsync(ReportPositionRequest request, CancellationToken ct = default);
}

public sealed class MonitoringService : IMonitoringService
{
    private readonly IAppDbContext _db;
    private readonly MerchantContext _merchant;
    private readonly IDateTime _clock;
    private readonly AirspaceOptions _options;

    public MonitoringService(
        IAppDbContext db,
        MerchantContext merchant,
        IDateTime clock,
        IOptions<AirspaceOptions> options)
    {
        _db = db;
        _merchant = merchant;
        _clock = clock;
        _options = options.Value;
    }

    public async Task<PositionReportResultDto> ReportPositionAsync(
        ReportPositionRequest request,
        CancellationToken ct = default)
    {
        var drone = await _db.Drones.AsNoTracking().FirstOrDefaultAsync(d => d.Id == request.DroneId, ct)
            ?? throw AppException.NotFound("飞行器不存在");

        var me = await _merchant.GetCurrentUserAsync(ct);
        var isPilot = me.UserType == UserType.Pilot || _merchant.IsPilotRole;
        if (!isPilot && !await _merchant.CanOperateMerchantAsync(drone.MerchantId, ct))
        {
            throw AppException.Forbidden("无权上报该飞行器位置");
        }

        var at = request.ReportedAt?.ToUniversalTime() ?? _clock.UtcNow;
        var created = new List<ViolationRecord>();

        var zones = await _db.AirspaceZones.AsNoTracking()
            .Where(z => z.IsActive && (z.MerchantId == null || z.MerchantId == drone.MerchantId))
            .ToListAsync(ct);

        foreach (var zone in zones.Where(z => z.IsEffectiveAt(at, at)))
        {
            if (!GeoUtils.IsWithinCircle(request.Lat, request.Lng, zone.CenterLat, zone.CenterLng, zone.RadiusKm))
            {
                continue;
            }

            if (zone.MinAltitudeM is { } min && request.AltitudeM < min)
            {
                continue;
            }

            if (zone.MaxAltitudeM is { } max && request.AltitudeM > max)
            {
                continue;
            }

            var type = zone.Type == AirspaceZoneType.NoFly ? ViolationType.NoFlyIntrusion : ViolationType.FenceBreach;
            if (await HasRecentViolationAsync(drone.Id, type, at, ct))
            {
                continue;
            }

            created.Add(new ViolationRecord
            {
                MerchantId = drone.MerchantId,
                DroneId = drone.Id,
                Type = type,
                Description = $"{zone.Type switch { AirspaceZoneType.NoFly => "闯入禁飞区", AirspaceZoneType.Restricted => "进入限飞区", _ => "进入临时管制区" }}：{zone.Name}",
                Lat = request.Lat,
                Lng = request.Lng,
                AltitudeM = request.AltitudeM,
                Status = ViolationStatus.Open,
                OccurredAt = at
            });
        }

        double? distanceToRoute = null;
        var plan = await ResolveActivePlanAsync(drone.Id, request.FlightPlanId, at, ct);
        if (plan is not null)
        {
            var route = ParseWaypoints(plan.Waypoints);
            if (route.Count >= 2)
            {
                distanceToRoute = GeoUtils.DistanceToPolylineKm(
                    route.Select(w => new GeoPoint(w.Lat, w.Lng)).ToList(),
                    request.Lat,
                    request.Lng);

                if (distanceToRoute > _options.DeviationThresholdKm
                    && !await HasRecentViolationAsync(drone.Id, ViolationType.RouteDeviation, at, ct))
                {
                    created.Add(new ViolationRecord
                    {
                        MerchantId = drone.MerchantId,
                        DroneId = drone.Id,
                        FlightPlanId = plan.Id,
                        Type = ViolationType.RouteDeviation,
                        Description = $"偏离申报航线 {distanceToRoute:0.00} 公里（计划 {plan.PlanNo ?? plan.Id.ToString()[..8]}）",
                        Lat = request.Lat,
                        Lng = request.Lng,
                        AltitudeM = request.AltitudeM,
                        Status = ViolationStatus.Open,
                        OccurredAt = at
                    });
                }
            }
        }

        if (created.Count > 0)
        {
            foreach (var violation in created)
            {
                _db.ViolationRecords.Add(violation);
                _db.Notifications.Add(new Notification
                {
                    UserId = drone.MerchantId,
                    Type = NotificationType.Violation,
                    Title = "飞行违规告警",
                    Content = violation.Description,
                    RelatedId = violation.Id
                });
            }

            await _db.SaveChangesAsync(ct);
        }

        return new PositionReportResultDto(
            created.Select(v => new ViolationDto(
                v.Id, v.MerchantId, v.DroneId, v.OrderId, v.FlightPlanId,
                v.Type.ToString(), v.Description, v.Lat, v.Lng, v.AltitudeM,
                v.Status.ToString(), v.Resolution, v.OccurredAt, v.CreatedAt, null)).ToList(),
            distanceToRoute);
    }

    private async Task<FlightPlan?> ResolveActivePlanAsync(
        Guid droneId,
        Guid? flightPlanId,
        DateTimeOffset at,
        CancellationToken ct)
    {
        if (flightPlanId is not null)
        {
            return await _db.FlightPlans.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == flightPlanId && p.DroneId == droneId, ct);
        }

        return await _db.FlightPlans.AsNoTracking()
            .Where(p => p.DroneId == droneId
                        && p.Status == FlightPlanStatus.Approved
                        && p.StartAt <= at
                        && at <= p.EndAt)
            .OrderByDescending(p => p.ApprovedAt)
            .FirstOrDefaultAsync(ct);
    }

    private async Task<bool> HasRecentViolationAsync(
        Guid droneId,
        ViolationType type,
        DateTimeOffset at,
        CancellationToken ct)
    {
        var threshold = at.AddMinutes(-_options.ViolationDedupeMinutes);
        return await _db.ViolationRecords.AnyAsync(
            v => v.DroneId == droneId && v.Type == type && v.OccurredAt >= threshold, ct);
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
}
