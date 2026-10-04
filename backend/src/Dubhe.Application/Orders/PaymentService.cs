using Dubhe.Application.Abstractions;
using Dubhe.Application.Common;
using Dubhe.Application.Orders.Dtos;
using Dubhe.Domain.Common;
using Dubhe.Domain.Order;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Orders;

public interface IPaymentService
{
    Task<PaymentDto> PayAsync(Guid orderId, PayOrderRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<PaymentDto>> ListAsync(Guid orderId, CancellationToken ct = default);
    Task<PaymentDto> RefundAsync(Guid orderId, RefundOrderRequest request, CancellationToken ct = default);
}

public sealed class PaymentService : IPaymentService
{
    private readonly IAppDbContext _db;
    private readonly MerchantContext _merchant;
    private readonly IDateTime _clock;

    public PaymentService(IAppDbContext db, MerchantContext merchant, IDateTime clock)
    {
        _db = db;
        _merchant = merchant;
        _clock = clock;
    }

    public async Task<PaymentDto> PayAsync(Guid orderId, PayOrderRequest request, CancellationToken ct = default)
    {
        if (!Enum.IsDefined(typeof(PaymentMethod), request.Method))
        {
            throw AppException.Validation("支付方式不合法");
        }

        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == orderId, ct)
            ?? throw AppException.NotFound("订单不存在");

        var me = await _merchant.GetCurrentUserAsync(ct);
        if (me.Id != order.CustomerId && !_merchant.IsAdmin)
        {
            throw AppException.Forbidden("仅下单客户可支付该订单");
        }

        if (order.Status == OrderStatus.Cancelled)
        {
            throw AppException.Validation("订单已取消，无法支付");
        }

        if (order.PaymentStatus == OrderPaymentStatus.Paid)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "订单已支付，请勿重复支付");
        }

        if (order.PaymentStatus == OrderPaymentStatus.Refunded)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "订单已退款，无法再次支付");
        }

        var now = _clock.UtcNow;
        var payment = new Payment
        {
            OrderId = order.Id,
            PayerId = me.Id,
            Method = (PaymentMethod)request.Method,
            Amount = order.TotalAmount
        };

        if (request.SimulateFailure)
        {
            payment.Status = PaymentStatus.Failed;
            payment.FailureReason = string.IsNullOrWhiteSpace(request.FailureReason) ? "模拟支付失败" : request.FailureReason;
        }
        else
        {
            payment.Status = PaymentStatus.Succeeded;
            payment.TransactionNo = $"MOCK{now:yyyyMMddHHmmss}{Guid.NewGuid():N}"[..22].ToUpperInvariant();
            payment.PaidAt = now;
            order.PaymentStatus = OrderPaymentStatus.Paid;
            order.PaidAt = now;
        }

        _db.Payments.Add(payment);
        await _db.SaveChangesAsync(ct);
        return Map(payment);
    }

    public async Task<IReadOnlyList<PaymentDto>> ListAsync(Guid orderId, CancellationToken ct = default)
    {
        var order = await _db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == orderId, ct)
            ?? throw AppException.NotFound("订单不存在");

        var me = await _merchant.GetCurrentUserAsync(ct);
        var canView = me.Id == order.CustomerId
                      || _merchant.IsAdmin
                      || await _merchant.CanOperateMerchantAsync(order.MerchantId, ct);
        if (!canView)
        {
            throw AppException.Forbidden("无权查看该订单支付记录");
        }

        var rows = await _db.Payments.AsNoTracking()
            .Where(p => p.OrderId == orderId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct);

        return rows.Select(Map).ToList();
    }

    public async Task<PaymentDto> RefundAsync(Guid orderId, RefundOrderRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw AppException.Validation("退款原因不能为空");
        }

        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == orderId, ct)
            ?? throw AppException.NotFound("订单不存在");

        if (!_merchant.IsAdmin && !await _merchant.CanOperateMerchantAsync(order.MerchantId, ct))
        {
            throw AppException.Forbidden("无权操作该订单退款");
        }

        if (order.PaymentStatus != OrderPaymentStatus.Paid)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "订单当前不是已支付状态，无法退款");
        }

        var me = await _merchant.GetCurrentUserAsync(ct);
        var now = _clock.UtcNow;
        var payment = new Payment
        {
            OrderId = order.Id,
            PayerId = me.Id,
            Method = await ResolveMethodAsync(order.Id, ct),
            Amount = order.TotalAmount,
            Status = PaymentStatus.Refunded,
            RefundedAt = now,
            RefundReason = request.Reason.Trim()
        };

        order.PaymentStatus = OrderPaymentStatus.Refunded;
        _db.Payments.Add(payment);
        await _db.SaveChangesAsync(ct);
        return Map(payment);
    }

    private async Task<PaymentMethod> ResolveMethodAsync(Guid orderId, CancellationToken ct)
    {
        var method = await _db.Payments.AsNoTracking()
            .Where(p => p.OrderId == orderId && p.Status == PaymentStatus.Succeeded)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => p.Method)
            .FirstOrDefaultAsync(ct);
        return method == default ? PaymentMethod.BankTransfer : method;
    }

    private static PaymentDto Map(Payment payment) => new(
        payment.Id,
        payment.OrderId,
        payment.PayerId,
        payment.Method.ToString(),
        payment.Amount,
        payment.Status.ToString(),
        payment.TransactionNo,
        payment.FailureReason,
        payment.PaidAt,
        payment.RefundedAt,
        payment.RefundReason,
        payment.CreatedAt);
}
