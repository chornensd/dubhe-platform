using Dubhe.Domain.Common;

namespace Dubhe.Domain.Order;

public enum PaymentMethod
{
    Wechat = 1,
    Alipay = 2,
    BankTransfer = 3
}

public enum PaymentStatus
{
    Pending = 0,
    Succeeded = 1,
    Failed = 2,
    Refunded = 3
}

public enum OrderPaymentStatus
{
    Unpaid = 0,
    Paid = 1,
    Refunded = 2
}

public class Payment : BaseEntity
{
    public Guid OrderId { get; set; }
    public Guid PayerId { get; set; }
    public PaymentMethod Method { get; set; }
    public decimal Amount { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public string? TransactionNo { get; set; }
    public string? FailureReason { get; set; }
    public DateTimeOffset? PaidAt { get; set; }
    public DateTimeOffset? RefundedAt { get; set; }
    public string? RefundReason { get; set; }
}
