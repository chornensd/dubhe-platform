using Dubhe.Domain.Common;

namespace Dubhe.Domain.Order;

public class Order : BaseEntity, ISoftDeletable
{
    public string OrderNo { get; set; } = string.Empty;
    public Guid CustomerId { get; set; }
    public Guid MerchantId { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.PendingAccept;

    public string SenderName { get; set; } = string.Empty;
    public string SenderPhone { get; set; } = string.Empty;
    public string SenderAddress { get; set; } = string.Empty;
    public double SenderLat { get; set; }
    public double SenderLng { get; set; }

    public string ReceiverName { get; set; } = string.Empty;
    public string ReceiverPhone { get; set; } = string.Empty;
    public string ReceiverAddress { get; set; } = string.Empty;
    public double ReceiverLat { get; set; }
    public double ReceiverLng { get; set; }

    public string ItemCategory { get; set; } = string.Empty;
    public string ItemName { get; set; } = string.Empty;
    public decimal WeightKg { get; set; }
    public decimal VolumeM3 { get; set; }
    public int Quantity { get; set; } = 1;
    public bool IsUrgent { get; set; }
    public string? ComplianceProofUrl { get; set; }
    public string? Remark { get; set; }
    public DateTimeOffset? ScheduledAt { get; set; }

    public decimal DistanceKm { get; set; }
    public decimal BaseFee { get; set; }
    public decimal DistanceFee { get; set; }
    public decimal WeightFee { get; set; }
    public decimal AirspaceFee { get; set; }
    public decimal UrgentFee { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TotalAmount { get; set; }

    public DateTimeOffset? AcceptedAt { get; set; }
    public Guid? AcceptedBy { get; set; }
    public string? CancelReason { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }
    public Guid? CancelledBy { get; set; }

    public Guid? DroneId { get; set; }
    public Guid? PilotId { get; set; }
    public Guid? DispatcherId { get; set; }
    public DateTimeOffset? DispatchedAt { get; set; }
    public string? PlannedRoute { get; set; }
    public string? DispatchRemark { get; set; }

    public DateTimeOffset? InFlightAt { get; set; }
    public DateTimeOffset? DeliveredAt { get; set; }

    public int? Rating { get; set; }
    public string? ReviewComment { get; set; }
    public DateTimeOffset? ReviewedAt { get; set; }

    public OrderPaymentStatus PaymentStatus { get; set; } = OrderPaymentStatus.Unpaid;
    public DateTimeOffset? PaidAt { get; set; }

    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
}
