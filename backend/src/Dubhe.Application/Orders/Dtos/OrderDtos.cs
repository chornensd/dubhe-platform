using Dubhe.Application.Resource.Dtos;
using Dubhe.Domain.Order;

namespace Dubhe.Application.Orders.Dtos;

public sealed record OrderCreateRequest(
    Guid MerchantId,
    string SenderName,
    string SenderPhone,
    string SenderAddress,
    double SenderLat,
    double SenderLng,
    string ReceiverName,
    string ReceiverPhone,
    string ReceiverAddress,
    double ReceiverLat,
    double ReceiverLng,
    string ItemCategory,
    string ItemName,
    decimal WeightKg,
    decimal VolumeM3,
    int Quantity,
    bool IsUrgent,
    DateTimeOffset? ScheduledAt,
    decimal CouponAmount,
    string? ComplianceProofUrl,
    string? Remark);

public sealed record SenderInfo(string Name, string Phone, string Address, double Lat, double Lng);

public sealed record ReceiverInfo(string Name, string Phone, string Address, double Lat, double Lng);

public sealed record FeeBreakdownDto(
    decimal DistanceKm,
    decimal BaseFee,
    decimal DistanceFee,
    decimal WeightFee,
    decimal AirspaceFee,
    decimal UrgentFee,
    decimal DiscountAmount,
    decimal TotalAmount);

public sealed record WaypointDto(double Lat, double Lng);

public sealed record OrderStatusHistoryDto(
    string? FromStatus,
    string ToStatus,
    Guid? OperatorId,
    string? Remark,
    DateTimeOffset At);

public sealed record OrderEstimateDto(
    decimal DistanceKm,
    bool ServiceAreaChecked,
    FeeBreakdownDto Fee);

/// <summary>客户下单时可选的运营商家（含服务区域）。</summary>
public sealed record MerchantOptionDto(
    Guid Id,
    string DisplayName,
    string? CompanyName,
    IReadOnlyList<ServiceAreaDto> ServiceAreas);

public sealed record OrderDto(
    Guid Id,
    string OrderNo,
    Guid CustomerId,
    string? CustomerName,
    Guid MerchantId,
    string? MerchantName,
    string Status,
    SenderInfo Sender,
    ReceiverInfo Receiver,
    string ItemCategory,
    string ItemName,
    decimal WeightKg,
    decimal VolumeM3,
    int Quantity,
    bool IsUrgent,
    string? ComplianceProofUrl,
    string? Remark,
    DateTimeOffset? ScheduledAt,
    FeeBreakdownDto Fee,
    Guid? DroneId,
    Guid? PilotId,
    DateTimeOffset? DispatchedAt,
    IReadOnlyList<WaypointDto>? PlannedRoute,
    string? DispatchRemark,
    DateTimeOffset? AcceptedAt,
    DateTimeOffset? InFlightAt,
    DateTimeOffset? DeliveredAt,
    string? CancelReason,
    DateTimeOffset? CancelledAt,
    int? Rating,
    string? ReviewComment,
    DateTimeOffset? ReviewedAt,
    DateTimeOffset CreatedAt,
    IReadOnlyList<OrderStatusHistoryDto> History,
    string PaymentStatus,
    DateTimeOffset? PaidAt);

public sealed record OrderListItemDto(
    Guid Id,
    string OrderNo,
    string Status,
    Guid MerchantId,
    string? MerchantName,
    Guid CustomerId,
    string? CustomerName,
    string ReceiverName,
    string ReceiverAddress,
    string ItemName,
    decimal WeightKg,
    bool IsUrgent,
    decimal TotalAmount,
    Guid? DroneId,
    DateTimeOffset CreatedAt,
    DateTimeOffset? DeliveredAt);

public sealed class OrderQuery
{
    public int PageNum { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public OrderStatus? Status { get; init; }
    public string? Keyword { get; init; }
    public DateTimeOffset? CreatedFrom { get; init; }
    public DateTimeOffset? CreatedTo { get; init; }
}

public sealed record RejectOrderRequest(string Reason);

public sealed record CancelOrderRequest(string? Reason);

public sealed record DispatchOrderRequest(
    Guid DroneId,
    Guid? PilotId,
    IReadOnlyList<WaypointDto>? Waypoints,
    string? Remark);

public sealed record CompleteOrderRequest(string? Remark);

public sealed record ReviewOrderRequest(int Rating, string? Comment);
