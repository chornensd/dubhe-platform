using Dubhe.Domain.Common;

namespace Dubhe.Domain.Order;

public enum StatementStatus
{
    Draft = 1,
    Confirmed = 2,
    Settled = 3
}

public class SettlementStatement : BaseEntity
{
    public string StatementNo { get; set; } = string.Empty;
    public Guid MerchantId { get; set; }
    public DateTimeOffset PeriodStart { get; set; }
    public DateTimeOffset PeriodEnd { get; set; }
    public int OrderCount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal CommissionRate { get; set; }
    public decimal CommissionAmount { get; set; }
    public decimal NetAmount { get; set; }
    public StatementStatus Status { get; set; } = StatementStatus.Draft;
    public DateTimeOffset GeneratedAt { get; set; }
    public DateTimeOffset? ConfirmedAt { get; set; }
    public DateTimeOffset? SettledAt { get; set; }
    public string? Remark { get; set; }
}

public class SettlementStatementItem : BaseEntity
{
    public Guid StatementId { get; set; }
    public Guid OrderId { get; set; }
    public string OrderNo { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public decimal CommissionAmount { get; set; }
    public decimal NetAmount { get; set; }
    public PaymentStatus PaymentStatus { get; set; }
    public DateTimeOffset? DeliveredAt { get; set; }
}

public static class SettlementMath
{
    public static (decimal Commission, decimal Net) Calculate(decimal totalAmount, decimal commissionRate)
    {
        var commission = Math.Round(totalAmount * commissionRate, 2, MidpointRounding.AwayFromZero);
        return (commission, totalAmount - commission);
    }
}
