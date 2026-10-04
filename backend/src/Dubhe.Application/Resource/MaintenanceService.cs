using System.Text.Json;
using Dubhe.Application.Abstractions;
using Dubhe.Application.Common;
using Dubhe.Application.Resource.Dtos;
using Dubhe.Domain.Auth;
using Dubhe.Domain.Common;
using Dubhe.Domain.Resource;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Resource;

public interface IMaintenanceService
{
    Task<MaintenancePlanDto> UpsertPlanAsync(UpsertMaintenancePlanRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<MaintenancePlanDto>> ListPlansAsync(Guid? droneId, CancellationToken ct = default);
    Task<MaintenanceRecordDto> CreateRecordAsync(CreateMaintenanceRecordRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<MaintenanceRecordDto>> ListRecordsAsync(Guid? droneId, DateTimeOffset? from, DateTimeOffset? to, CancellationToken ct = default);
}

public sealed class MaintenanceService : IMaintenanceService
{
    private static readonly TimeSpan DueSoonWindow = TimeSpan.FromDays(7);
    private const int DueSoonFlightMinutes = 60;

    private readonly IAppDbContext _db;
    private readonly MerchantContext _merchant;
    private readonly IDateTime _clock;

    public MaintenanceService(IAppDbContext db, MerchantContext merchant, IDateTime clock)
    {
        _db = db;
        _merchant = merchant;
        _clock = clock;
    }

    public async Task<MaintenancePlanDto> UpsertPlanAsync(
        UpsertMaintenancePlanRequest request,
        CancellationToken ct = default)
    {
        if (request.IntervalDays is <= 0 || request.IntervalFlightMinutes is <= 0)
        {
            throw AppException.Validation("维保周期必须大于 0");
        }

        if (request.IntervalDays is null && request.IntervalFlightMinutes is null)
        {
            throw AppException.Validation("至少填写一种维保周期（天数或飞行时长）");
        }

        var drone = await _db.Drones.FirstOrDefaultAsync(d => d.Id == request.DroneId, ct)
            ?? throw AppException.NotFound("飞行器不存在");

        if (!_merchant.CanOverseeResources && !await _merchant.CanOperateMerchantAsync(drone.MerchantId, ct))
        {
            throw AppException.Forbidden("无权操作该飞行器");
        }

        var plan = await _db.MaintenancePlans
            .FirstOrDefaultAsync(p => p.DroneId == drone.Id, ct);

        var now = _clock.UtcNow;
        if (plan is null)
        {
            plan = new MaintenancePlan
            {
                MerchantId = drone.MerchantId,
                DroneId = drone.Id,
                LastMaintainedAt = now,
                LastMaintainedFlightMinutes = drone.CumulativeFlightMinutes
            };
            _db.MaintenancePlans.Add(plan);
        }

        plan.Enabled = request.Enabled;
        plan.IntervalDays = request.IntervalDays;
        plan.IntervalFlightMinutes = request.IntervalFlightMinutes;
        plan.Remark = request.Remark;
        Recalculate(plan);

        await _db.SaveChangesAsync(ct);
        return Map(plan, drone);
    }

    public async Task<IReadOnlyList<MaintenancePlanDto>> ListPlansAsync(
        Guid? droneId,
        CancellationToken ct = default)
    {
        var q = _db.MaintenancePlans.AsNoTracking();

        if (_merchant.CanOverseeResources)
        {
            if (droneId is not null)
            {
                q = q.Where(p => p.DroneId == droneId);
            }
        }
        else
        {
            var merchantId = await _merchant.ResolveMerchantIdAsync(null, ct);
            q = q.Where(p => p.MerchantId == merchantId);
            if (droneId is not null)
            {
                q = q.Where(p => p.DroneId == droneId);
            }
        }

        var plans = await q.OrderByDescending(p => p.CreatedAt).ToListAsync(ct);
        var droneIds = plans.Select(p => p.DroneId).Distinct().ToList();
        var drones = await _db.Drones.AsNoTracking()
            .Where(d => droneIds.Contains(d.Id))
            .ToDictionaryAsync(d => d.Id, ct);

        return plans
            .Where(p => drones.ContainsKey(p.DroneId))
            .Select(p => Map(p, drones[p.DroneId]))
            .ToList();
    }

    public async Task<MaintenanceRecordDto> CreateRecordAsync(
        CreateMaintenanceRecordRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Type) || string.IsNullOrWhiteSpace(request.Content))
        {
            throw AppException.Validation("维保类型与内容不能为空");
        }

        var drone = await _db.Drones.FirstOrDefaultAsync(d => d.Id == request.DroneId, ct)
            ?? throw AppException.NotFound("飞行器不存在");

        if (!_merchant.CanOverseeResources && !await _merchant.CanOperateMerchantAsync(drone.MerchantId, ct))
        {
            throw AppException.Forbidden("无权操作该飞行器");
        }

        if (request.CrewMemberId is not null)
        {
            var crewExists = await _db.CrewMembers.AnyAsync(
                c => c.Id == request.CrewMemberId && c.MerchantId == drone.MerchantId, ct);
            if (!crewExists)
            {
                throw AppException.Validation("维保人员不存在");
            }
        }

        var maintainedAt = request.MaintainedAt.ToUniversalTime();

        var record = new MaintenanceRecord
        {
            MerchantId = drone.MerchantId,
            DroneId = drone.Id,
            PlanId = request.PlanId,
            CrewMemberId = request.CrewMemberId,
            Type = request.Type.Trim(),
            Content = request.Content.Trim(),
            MaintainedAt = maintainedAt,
            FileUrl = request.FileUrl
        };

        _db.MaintenanceRecords.Add(record);
        drone.LastMaintainedAt = maintainedAt;
        drone.HealthScore = 100;

        if (request.PlanId is not null)
        {
            var plan = await _db.MaintenancePlans
                .FirstOrDefaultAsync(p => p.Id == request.PlanId && p.DroneId == drone.Id, ct);
            if (plan is not null)
            {
                plan.LastMaintainedAt = maintainedAt;
                plan.LastMaintainedFlightMinutes = drone.CumulativeFlightMinutes;
                Recalculate(plan);
            }
        }

        await _db.SaveChangesAsync(ct);
        return Map(record);
    }

