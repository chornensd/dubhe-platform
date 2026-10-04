using Dubhe.Domain.Common;

namespace Dubhe.Domain.Order;

public class AutoAcceptRule : BaseEntity
{
    public Guid MerchantId { get; set; }
    public bool Enabled { get; set; }
    public decimal? MaxWeightKg { get; set; }
    public decimal? MaxDistanceKm { get; set; }

    public bool Matches(decimal weightKg, decimal distanceKm) =>
        Enabled
        && (MaxWeightKg is null || weightKg <= MaxWeightKg)
        && (MaxDistanceKm is null || distanceKm <= MaxDistanceKm);
}
