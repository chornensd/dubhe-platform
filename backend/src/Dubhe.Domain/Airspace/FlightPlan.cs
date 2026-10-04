using Dubhe.Domain.Common;

namespace Dubhe.Domain.Airspace;

public enum FlightPlanStatus
{
    Draft = 1,
    Submitted = 2,
    Approved = 3,
    Rejected = 4,
    Cancelled = 5,
    Completed = 6
}

public class FlightPlan : BaseEntity
{
    public string? PlanNo { get; set; }
    public Guid MerchantId { get; set; }
    public Guid? OrderId { get; set; }
    public Guid DroneId { get; set; }
    public Guid? PilotCrewId { get; set; }
    public string Purpose { get; set; } = string.Empty;
    public DateTimeOffset StartAt { get; set; }
    public DateTimeOffset EndAt { get; set; }
    public double MaxAltitudeM { get; set; }
    public string Waypoints { get; set; } = "[]";
    public FlightPlanStatus Status { get; set; } = FlightPlanStatus.Draft;
    public string? CheckResult { get; set; }
    public DateTimeOffset? SubmittedAt { get; set; }
    public DateTimeOffset? ApprovedAt { get; set; }
    public Guid? ApproverId { get; set; }
    public string? ApprovalComment { get; set; }
    public string? RejectReason { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }
}
