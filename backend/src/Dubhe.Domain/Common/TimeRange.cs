namespace Dubhe.Domain.Common;

public static class TimeRange
{
    public static bool Overlaps(
        DateTimeOffset startA,
        DateTimeOffset endA,
        DateTimeOffset startB,
        DateTimeOffset endB)
    {
        return startA < endB && startB < endA;
    }
}
