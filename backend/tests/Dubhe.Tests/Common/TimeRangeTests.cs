using Dubhe.Domain.Common;

namespace Dubhe.Tests.Common;

public class TimeRangeTests
{
    private static DateTimeOffset At(int hour, int minute = 0) =>
        new(2026, 10, 1, hour, minute, 0, TimeSpan.Zero);

    [Theory]
    [InlineData(10, 11, 11, 12, false)]
    [InlineData(10, 11, 10, 11, true)]
    [InlineData(10, 12, 11, 13, true)]
    [InlineData(10, 12, 9, 11, true)]
    [InlineData(10, 11, 12, 13, false)]
    public void Overlaps_Works_For_Half_Open_Ranges(int startA, int endA, int startB, int endB, bool expected)
    {
        Assert.Equal(expected, TimeRange.Overlaps(At(startA), At(endA), At(startB), At(endB)));
    }

    [Fact]
    public void Overlaps_Half_Hour_Case()
    {
        Assert.True(TimeRange.Overlaps(At(10), At(11), At(10, 30), At(11, 30)));
    }
}
