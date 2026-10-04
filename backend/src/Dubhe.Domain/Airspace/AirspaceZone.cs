using Dubhe.Domain.Common;

namespace Dubhe.Domain.Airspace;

public enum AirspaceZoneType
{
    NoFly = 1,
    Restricted = 2,
    TemporaryControl = 3
}

public enum AirspaceZoneSource
{
    Manual = 0,
    MockAts = 1,
    MerchantFence = 2
}

public class AirspaceZone : BaseEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public AirspaceZoneType Type { get; set; }
    public AirspaceZoneSource Source { get; set; }
    public Guid? MerchantId { get; set; }
    public double CenterLat { get; set; }
    public double CenterLng { get; set; }
    public double RadiusKm { get; set; }
    public double? MinAltitudeM { get; set; }
    public double? MaxAltitudeM { get; set; }
    public DateTimeOffset? EffectiveFrom { get; set; }
    public DateTimeOffset? EffectiveTo { get; set; }
    public string? Reason { get; set; }
    public bool IsActive { get; set; } = true;

    public bool IsEffectiveAt(DateTimeOffset startAt, DateTimeOffset endAt)
    {
        if (!IsActive)
        {
            return false;
        }

        if (EffectiveFrom is { } from && endAt < from)
        {
            return false;
        }

        if (EffectiveTo is { } to && startAt > to)
        {
            return false;
        }

        return true;
    }
}
