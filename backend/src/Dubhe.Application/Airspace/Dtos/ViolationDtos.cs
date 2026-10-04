using Dubhe.Domain.Airspace;

namespace Dubhe.Application.Airspace.Dtos;

public sealed record ReportViolationRequest(
    Guid MerchantId,
    Guid? DroneId,
    Guid? OrderId,
    Guid? FlightPlanId,
    int Type,
    string Description,
    double? Lat,
    double? Lng,
    double? AltitudeM,
    DateTimeOffset? OccurredAt);

public sealed record HandleViolationRequest(string? Remark);

public sealed record ResolveViolationRequest(string Resolution);

public sealed record IssuePenaltyRequest(int Type, decimal? FineAmount, int? SuspendDays, string Reason);

public sealed record PenaltyDto(
    Guid Id,
    Guid ViolationId,
    string Type,
    decimal? FineAmount,
    int? SuspendDays,
    string Reason,
    Guid IssuedBy,
    DateTimeOffset IssuedAt);

public sealed record ViolationDto(
    Guid Id,
    Guid MerchantId,
    Guid? DroneId,
    Guid? OrderId,
    Guid? FlightPlanId,
    string Type,
    string Description,
    double? Lat,
    double? Lng,
    double? AltitudeM,
    string Status,
    string? Resolution,
    DateTimeOffset OccurredAt,
    DateTimeOffset CreatedAt,
    IReadOnlyList<PenaltyDto>? Penalties);

public sealed class ViolationQuery
{
    public int PageNum { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public Guid? MerchantId { get; init; }
    public ViolationStatus? Status { get; init; }
    public ViolationType? Type { get; init; }
}

public sealed record ReportPositionRequest(
    Guid DroneId,
    double Lat,
    double Lng,
    double AltitudeM,
    DateTimeOffset? ReportedAt,
    Guid? FlightPlanId);

public sealed record PositionReportResultDto(
    IReadOnlyList<ViolationDto> DetectedViolations,
    double? DistanceToRouteKm);
