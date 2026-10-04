using Dubhe.Domain.Common;

namespace Dubhe.Domain.Config;

public class SystemConfigItem : BaseEntity
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ValueType { get; set; } = "string";
    public Guid? UpdatedBy { get; set; }
}

public class ExternalEndpoint : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string Method { get; set; } = "GET";
    public bool IsEnabled { get; set; } = true;
    public int TimeoutSeconds { get; set; } = 10;
    public int MaxRetries { get; set; }
    public string? Headers { get; set; }
    public DateTimeOffset? LastCallAt { get; set; }
    public bool? LastCallSucceeded { get; set; }
    public int TotalCalls { get; set; }
    public int FailedCalls { get; set; }
}

public class InterfaceCallLog : BaseEntity
{
    public Guid? EndpointId { get; set; }
    public string EndpointName { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string Method { get; set; } = "GET";
    public int? StatusCode { get; set; }
    public bool Succeeded { get; set; }
    public int DurationMs { get; set; }
    public string? Error { get; set; }
}

public class BackupRecord : BaseEntity
{
    public string FileName { get; set; } = string.Empty;
    public string Scope { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string Status { get; set; } = "Succeeded";
    public Guid CreatedBy { get; set; }
    public string? Error { get; set; }
    public DateTimeOffset? RestoredAt { get; set; }
}

public sealed record ConfigCatalogItem(
    string Key,
    string Name,
    string Group,
    string Value,
    string ValueType,
    string? Description);

public static class ConfigCatalog
{
    public static readonly IReadOnlyList<ConfigCatalogItem> Defaults = new List<ConfigCatalogItem>
    {
        new("order.accept.timeout.minutes", "待接单超时（分钟）", "订单配置", "15", "number", "超过时限未接单的订单自动取消"),
        new("order.dispatch.timeout.minutes", "待调度超时（分钟）", "订单配置", "30", "number", "超过时限未调度的订单触发提醒"),
        new("pricing.urgent.surcharge.rate", "加急费费率", "订单配置", "0.5", "number", "加急附加费占比"),
        new("airspace.plan.approval.timeout.minutes", "飞行计划审批时限（分钟）", "空域配置", "60", "number", "超时未审批的计划自动提醒"),
        new("airspace.deviation.threshold.km", "偏航判定阈值（公里）", "空域配置", "1", "number", "偏离申报航线超过该距离判定违规"),
        new("alert.violation.rate.threshold", "违规率告警阈值", "告警配置", "0.05", "number", "违规率超过阈值时大屏提示"),
        new("log.retention.days", "日志保留天数", "系统配置", "180", "number", "操作日志至少保留 6 个月"),
        new("security.session.minutes", "会话超时（分钟）", "系统配置", "30", "number", "后台无操作超过该时长需重新登录")
    };
}
