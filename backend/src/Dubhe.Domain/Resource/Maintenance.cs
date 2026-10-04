using Dubhe.Domain.Common;

namespace Dubhe.Domain.Resource;

public class MaintenancePlan : BaseEntity
{
    public Guid MerchantId { get; set; }
    public Guid DroneId { get; set; }
    public bool Enabled { get; set; } = true;
    public int? IntervalDays { get; set; }
    public int? IntervalFlightMinutes { get; set; }
    public DateTimeOffset? LastMaintainedAt { get; set; }
    public int? LastMaintainedFlightMinutes { get; set; }
    public DateTimeOffset? NextDueAt { get; set; }
    public int? NextDueFlightMinutes { get; set; }
    public string? Remark { get; set; }

    public bool IsOverdue(int cumulativeFlightMinutes, DateTimeOffset now) =>
        Enabled
        && ((NextDueAt is not null && NextDueAt <= now)
            || (NextDueFlightMinutes is not null && cumulativeFlightMinutes >= NextDueFlightMinutes));

    public bool IsDueSoon(
        int cumulativeFlightMinutes,
        DateTimeOffset now,
        TimeSpan window,
        int remainingFlightMinutes) =>
        Enabled
        && ((NextDueAt is not null && NextDueAt <= now.Add(window))
            || (NextDueFlightMinutes is not null
                && NextDueFlightMinutes - cumulativeFlightMinutes <= remainingFlightMinutes));
}

public class MaintenanceRecord : BaseEntity
{
    public Guid MerchantId { get; set; }
    public Guid DroneId { get; set; }
    public Guid? PlanId { get; set; }
    public Guid? CrewMemberId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTimeOffset MaintainedAt { get; set; }
    public string? FileUrl { get; set; }
}

public enum FaultStatus
{
    Reported = 1,
    Handling = 2,
    Resolved = 3
}

public class DroneFault : BaseEntity
{
    public Guid MerchantId { get; set; }
    public Guid DroneId { get; set; }
    public string FaultType { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? PhotoUrls { get; set; }
    public double? Lat { get; set; }
    public double? Lng { get; set; }
    public FaultStatus Status { get; set; } = FaultStatus.Reported;
    public Guid? HandlerCrewId { get; set; }
    public string? Resolution { get; set; }
    public Guid ReportedBy { get; set; }
    public DateTimeOffset ReportedAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
}
