namespace Dubhe.Application.Common;

public sealed class AirspaceOptions
{
    public const string SectionName = "Airspace";

    public double DeviationThresholdKm { get; set; } = 1.0;
    public int ViolationDedupeMinutes { get; set; } = 5;
    public double MockAtsCenterLat { get; set; } = 30.06;
    public double MockAtsCenterLng { get; set; } = 120.06;
    public double MockAtsRadiusKm { get; set; } = 2.0;
    public int MockAtsValidHours { get; set; } = 12;
}
