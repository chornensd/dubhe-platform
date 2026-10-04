using Dubhe.Domain.Resource;

namespace Dubhe.Application.Resource.Dtos;

public sealed record UpsertMaintenancePlanRequest(
    Guid DroneId,
    int? IntervalDays,
    int? IntervalFlightMinutes,
    bool Enabled,
    string? Remark);

public sealed record MaintenancePlanDto(
    Guid Id,
    Guid DroneId,
    string DroneSerialNo,
    bool Enabled,
    int? IntervalDays,
    int? IntervalFlightMinutes,
    DateTimeOffset? LastMaintainedAt,
    int? LastMaintainedFlightMinutes,
    DateTimeOffset? NextDueAt,
    int? NextDueFlightMinutes,
    string Status,
    string? Remark);

public sealed record CreateMaintenanceRecordRequest(
    Guid DroneId,
    Guid? PlanId,
    Guid? CrewMemberId,
    string Type,
    string Content,
    DateTimeOffset MaintainedAt,
    string? FileUrl);

public sealed record MaintenanceRecordDto(
    Guid Id,
    Guid DroneId,
    Guid? PlanId,
    Guid? CrewMemberId,
    string Type,
    string Content,
    DateTimeOffset MaintainedAt,
    string? FileUrl,
    DateTimeOffset CreatedAt);

public sealed record ReportFaultRequest(
    Guid DroneId,
    string FaultType,
    string Description,
    IReadOnlyList<string>? PhotoUrls,
    double? Lat,
    double? Lng);

public sealed record HandleFaultRequest(Guid HandlerCrewId);

public sealed record ResolveFaultRequest(string Resolution);

public sealed class FaultQuery
{
    public int PageNum { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public Guid? DroneId { get; init; }
    public FaultStatus? Status { get; init; }
    public Guid? MerchantId { get; init; }
}

public sealed record FaultDto(
    Guid Id,
    Guid MerchantId,
    Guid DroneId,
    string FaultType,
    string Description,
    IReadOnlyList<string>? PhotoUrls,
    double? Lat,
    double? Lng,
    string Status,
    Guid? HandlerCrewId,
    string? Resolution,
    Guid ReportedBy,
    DateTimeOffset ReportedAt,
    DateTimeOffset? ResolvedAt);
