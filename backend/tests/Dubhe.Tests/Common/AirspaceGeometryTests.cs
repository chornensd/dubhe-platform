using Dubhe.Domain.Common;

namespace Dubhe.Tests.Common;

public class AirspaceGeometryTests
{
    [Fact]
    public void DistancePointToSegment_Perpendicular_Distance()
    {
        var distance = GeoUtils.DistancePointToSegmentKm(30.01, 120.01, 30.0, 120.0, 30.02, 120.0);

        Assert.InRange(distance, 0.9, 1.05);
    }

    [Fact]
    public void DistancePointToSegment_Beyond_End_Uses_EndPoint()
    {
        var distance = GeoUtils.DistancePointToSegmentKm(30.03, 120.0, 30.0, 120.0, 30.02, 120.0);

        Assert.InRange(distance, 1.0, 1.2);
    }

    [Fact]
    public void DistanceToPolyline_Uses_Nearest_Segment()
    {
        var route = new List<GeoPoint>
        {
            new(30.0, 120.0),
            new(30.0, 120.1),
            new(30.1, 120.1)
        };

        var distance = GeoUtils.DistanceToPolylineKm(route, 30.05, 120.1);

        Assert.InRange(distance, 0, 0.6);
    }

    [Fact]
    public void RouteIntersectsZone_When_Passing_Through()
    {
        var route = new List<GeoPoint> { new(30.04, 120.04), new(30.06, 120.06) };

        Assert.True(AirspaceGeometry.RouteIntersectsZone(route, 100, 30.05, 120.05, 1.0, 0, 500));
    }

    [Fact]
    public void RouteIntersectsZone_When_Outside_Radius()
    {
        var route = new List<GeoPoint> { new(30.0, 120.0), new(30.01, 120.01) };

        Assert.False(AirspaceGeometry.RouteIntersectsZone(route, 100, 30.05, 120.05, 1.0, 0, 500));
    }

    [Fact]
    public void RouteIntersectsZone_Respects_Altitude_Limit()
    {
        var route = new List<GeoPoint> { new(30.04, 120.04), new(30.06, 120.06) };

        Assert.False(AirspaceGeometry.RouteIntersectsZone(route, 600, 30.05, 120.05, 1.0, 0, 500));
    }
}
