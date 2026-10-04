using Dubhe.Domain.Common;

namespace Dubhe.Tests.Common;

public class GeoUtilsTests
{
    [Fact]
    public void Distance_Beijing_To_Shanghai_About_1067_Kilometers()
    {
        var distance = GeoUtils.DistanceKm(39.9042, 116.4074, 31.2304, 121.4737);

        Assert.InRange(distance, 1050, 1085);
    }

    [Fact]
    public void Distance_Same_Point_Is_Zero()
    {
        Assert.Equal(0d, GeoUtils.DistanceKm(30.0, 120.0, 30.0, 120.0), 3);
    }

    [Fact]
    public void IsWithinCircle_Respects_Radius()
    {
        Assert.True(GeoUtils.IsWithinCircle(30.0, 120.05, 30.0, 120.0, 10));
        Assert.False(GeoUtils.IsWithinCircle(30.0, 121.0, 30.0, 120.0, 10));
    }
}
