using Dubhe.Domain.Common;

namespace Dubhe.Domain.Airspace;

public enum ViolationType
{
    NoFlyIntrusion = 1,
    FenceBreach = 2,
    RouteDeviation = 3,
    AltitudeViolation = 4,
    TimeViolation = 5
}

public enum ViolationStatus
{
    Open = 1,
    Handling = 2,
    Resolved = 3
}

public class ViolationRecord : BaseEntity
{
    public Guid MerchantId { get; set; }
    public Guid? DroneId { get; set; }
    public Guid? OrderId { get; set; }
    public Guid? FlightPlanId { get; set; }
    public ViolationType Type { get; set; }
    public string Description { get; set; } = string.Empty;
    public double? Lat { get; set; }
    public double? Lng { get; set; }
    public double? AltitudeM { get; set; }
    public ViolationStatus Status { get; set; } = ViolationStatus.Open;
    public string? Resolution { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
}

public enum PenaltyType
{
    Warning = 1,
    Fine = 2,
    Suspend = 3,
    Ban = 4
}

public class PenaltyRecord : BaseEntity
{
    public Guid ViolationId { get; set; }
    public Guid MerchantId { get; set; }
    public PenaltyType Type { get; set; }
    public decimal? FineAmount { get; set; }
    public int? SuspendDays { get; set; }
    public string Reason { get; set; } = string.Empty;
    public Guid IssuedBy { get; set; }
    public DateTimeOffset IssuedAt { get; set; }
}
