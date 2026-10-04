using Dubhe.Domain.Order;

namespace Dubhe.Application.Orders.Dtos;

public sealed record PayOrderRequest(int Method, bool SimulateFailure, string? FailureReason);

public sealed record RefundOrderRequest(string Reason);

public sealed record PaymentDto(
    Guid Id,
    Guid OrderId,
    Guid PayerId,
    string Method,
    decimal Amount,
    string Status,
    string? TransactionNo,
    string? FailureReason,
    DateTimeOffset? PaidAt,
    DateTimeOffset? RefundedAt,
    string? RefundReason,
    DateTimeOffset CreatedAt);

public sealed record GenerateSettlementRequest(
    Guid? MerchantId,
    DateTimeOffset PeriodStart,
    DateTimeOffset PeriodEnd);

public sealed record SettlementItemDto(
    Guid OrderId,
    string OrderNo,
    decimal TotalAmount,
    decimal CommissionAmount,
    decimal NetAmount,
    string PaymentStatus,
    DateTimeOffset? DeliveredAt);

public sealed record SettlementReconciliationDto(
    int PaidCount,
    int UnpaidCount,
    int RefundedCount,
    decimal UnpaidAmount,
    decimal RefundedAmount);

public sealed record SettlementStatementDto(
    Guid Id,
    string StatementNo,
    Guid MerchantId,
    DateTimeOffset PeriodStart,
    DateTimeOffset PeriodEnd,
    int OrderCount,
    decimal TotalAmount,
    decimal CommissionRate,
    decimal CommissionAmount,
    decimal NetAmount,
    string Status,
    DateTimeOffset GeneratedAt,
    DateTimeOffset? ConfirmedAt,
    DateTimeOffset? SettledAt,
    string? Remark,
    SettlementReconciliationDto? Reconciliation,
    IReadOnlyList<SettlementItemDto>? Items);

public sealed class SettlementQuery
{
    public int PageNum { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public Guid? MerchantId { get; init; }
    public StatementStatus? Status { get; init; }
    public DateTimeOffset? From { get; init; }
    public DateTimeOffset? To { get; init; }
}

public sealed record CreateInvoiceRequest(
    IReadOnlyList<Guid> OrderIds,
    string Title,
    string TaxNo,
    string? Remark);

public sealed record IssueInvoiceRequest(string InvoiceNo, string? FileUrl);

public sealed record RejectInvoiceRequest(string Reason);

public sealed record InvoiceDto(
    Guid Id,
    Guid ApplicantUserId,
    Guid? MerchantId,
    string Title,
    string TaxNo,
    decimal Amount,
    IReadOnlyList<Guid> OrderIds,
    string Status,
    string? InvoiceNo,
    string? FileUrl,
    string? RejectedReason,
    DateTimeOffset? IssuedAt,
    string? Remark,
    DateTimeOffset CreatedAt);

public sealed class InvoiceQuery
{
    public int PageNum { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public InvoiceStatus? Status { get; init; }
}

public interface ISettlementExporter
{
    byte[] BuildStatement(SettlementStatementDto statement);
}
