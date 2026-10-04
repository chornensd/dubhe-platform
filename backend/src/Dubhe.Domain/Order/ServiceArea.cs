using Dubhe.Domain.Common;

namespace Dubhe.Domain.Order;

public class ServiceArea : BaseEntity
{
    public Guid MerchantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public double CenterLat { get; set; }
    public double CenterLng { get; set; }
    public double RadiusKm { get; set; }
    public bool IsActive { get; set; } = true;
}
