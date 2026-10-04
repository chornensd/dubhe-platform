using Dubhe.Domain.Airspace;

namespace Dubhe.Application.Airspace.Dtos;

public sealed record FlightPlanWaypointDto(double Lat, double Lng);

public sealed record CreateFlightPlanRequest(
    Guid? MerchantId,
    Guid? OrderId,
    Guid DroneId,
    Guid? PilotCrewId,
    string Purpose,
    DateTimeOffset StartAt,
    DateTimeOffset EndAt,
    double MaxAltitudeM,
    IReadOnlyList<FlightPlanWaypointDto> Waypoints);

public sealed record ApproveFlightPlanRequest(string? Comment);

public sealed record RejectFlightPlanRequest(string Reason);

public sealed record FlightPlanDto(
    Guid Id,
    string? PlanNo,
    Guid MerchantId,
    Guid? OrderId,
    Guid DroneId,
    string? DroneSerialNo,
    Guid? PilotCrewId,
    string? PilotName,
    string Purpose,
    DateTimeOffset StartAt,
    DateTimeOffset EndAt,
    double MaxAltitudeM,
    IReadOnlyList<FlightPlanWaypointDto> Waypoints,
    string Status,
    IReadOnlyList<AirspaceConflictDto>? Conflicts,
    DateTimeOffset? SubmittedAt,
    DateTimeOffset? ApprovedAt,
    string? ApprovalComment,
    string? RejectReason,
    DateTimeOffset? CancelledAt,
    DateTimeOffset CreatedAt);

public sealed class FlightPlanQuery
{
    public int PageNum { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public FlightPlanStatus? Status { get; init; }
    public Guid? MerchantId { get; init; }
    public string? Keyword { get; init; }
}

public sealed record ApprovalSuggestionDto(string Suggestion, IReadOnlyList<string> Reasons);
