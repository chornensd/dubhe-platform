using Dubhe.Domain.Common;

namespace Dubhe.Domain.Resource;

/// <summary>预约用途（与前后端接口契约一致：Order=1 / Maintenance=2 / Charging=3 / Other=9）。</summary>
public enum ReservationPurpose
{
    Order = 1,
    Maintenance = 2,
    Charging = 3,
    Other = 9
}

public enum ReservationStatus
{
    Reserved = 1,
    Cancelled = 2,
    Completed = 3
}

public class StationReservation : BaseEntity
{
    public Guid StationId { get; set; }
    public Guid MerchantId { get; set; }
    public Guid? OrderId { get; set; }
    public DateTimeOffset StartAt { get; set; }
    public DateTimeOffset EndAt { get; set; }
    public ReservationPurpose Purpose { get; set; }
    public ReservationStatus Status { get; set; } = ReservationStatus.Reserved;
    public Guid CreatedBy { get; set; }
    public string? Remark { get; set; }
}