    public async Task<IReadOnlyList<MaintenanceRecordDto>> ListRecordsAsync(
        Guid? droneId,
        DateTimeOffset? from,
        DateTimeOffset? to,
        CancellationToken ct = default)
    {
        var q = _db.MaintenanceRecords.AsNoTracking();

        if (_merchant.CanOverseeResources)
        {
            if (droneId is not null)
            {
                q = q.Where(r => r.DroneId == droneId);
            }
        }
        else
        {
            var merchantId = await _merchant.ResolveMerchantIdAsync(null, ct);
            q = q.Where(r => r.MerchantId == merchantId);
            if (droneId is not null)
            {
                q = q.Where(r => r.DroneId == droneId);
            }
        }

        if (from is not null)
        {
            q = q.Where(r => r.MaintainedAt >= from);
        }

        if (to is not null)
        {
            q = q.Where(r => r.MaintainedAt <= to);
        }

        var rows = await q.OrderByDescending(r => r.MaintainedAt).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    private static void Recalculate(MaintenancePlan plan)
    {
        plan.NextDueAt = plan.IntervalDays is null || plan.LastMaintainedAt is null
            ? null
            : plan.LastMaintainedAt.Value.AddDays(plan.IntervalDays.Value);

        plan.NextDueFlightMinutes = plan.IntervalFlightMinutes is null
            ? null
            : (plan.LastMaintainedFlightMinutes ?? 0) + plan.IntervalFlightMinutes.Value;
    }

    private MaintenancePlanDto Map(MaintenancePlan plan, Drone drone)
    {
        var status = !plan.Enabled
            ? "Disabled"
            : plan.IsOverdue(drone.CumulativeFlightMinutes, _clock.UtcNow)
                ? "Overdue"
                : plan.IsDueSoon(drone.CumulativeFlightMinutes, _clock.UtcNow, DueSoonWindow, DueSoonFlightMinutes)
                    ? "DueSoon"
                    : "Ok";

        return new MaintenancePlanDto(
            plan.Id,
            plan.DroneId,
            drone.SerialNo,
            plan.Enabled,
            plan.IntervalDays,
            plan.IntervalFlightMinutes,
            plan.LastMaintainedAt,
            plan.LastMaintainedFlightMinutes,
            plan.NextDueAt,
            plan.NextDueFlightMinutes,
            status,
            plan.Remark);
    }

    private static MaintenanceRecordDto Map(MaintenanceRecord record) => new(
        record.Id,
        record.DroneId,
        record.PlanId,
        record.CrewMemberId,
        record.Type,
        record.Content,
        record.MaintainedAt,
        record.FileUrl,
        record.CreatedAt);
}

public interface IFaultService
{
    Task<FaultDto> ReportAsync(ReportFaultRequest request, CancellationToken ct = default);
    Task<PagedResult<FaultDto>> SearchAsync(FaultQuery query, CancellationToken ct = default);
    Task<FaultDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<FaultDto> HandleAsync(Guid id, HandleFaultRequest request, CancellationToken ct = default);
    Task<FaultDto> ResolveAsync(Guid id, ResolveFaultRequest request, CancellationToken ct = default);
}

public sealed class FaultService : IFaultService
{
    private readonly IAppDbContext _db;
    private readonly MerchantContext _merchant;
    private readonly ICurrentUser _currentUser;
    private readonly IDateTime _clock;

