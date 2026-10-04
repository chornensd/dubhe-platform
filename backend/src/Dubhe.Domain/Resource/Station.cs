using Dubhe.Domain.Common;

namespace Dubhe.Domain.Resource;

public enum StationType
{
    TakeoffLanding = 1,
    Charging = 2
}

public enum StationStatus
{
    Offline = 0,
    Idle = 1,
    InUse = 2,
    Maintenance = 3
}

public class Station : BaseEntity
{
    public Guid MerchantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public StationType Type { get; set; }
    public string Address { get; set; } = string.Empty;
    public double Lat { get; set; }
    public double Lng { get; set; }
    public int Capacity { get; set; }
    public int ChargerCount { get; set; }
    public StationStatus Status { get; set; } = StationStatus.Idle;
    public string? Remark { get; set; }
}
