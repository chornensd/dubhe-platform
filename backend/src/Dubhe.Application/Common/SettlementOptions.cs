namespace Dubhe.Application.Common;

public sealed class SettlementOptions
{
    public const string SectionName = "Settlement";

    public decimal CommissionRate { get; set; } = 0.1m;
}
