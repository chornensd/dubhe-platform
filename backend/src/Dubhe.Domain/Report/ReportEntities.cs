using Dubhe.Domain.Common;

namespace Dubhe.Domain.Report;

public class ReportTemplate : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string BusinessType { get; set; } = "order";
    public string Fields { get; set; } = "[]";
    public string Filters { get; set; } = "{}";
    public Guid OwnerUserId { get; set; }
    public Guid? MerchantId { get; set; }
    public bool IsShared { get; set; }
    public string? Remark { get; set; }
}

public class ReportShare : BaseEntity
{
    public Guid OwnerUserId { get; set; }
    public Guid RecipientUserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string BusinessType { get; set; } = "order";
    public string Fields { get; set; } = "[]";
    public string Filters { get; set; } = "{}";
    public DateTimeOffset ExpireAt { get; set; }
    public bool CanExport { get; set; }
    public bool IsRevoked { get; set; }
    public int AccessCount { get; set; }
    public DateTimeOffset? LastAccessedAt { get; set; }
}

public static class ReportBuckets
{
    public static string DeliveryDurationBucket(TimeSpan duration) =>
        duration.TotalMinutes < 30 ? "30分钟以内"
        : duration.TotalHours < 1 ? "30-60分钟"
        : duration.TotalHours < 2 ? "1-2小时"
        : duration.TotalHours < 4 ? "2-4小时"
        : "4小时以上";

    public static readonly IReadOnlyList<string> DeliveryBuckets = new[]
    {
        "30分钟以内", "30-60分钟", "1-2小时", "2-4小时", "4小时以上"
    };
}
