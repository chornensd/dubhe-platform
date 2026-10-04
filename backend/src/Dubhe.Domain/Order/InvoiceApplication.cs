using Dubhe.Domain.Common;

namespace Dubhe.Domain.Order;

public enum InvoiceStatus
{
    Submitted = 1,
    Issued = 2,
    Rejected = 3
}

public class InvoiceApplication : BaseEntity
{
    public Guid ApplicantUserId { get; set; }
    public Guid? MerchantId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string TaxNo { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string OrderIds { get; set; } = "[]";
    public InvoiceStatus Status { get; set; } = InvoiceStatus.Submitted;
    public string? InvoiceNo { get; set; }
    public string? FileUrl { get; set; }
    public string? RejectedReason { get; set; }
    public DateTimeOffset? IssuedAt { get; set; }
    public string? Remark { get; set; }
}
