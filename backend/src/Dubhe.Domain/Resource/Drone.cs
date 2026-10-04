using Dubhe.Domain.Common;

namespace Dubhe.Domain.Resource;

public enum DroneStatus
{
    Offline = 0,
    Idle = 1,
    InFlight = 2,
    Maintenance = 3
}

public class Drone : BaseEntity
{
    public Guid MerchantId { get; set; }
    public string SerialNo { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public DroneStatus Status { get; set; } = DroneStatus.Idle;
    public decimal MaxPayloadKg { get; set; }
    public int EnduranceMinutes { get; set; }
    public int BatteryPercent { get; set; } = 100;
    public int CumulativeFlightMinutes { get; set; }
    public int HealthScore { get; set; } = 100;
    public DateTimeOffset? LastMaintainedAt { get; set; }
}
