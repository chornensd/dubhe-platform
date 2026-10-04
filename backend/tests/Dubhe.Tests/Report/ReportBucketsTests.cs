using Dubhe.Domain.Report;

namespace Dubhe.Tests.Report;

public class ReportBucketsTests
{
    [Theory]
    [InlineData(10, "30分钟以内")]
    [InlineData(29, "30分钟以内")]
    [InlineData(30, "30-60分钟")]
    [InlineData(59, "30-60分钟")]
    [InlineData(60, "1-2小时")]
    [InlineData(119, "1-2小时")]
    [InlineData(120, "2-4小时")]
    [InlineData(239, "2-4小时")]
    [InlineData(240, "4小时以上")]
    public void DeliveryDurationBucket_Maps_To_Expected_Bucket(int minutes, string expected)
    {
        Assert.Equal(expected, ReportBuckets.DeliveryDurationBucket(TimeSpan.FromMinutes(minutes)));
    }

    [Fact]
    public void DeliveryBuckets_Has_Five_Entries()
    {
        Assert.Equal(5, ReportBuckets.DeliveryBuckets.Count);
    }
}
