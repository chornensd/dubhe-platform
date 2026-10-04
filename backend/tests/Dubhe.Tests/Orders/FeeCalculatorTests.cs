using Dubhe.Application.Common;
using Dubhe.Application.Orders;
using Microsoft.Extensions.Options;

namespace Dubhe.Tests.Orders;

public class FeeCalculatorTests
{
    private static FeeCalculator Create(decimal maxDiscountRate = 0.5m) => new(Options.Create(new PricingOptions
    {
        BaseFee = 10m,
        PerKm = 2.5m,
        PerKg = 1.5m,
        AirspaceFee = 2m,
        UrgentSurchargeRate = 0.5m,
        MaxDiscountRate = maxDiscountRate,
        MinDistanceKm = 1m,
        FlightSpeedKmh = 60
    }));

    [Fact]
    public void Calculate_NonUrgent_WithoutCoupon()
    {
        var calculator = Create();

        var result = calculator.Calculate(30.0, 120.0, 30.0, 120.1, 2m, false, 0m);

        Assert.InRange(result.DistanceKm, 9m, 10m);
        Assert.Equal(Math.Round(2.5m * result.DistanceKm, 2, MidpointRounding.AwayFromZero), result.DistanceFee);
        Assert.Equal(0m, result.UrgentFee);
        Assert.Equal(0m, result.Discount);
        Assert.Equal(result.Subtotal, result.Total);
    }

    [Fact]
    public void Calculate_Urgent_With_Coupon_Capped_By_MaxRate()
    {
        var calculator = Create();

        var result = calculator.Calculate(30.0, 120.0, 30.0, 120.2, 2m, true, 9999m);

        var maxDiscount = Math.Round(result.Subtotal * 0.5m, 2, MidpointRounding.AwayFromZero);
        Assert.True(result.UrgentFee > 0m);
        Assert.Equal(maxDiscount, result.Discount);
        Assert.Equal(result.Subtotal - maxDiscount, result.Total);
    }

    [Fact]
    public void Calculate_Minimum_Distance_Applied()
    {
        var calculator = Create();

        var result = calculator.Calculate(30.0, 120.0, 30.0, 120.00001, 1m, false, 0m);

        Assert.Equal(1m, result.DistanceKm);
        Assert.Equal(2.5m, result.DistanceFee);
    }

    [Fact]
    public void EstimateFlightMinutes_Is_Round_Trip()
    {
        var calculator = Create();

        Assert.Equal(20, calculator.EstimateFlightMinutes(10m));
    }
}
