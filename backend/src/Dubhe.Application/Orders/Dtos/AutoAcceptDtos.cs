namespace Dubhe.Application.Orders.Dtos;

public sealed record AutoAcceptRuleDto(
    Guid MerchantId,
    bool Enabled,
    decimal? MaxWeightKg,
    decimal? MaxDistanceKm);

public sealed record UpdateAutoAcceptRuleRequest(
    bool Enabled,
    decimal? MaxWeightKg,
    decimal? MaxDistanceKm);
