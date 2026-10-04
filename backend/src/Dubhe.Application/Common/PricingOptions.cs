namespace Dubhe.Application.Common;

public sealed class PricingOptions
{
    public const string SectionName = "Pricing";

    public decimal BaseFee { get; set; } = 10m;
    public decimal PerKm { get; set; } = 2.5m;
    public decimal PerKg { get; set; } = 1.5m;
    public decimal AirspaceFee { get; set; } = 2m;
    public decimal UrgentSurchargeRate { get; set; } = 0.5m;
    public decimal MaxDiscountRate { get; set; } = 0.5m;
    public decimal MinDistanceKm { get; set; } = 1m;
    public int FlightSpeedKmh { get; set; } = 60;
}
