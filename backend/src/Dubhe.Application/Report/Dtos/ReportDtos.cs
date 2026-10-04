namespace Dubhe.Application.Report.Dtos;

public sealed record TrendPointDto(string Date, double Value);

public sealed record DistributionItemDto(string Bucket, int Count);

public sealed record AlertItemDto(string Type, string Level, string Title, DateTimeOffset OccurredAt);

public sealed record AdminDashboardDto(
    int TotalOrders,
    int TodayOrders,
    decimal TotalRevenue,
    int ActiveMerchants,
    int ActiveCustomers,
    double AirspaceUtilization,
    double ViolationRate,
    IReadOnlyList<AlertItemDto> Alerts,
    IReadOnlyList<TrendPointDto> OrderTrend,
    IReadOnlyList<TrendPointDto> ViolationTrend);

public sealed record MerchantDashboardDto(
    int CompletedOrders,
    int CreatedOrders,
    decimal PaidRevenue,
    double CompletionRate,
    double DroneUtilization,
    IReadOnlyList<DistributionItemDto> DeliveryDurationDistribution,
    IReadOnlyList<TrendPointDto> RevenueTrend);

public sealed record DensityCellDto(double Lat, double Lng, int Count);

public sealed record AirTrafficDashboardDto(
    int TotalPlans,
    int ApprovedPlans,
    double ApprovalRate,
    int ConflictPlans,
    double ConflictRate,
    IReadOnlyList<DistributionItemDto> ViolationsByType,
    IReadOnlyList<DensityCellDto> FlightDensity);

public sealed record ReportFieldDefDto(string Key, string Name, string Type);

public sealed class ReportFilterDto
{
    public DateTimeOffset? From { get; init; }
    public DateTimeOffset? To { get; init; }
    public string? Status { get; init; }
}

public sealed record ReportRunRequest(
    string BusinessType,
    IReadOnlyList<string> Fields,
    ReportFilterDto Filters);

public sealed record ReportRunResultDto(
    string BusinessType,
    IReadOnlyList<ReportFieldDefDto> Columns,
    IReadOnlyList<IReadOnlyDictionary<string, object?>> Rows,
    int Total,
    decimal TotalAmount);

public sealed record CreateReportTemplateRequest(
    string Name,
    string BusinessType,
    IReadOnlyList<string> Fields,
    ReportFilterDto Filters,
    bool IsShared,
    string? Remark);

public sealed record UpdateReportTemplateRequest(
    string? Name,
    IReadOnlyList<string>? Fields,
    ReportFilterDto? Filters,
    bool? IsShared,
    string? Remark);

public sealed record ReportTemplateDto(
    Guid Id,
    string Name,
    string BusinessType,
    IReadOnlyList<string> Fields,
    ReportFilterDto Filters,
    Guid OwnerUserId,
    Guid? MerchantId,
    bool IsShared,
    string? Remark,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record CreateReportShareRequest(
    Guid RecipientUserId,
    string Title,
    string BusinessType,
    IReadOnlyList<string> Fields,
    ReportFilterDto Filters,
    int ExpireDays,
    bool CanExport);

public sealed record ReportShareDto(
    Guid Id,
    Guid OwnerUserId,
    Guid RecipientUserId,
    string Title,
    string BusinessType,
    IReadOnlyList<string> Fields,
    ReportFilterDto Filters,
    DateTimeOffset ExpireAt,
    bool CanExport,
    bool IsRevoked,
    int AccessCount,
    DateTimeOffset? LastAccessedAt,
    DateTimeOffset CreatedAt);

public interface IReportExporter
{
    byte[] BuildReport(string title, IReadOnlyList<ReportFieldDefDto> columns, IReadOnlyList<IReadOnlyDictionary<string, object?>> rows);
}
