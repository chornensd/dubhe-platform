using Dubhe.Application.Abstractions;
using Dubhe.Application.Airspace.Dtos;
using Dubhe.Domain.Airspace;
using Dubhe.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Airspace;

public interface IAirspaceCheckService
{
    Task<AirspaceCheckResultDto> CheckAsync(
        Guid merchantId,
        Guid? excludePlanId,
        Guid? droneId,
        DateTimeOffset startAt,
        DateTimeOffset endAt,
        double altitudeM,
        IReadOnlyList<GeoPoint> route,
        CancellationToken ct = default);
}

public sealed class AirspaceCheckService : IAirspaceCheckService
{
    private readonly IAppDbContext _db;

    public AirspaceCheckService(IAppDbContext db)
    {
        _db = db;
    }

    public async Task<AirspaceCheckResultDto> CheckAsync(
        Guid merchantId,
        Guid? excludePlanId,
        Guid? droneId,
        DateTimeOffset startAt,
        DateTimeOffset endAt,
        double altitudeM,
        IReadOnlyList<GeoPoint> route,
        CancellationToken ct = default)
    {
        var conflicts = new List<AirspaceConflictDto>();
        var zones = await _db.AirspaceZones.AsNoTracking()
            .Where(z => z.IsActive && (z.MerchantId == null || z.MerchantId == merchantId))
            .ToListAsync(ct);

        var nearestNoFly = double.MaxValue;
        foreach (var zone in zones.Where(z => z.IsEffectiveAt(startAt, endAt)))
        {
            var distanceToCenter = route.Count == 0
                ? double.MaxValue
                : GeoUtils.DistanceToPolylineKm(route, zone.CenterLat, zone.CenterLng);

            if (zone.Type == AirspaceZoneType.NoFly && distanceToCenter != double.MaxValue)
            {
                var distanceToBoundary = Math.Max(0, distanceToCenter - zone.RadiusKm);
                if (distanceToBoundary < nearestNoFly)
                {
                    nearestNoFly = distanceToBoundary;
                }
            }

            if (!AirspaceGeometry.RouteIntersectsZone(
                    route,
                    altitudeM,
                    zone.CenterLat,
                    zone.CenterLng,
                    zone.RadiusKm,
                    zone.MinAltitudeM,
                    zone.MaxAltitudeM))
            {
                continue;
            }

            conflicts.Add(new AirspaceConflictDto(
                zone.Id,
                zone.Code,
                zone.Name,
                zone.Type.ToString(),
                $"{zone.Type switch { AirspaceZoneType.NoFly => "闯入禁飞区", AirspaceZoneType.Restricted => "进入限飞区", _ => "进入临时管制区" }}：{zone.Name}"));
        }

        if (droneId is not null)
        {
            var overlappingPlans = await _db.FlightPlans.AsNoTracking()
                .Where(p => p.DroneId == droneId
                            && (excludePlanId == null || p.Id != excludePlanId)
                            && (p.Status == FlightPlanStatus.Submitted || p.Status == FlightPlanStatus.Approved)
                            && p.StartAt < endAt
                            && startAt < p.EndAt)
                .ToListAsync(ct);

            conflicts.AddRange(overlappingPlans.Select(p => new AirspaceConflictDto(
                null,
                p.PlanNo ?? p.Id.ToString()[..8],
                $"飞行计划 {p.PlanNo ?? "（待审批）"}",
                "PlanConflict",
                "该飞行器在所选时段已有申报或已批准的飞行计划")));
        }

        var nearest = nearestNoFly == double.MaxValue ? double.PositiveInfinity : nearestNoFly;
        return new AirspaceCheckResultDto(conflicts, nearest, conflicts.Count == 0);
    }
}