    public FaultService(
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

    public async Task<FaultDto> ReportAsync(ReportFaultRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.FaultType) || string.IsNullOrWhiteSpace(request.Description))
        {
            throw AppException.Validation("故障类型与描述不能为空");
        }

        var drone = await _db.Drones.FirstOrDefaultAsync(d => d.Id == request.DroneId, ct)
            ?? throw AppException.NotFound("飞行器不存在");

        var me = await _merchant.GetCurrentUserAsync(ct);
        var isPilot = me.UserType == UserType.Pilot || _merchant.IsPilotRole;
        if (!isPilot && !_merchant.CanOverseeResources && !await _merchant.CanOperateMerchantAsync(drone.MerchantId, ct))
        {
            throw AppException.Forbidden("无权上报该飞行器故障");
        }

        var fault = new DroneFault
        {
            MerchantId = drone.MerchantId,
            DroneId = drone.Id,
            FaultType = request.FaultType.Trim(),
            Description = request.Description.Trim(),
            PhotoUrls = request.PhotoUrls is { Count: > 0 } ? JsonSerializer.Serialize(request.PhotoUrls) : null,
            Lat = request.Lat,
            Lng = request.Lng,
            Status = FaultStatus.Reported,
            ReportedBy = me.Id,
            ReportedAt = _clock.UtcNow
        };

        if (drone.Status == DroneStatus.Idle)
        {
            drone.Status = DroneStatus.Maintenance;
        }

        _db.DroneFaults.Add(fault);
        await _db.SaveChangesAsync(ct);
        return Map(fault);
    }

