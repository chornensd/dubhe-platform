namespace Dubhe.Domain.Common;

public readonly record struct GeoPoint(double Lat, double Lng);

public static class GeoUtils
{
    private const double EarthRadiusKm = 6371.0088;
    private const double KmPerDegreeLat = 110.574;

    public static double DistanceKm(double lat1, double lng1, double lat2, double lng2)
    {
        var dLat = ToRadians(lat2 - lat1);
        var dLng = ToRadians(lng2 - lng1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                + Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2))
                * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
        return 2 * EarthRadiusKm * Math.Asin(Math.Min(1, Math.Sqrt(a)));
    }

    public static bool IsWithinCircle(
        double lat,
        double lng,
        double centerLat,
        double centerLng,
        double radiusKm)
    {
        return DistanceKm(lat, lng, centerLat, centerLng) <= radiusKm;
    }

    public static double DistancePointToSegmentKm(
        double lat,
        double lng,
        double lat1,
        double lng1,
        double lat2,
        double lng2)
    {
        var kmPerDegreeLng = 111.320 * Math.Cos(ToRadians(lat1));
        var x = (lng - lng1) * kmPerDegreeLng;
        var y = (lat - lat1) * KmPerDegreeLat;
        var dx = (lng2 - lng1) * kmPerDegreeLng;
        var dy = (lat2 - lat1) * KmPerDegreeLat;
        var lengthSquared = dx * dx + dy * dy;

        if (lengthSquared <= 1e-12)
        {
            return Math.Sqrt(x * x + y * y);
        }

        var t = Math.Clamp((x * dx + y * dy) / lengthSquared, 0, 1);
        var projX = t * dx;
        var projY = t * dy;
        var deltaX = x - projX;
        var deltaY = y - projY;
        return Math.Sqrt(deltaX * deltaX + deltaY * deltaY);
    }

    public static double DistanceToPolylineKm(IReadOnlyList<GeoPoint> points, double lat, double lng)
    {
        if (points.Count == 0)
        {
            return double.MaxValue;
        }

        if (points.Count == 1)
        {
            return DistanceKm(lat, lng, points[0].Lat, points[0].Lng);
        }

        var min = double.MaxValue;
        for (var i = 0; i < points.Count - 1; i++)
        {
            var distance = DistancePointToSegmentKm(lat, lng, points[i].Lat, points[i].Lng, points[i + 1].Lat, points[i + 1].Lng);
            if (distance < min)
            {
                min = distance;
            }
        }

        return min;
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180.0;
}

public static class AirspaceGeometry
{
    public static bool RouteIntersectsZone(
        IReadOnlyList<GeoPoint> route,
        double altitudeM,
        double centerLat,
        double centerLng,
        double radiusKm,
        double? minAltitudeM,
        double? maxAltitudeM)
    {
        if (minAltitudeM is { } min && altitudeM < min)
        {
            return false;
        }

        if (maxAltitudeM is { } max && altitudeM > max)
        {
            return false;
        }

        if (route.Count == 0)
        {
            return false;
        }

        if (route.Count == 1)
        {
            return GeoUtils.DistanceKm(route[0].Lat, route[0].Lng, centerLat, centerLng) <= radiusKm;
        }

        for (var i = 0; i < route.Count - 1; i++)
        {
            var distance = GeoUtils.DistancePointToSegmentKm(
                centerLat, centerLng,
                route[i].Lat, route[i].Lng,
                route[i + 1].Lat, route[i + 1].Lng);
            if (distance <= radiusKm)
            {
                return true;
            }
        }

        return false;
    }
}
