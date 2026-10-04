using Dubhe.Domain.Resource;

namespace Dubhe.Application.Resource.Dtos;

public sealed record CreateDroneRequest(
    Guid? MerchantId,
    string SerialNo,
    string Model,
    decimal MaxPayloadKg,
    int EnduranceMinutes,
    int BatteryPercent);

public sealed record DroneDto(
    Guid Id,
    Guid MerchantId,
    string SerialNo,
    string Model,
    string Status,
    decimal MaxPayloadKg,
    int EnduranceMinutes,
    int BatteryPercent,
    int CumulativeFlightMinutes,
    int HealthScore,
    DateTimeOffset? LastMaintainedAt,
    DateTimeOffset CreatedAt);

public sealed class DroneQuery
{
    public int PageNum { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? Keyword { get; init; }
    public DroneStatus? Status { get; init; }
    public Guid? MerchantId { get; init; }
}

public sealed record CreateServiceAreaRequest(
    Guid? MerchantId,
    string Name,
    double CenterLat,
    double CenterLng,
    double RadiusKm);

public sealed record ServiceAreaDto(
    Guid Id,
    Guid MerchantId,
    string Name,
    double CenterLat,
    double CenterLng,
    double RadiusKm,
    bool IsActive,
    DateTimeOffset CreatedAt);