    public async Task<PagedResult<FaultDto>> SearchAsync(FaultQuery query, CancellationToken ct = default)
    {
        var pageNum = Math.Max(1, query.PageNum);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var q = _db.DroneFaults.AsNoTracking();

        if (_merchant.CanOverseeResources)
        {
            if (query.MerchantId is not null)
            {
                q = q.Where(f => f.MerchantId == query.MerchantId);
            }
        }
        else
        {
            var me = await _merchant.GetCurrentUserAsync(ct);
            if (me.UserType == UserType.Pilot || _merchant.IsPilotRole)
            {
                // 机长仅可见本人上报的故障
                q = q.Where(f => f.ReportedBy == me.Id);
            }
            else
            {
                var merchantId = await _merchant.ResolveMerchantIdAsync(query.MerchantId, ct);
                q = q.Where(f => f.MerchantId == merchantId);
            }
        }

        if (query.DroneId is not null)
        {
            q = q.Where(f => f.DroneId == query.DroneId);
        }

        if (query.Status is not null)
        {
            q = q.Where(f => f.Status == query.Status);
        }

        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(f => f.ReportedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<FaultDto>
        {
            Items = rows.Select(Map).ToList(),
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task<FaultDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var fault = await _db.DroneFaults.AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == id, ct)
            ?? throw AppException.NotFound("故障记录不存在");

        if (!_merchant.CanOverseeResources)
        {
            var me = await _merchant.GetCurrentUserAsync(ct);
            if (fault.ReportedBy != me.Id &&
                !await _merchant.CanOperateMerchantAsync(fault.MerchantId, ct))
            {
                throw AppException.Forbidden("无权查看该故障记录");
            }
        }

        return Map(fault);
    }

    public async Task<FaultDto> HandleAsync(Guid id, HandleFaultRequest request, CancellationToken ct = default)
    {
        var fault = await _db.DroneFaults.FirstOrDefaultAsync(f => f.Id == id, ct)
            ?? throw AppException.NotFound("故障记录不存在");

        if (!_merchant.CanOverseeResources && !await _merchant.CanOperateMerchantAsync(fault.MerchantId, ct))
        {
            throw AppException.Forbidden("无权处理该故障");
        }

        var crew = await _db.CrewMembers.FirstOrDefaultAsync(
            c => c.Id == request.HandlerCrewId && c.MerchantId == fault.MerchantId, ct)
            ?? throw AppException.Validation("处理人员不存在");

        fault.HandlerCrewId = crew.Id;
        if (fault.Status == FaultStatus.Reported)
        {
            fault.Status = FaultStatus.Handling;
        }

        await _db.SaveChangesAsync(ct);
        return Map(fault);
    }

    public async Task<FaultDto> ResolveAsync(Guid id, ResolveFaultRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Resolution))
        {
            throw AppException.Validation("处理结果不能为空");
        }

        var fault = await _db.DroneFaults.FirstOrDefaultAsync(f => f.Id == id, ct)
            ?? throw AppException.NotFound("故障记录不存在");

        if (!_merchant.CanOverseeResources && !await _merchant.CanOperateMerchantAsync(fault.MerchantId, ct))
        {
            throw AppException.Forbidden("无权处理该故障");
        }

        if (fault.Status == FaultStatus.Resolved)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "该故障已处理完成");
        }

        var now = _clock.UtcNow;
        fault.Status = FaultStatus.Resolved;
        fault.Resolution = request.Resolution.Trim();
        fault.ResolvedAt = now;

        _db.MaintenanceRecords.Add(new MaintenanceRecord
        {
            MerchantId = fault.MerchantId,
            DroneId = fault.DroneId,
            CrewMemberId = fault.HandlerCrewId,
            Type = "故障维修",
            Content = request.Resolution.Trim(),
            MaintainedAt = now
        });

        var drone = await _db.Drones.FirstOrDefaultAsync(d => d.Id == fault.DroneId, ct);
        if (drone is not null)
        {
            if (drone.Status == DroneStatus.Maintenance)
            {
                drone.Status = DroneStatus.Idle;
            }

            drone.LastMaintainedAt = now;
            drone.HealthScore = 100;
        }

        await _db.SaveChangesAsync(ct);
        return Map(fault);
    }

    private static FaultDto Map(DroneFault fault) => new(
        fault.Id,
        fault.MerchantId,
        fault.DroneId,
        fault.FaultType,
        fault.Description,
        string.IsNullOrWhiteSpace(fault.PhotoUrls)
            ? null
            : JsonSerializer.Deserialize<List<string>>(fault.PhotoUrls),
        fault.Lat,
        fault.Lng,
        fault.Status.ToString(),
        fault.HandlerCrewId,
        fault.Resolution,
        fault.ReportedBy,
        fault.ReportedAt,
        fault.ResolvedAt);
}
