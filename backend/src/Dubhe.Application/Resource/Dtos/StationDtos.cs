using Dubhe.Domain.Resource;

namespace Dubhe.Application.Resource.Dtos;

public sealed record CreateStationRequest(
    Guid? MerchantId,
    string Name,
    int Type,
    string Address,
    double Lat,
    double Lng,
    int Capacity,
    int ChargerCount,
    string? Remark);

public sealed record UpdateStationRequest(
    string? Name,
    string? Address,
    double? Lat,
    double? Lng,
    int? Capacity,
    int? ChargerCount,
    int? Status,
    string? Remark);

public sealed record StationDto(
    Guid Id,
    Guid MerchantId,
    string Name,
    string Type,
    string Address,
    double Lat,
    double Lng,
    int Capacity,
    int ChargerCount,
    string Status,
    string? Remark,
    DateTimeOffset CreatedAt);

public sealed class StationQuery
{
    public int PageNum { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? Keyword { get; init; }
    public StationType? Type { get; init; }
    public StationStatus? Status { get; init; }
    public Guid? MerchantId { get; init; }
}

public sealed record CreateReservationRequest(
    DateTimeOffset StartAt,
    DateTimeOffset EndAt,
    int Purpose,
    Guid? OrderId,
    string? Remark);

public sealed record ReservationDto(
    Guid Id,
    Guid StationId,
    Guid MerchantId,
    Guid? OrderId,
    DateTimeOffset StartAt,
    DateTimeOffset EndAt,
    string Purpose,
    string Status,
    string? Remark,
    DateTimeOffset CreatedAt);
