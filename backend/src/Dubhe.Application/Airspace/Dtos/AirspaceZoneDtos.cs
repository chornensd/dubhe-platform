using Dubhe.Application.Common;

namespace Dubhe.Application.Airspace.Dtos;

public sealed record CreateAirspaceZoneRequest(
    string Name,
    int Type,
    double CenterLat,
    double CenterLng,
    double RadiusKm,
    double? MinAltitudeM,
    double? MaxAltitudeM,
    DateTimeOffset? EffectiveFrom,
    DateTimeOffset? EffectiveTo,
    string? Reason);

public sealed record UpdateAirspaceZoneRequest(
    string? Name,
    int? Type,
    double? CenterLat,
    double? CenterLng,
    double? RadiusKm,
    double? MinAltitudeM,
    double? MaxAltitudeM,
    DateTimeOffset? EffectiveFrom,
    DateTimeOffset? EffectiveTo,
    string? Reason,
    bool? IsActive);

public sealed record AirspaceZoneDto(
    Guid Id,
    string Code,
    string Name,
    string Type,
    string Source,
    Guid? MerchantId,
    double CenterLat,
    double CenterLng,
    double RadiusKm,
    double? MinAltitudeM,
    double? MaxAltitudeM,
    DateTimeOffset? EffectiveFrom,
    DateTimeOffset? EffectiveTo,
    string? Reason,
    bool IsActive,
    DateTimeOffset CreatedAt);

public sealed class AirspaceZoneQuery
{
    public int PageNum { get; init; } = 1;
    public int PageSize { get; init; } = 200;
    public Dubhe.Domain.Airspace.AirspaceZoneType? Type { get; init; }
    public bool ActiveOnly { get; init; }
}

public sealed record AirspaceConflictDto(
    Guid? ZoneId,
    string Code,
    string Name,
    string Type,
    string Reason);

public sealed record AirspaceCheckResultDto(
    IReadOnlyList<AirspaceConflictDto> Conflicts,
    double NearestNoFlyDistanceKm,
    bool Passed);
