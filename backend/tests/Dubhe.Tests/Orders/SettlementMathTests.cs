using Dubhe.Domain.Order;

namespace Dubhe.Tests.Orders;

public class SettlementMathTests
{
    [Theory]
    [InlineData(100, 0.1, 10, 90)]
    [InlineData(99.99, 0.1, 10.00, 89.99)]
    [InlineData(0, 0.1, 0, 0)]
    [InlineData(50, 0, 0, 50)]
    public void Calculate_Commission_And_Net(decimal total, decimal rate, decimal expectedCommission, decimal expectedNet)
    {
        var (commission, net) = SettlementMath.Calculate(total, rate);

        Assert.Equal(expectedCommission, commission);
        Assert.Equal(expectedNet, net);
    }

    [Fact]
    public void Commission_Is_Rounded_Away_From_Zero()
    {
        var (commission, net) = SettlementMath.Calculate(12.35m, 0.1m);

        Assert.Equal(1.24m, commission);
        Assert.Equal(11.11m, net);
    }
}
