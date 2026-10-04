using Dubhe.Application.Common;
using Dubhe.Domain.Common;
using Microsoft.Extensions.Options;

namespace Dubhe.Application.Orders;

public sealed record FeeCalculation(
    decimal DistanceKm,
    decimal BaseFee,
    decimal DistanceFee,
    decimal WeightFee,
    decimal AirspaceFee,
    decimal UrgentFee,
    decimal Subtotal,
    decimal Discount,
    decimal Total);

public sealed class FeeCalculator
{
    private readonly PricingOptions _options;

    public FeeCalculator(IOptions<PricingOptions> options)
    {
        _options = options.Value;
    }

    public FeeCalculation Calculate(
        double senderLat,
        double senderLng,
        double receiverLat,
        double receiverLng,
        decimal weightKg,
        bool isUrgent,
        decimal couponAmount)
    {
        var distance = Round((decimal)GeoUtils.DistanceKm(senderLat, senderLng, receiverLat, receiverLng));
        if (distance < _options.MinDistanceKm)
        {
            distance = _options.MinDistanceKm;
        }

        var baseFee = _options.BaseFee;
        var distanceFee = Round(_options.PerKm * distance);
        var weightFee = Round(_options.PerKg * weightKg);
        var airspaceFee = _options.AirspaceFee;
        var subtotal = baseFee + distanceFee + weightFee + airspaceFee;
        var urgentFee = isUrgent ? Round(subtotal * _options.UrgentSurchargeRate) : 0m;
        var gross = subtotal + urgentFee;
        var maxDiscount = Round(gross * _options.MaxDiscountRate);
        var discount = Round(Math.Clamp(couponAmount, 0m, maxDiscount));
        var total = gross - discount;

        return new FeeCalculation(
            distance,
            baseFee,
            distanceFee,
            weightFee,
            airspaceFee,
            urgentFee,
            gross,
            discount,
            total);
    }

    public int EstimateFlightMinutes(decimal distanceKm)
    {
        var oneWay = (double)distanceKm / _options.FlightSpeedKmh * 60;
        return (int)Math.Ceiling(oneWay) * 2;
    }

    private static decimal Round(decimal value) =>
        Math.Round(value, 2, MidpointRounding.AwayFromZero);
}
