using System.Text.Json;
using Dubhe.Application.Abstractions;
using Dubhe.Application.Common;
using Dubhe.Application.Orders.Dtos;
using Dubhe.Domain.Auth;
using Dubhe.Domain.Common;
using Dubhe.Domain.Order;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Dubhe.Application.Orders;

public interface ISettlementService
{
    Task<SettlementStatementDto> GenerateAsync(GenerateSettlementRequest request, CancellationToken ct = default);
    Task<PagedResult<SettlementStatementDto>> SearchAsync(SettlementQuery query, CancellationToken ct = default);
    Task<SettlementStatementDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<SettlementStatementDto> ConfirmAsync(Guid id, CancellationToken ct = default);
    Task<SettlementStatementDto> SettleAsync(Guid id, CancellationToken ct = default);
    Task<byte[]> ExportAsync(Guid id, CancellationToken ct = default);
}

public sealed class SettlementService : ISettlementService
{
    private readonly IAppDbContext _db;
    private readonly MerchantContext _merchant;
    private readonly IDateTime _clock;
    private readonly ISettlementExporter _exporter;
    private readonly SettlementOptions _options;

    public SettlementService(
        IAppDbContext db,
        MerchantContext merchant,
        IDateTime clock,
        ISettlementExporter exporter,
        IOptions<SettlementOptions> options)
    {
        _db = db;
        _merchant = merchant;
        _clock = clock;
        _exporter = exporter;
        _options = options.Value;
    }

    public async Task<SettlementStatementDto> GenerateAsync(
        GenerateSettlementRequest request,
        CancellationToken ct = default)
    {
        var periodStart = request.PeriodStart.ToUniversalTime();
        var periodEnd = request.PeriodEnd.ToUniversalTime();
        if (periodEnd <= periodStart)
        {
            throw AppException.Validation("结算周期结束时间必须晚于开始时间");
        }

        var merchantId = await _merchant.ResolveMerchantIdAsync(request.MerchantId, ct);

        var settledOrderIds = _db.SettlementStatementItems.Select(i => i.OrderId);
        var orders = await _db.Orders.AsNoTracking()
            .Where(o => o.MerchantId == merchantId
                        && o.Status == OrderStatus.Delivered
                        && o.DeliveredAt != null
                        && o.DeliveredAt >= periodStart
                        && o.DeliveredAt <= periodEnd
                        && !settledOrderIds.Contains(o.Id))
            .OrderBy(o => o.DeliveredAt)
            .ToListAsync(ct);

        if (orders.Count == 0)
        {
            throw AppException.Validation("该周期没有可结算的已送达订单");
        }

        var totalAmount = orders.Sum(o => o.TotalAmount);
        var (commission, net) = SettlementMath.Calculate(totalAmount, _options.CommissionRate);
        var now = _clock.UtcNow;

        var statement = new SettlementStatement
        {
            StatementNo = $"STL{now:yyyyMMdd}{Guid.NewGuid():N}"[..20].ToUpperInvariant(),
            MerchantId = merchantId,
            PeriodStart = periodStart,
            PeriodEnd = periodEnd,
            OrderCount = orders.Count,
            TotalAmount = totalAmount,
            CommissionRate = _options.CommissionRate,
            CommissionAmount = commission,
            NetAmount = net,
            Status = StatementStatus.Draft,
            GeneratedAt = now
        };

        _db.SettlementStatements.Add(statement);

        foreach (var order in orders)
        {
            var (orderCommission, orderNet) = SettlementMath.Calculate(order.TotalAmount, _options.CommissionRate);
            _db.SettlementStatementItems.Add(new SettlementStatementItem
            {
                StatementId = statement.Id,
                OrderId = order.Id,
                OrderNo = order.OrderNo,
                TotalAmount = order.TotalAmount,
                CommissionAmount = orderCommission,
                NetAmount = orderNet,
                PaymentStatus = order.PaymentStatus == OrderPaymentStatus.Paid ? PaymentStatus.Succeeded
                    : order.PaymentStatus == OrderPaymentStatus.Refunded ? PaymentStatus.Refunded
                    : PaymentStatus.Pending,
                DeliveredAt = order.DeliveredAt
            });
        }

        await _db.SaveChangesAsync(ct);
        return await GetAsync(statement.Id, ct);
    }

    public async Task<PagedResult<SettlementStatementDto>> SearchAsync(
        SettlementQuery query,
        CancellationToken ct = default)
    {
        var pageNum = Math.Max(1, query.PageNum);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var q = _db.SettlementStatements.AsNoTracking();

        if (_merchant.IsAdmin)
        {
            if (query.MerchantId is not null)
            {
                q = q.Where(s => s.MerchantId == query.MerchantId);
            }
        }
        else
        {
            var merchantId = await _merchant.ResolveMerchantIdAsync(query.MerchantId, ct);
            q = q.Where(s => s.MerchantId == merchantId);
        }

        if (query.Status is not null)
        {
            q = q.Where(s => s.Status == query.Status);
        }

        if (query.From is not null)
        {
            q = q.Where(s => s.PeriodEnd >= query.From);
        }

        if (query.To is not null)
        {
            q = q.Where(s => s.PeriodStart <= query.To);
        }

        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(s => s.GeneratedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<SettlementStatementDto>
        {
            Items = rows.Select(s => Map(s, null, null)).ToList(),
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task<SettlementStatementDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var statement = await _db.SettlementStatements.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw AppException.NotFound("结算单不存在");

        if (!_merchant.IsAdmin && !await _merchant.CanOperateMerchantAsync(statement.MerchantId, ct))
        {
            throw AppException.Forbidden("无权查看该结算单");
        }

        var items = await _db.SettlementStatementItems.AsNoTracking()
            .Where(i => i.StatementId == id)
            .OrderBy(i => i.DeliveredAt)
            .ToListAsync(ct);

        var itemDtos = items.Select(i => new SettlementItemDto(
            i.OrderId,
            i.OrderNo,
            i.TotalAmount,
            i.CommissionAmount,
            i.NetAmount,
            i.PaymentStatus.ToString(),
            i.DeliveredAt)).ToList();

        var reconciliation = new SettlementReconciliationDto(
            items.Count(i => i.PaymentStatus == PaymentStatus.Succeeded),
            items.Count(i => i.PaymentStatus == PaymentStatus.Pending),
            items.Count(i => i.PaymentStatus == PaymentStatus.Refunded),
            items.Where(i => i.PaymentStatus == PaymentStatus.Pending).Sum(i => i.TotalAmount),
            items.Where(i => i.PaymentStatus == PaymentStatus.Refunded).Sum(i => i.TotalAmount));

        return Map(statement, itemDtos, reconciliation);
    }

    public async Task<SettlementStatementDto> ConfirmAsync(Guid id, CancellationToken ct = default)
    {
        var statement = await _db.SettlementStatements.FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw AppException.NotFound("结算单不存在");

        if (!_merchant.IsAdmin && !await _merchant.CanOperateMerchantAsync(statement.MerchantId, ct))
        {
            throw AppException.Forbidden("无权操作该结算单");
        }

        if (statement.Status != StatementStatus.Draft)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "仅草稿状态结算单可确认对账");
        }

        statement.Status = StatementStatus.Confirmed;
        statement.ConfirmedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<SettlementStatementDto> SettleAsync(Guid id, CancellationToken ct = default)
    {
        var statement = await _db.SettlementStatements.FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw AppException.NotFound("结算单不存在");

        if (!_merchant.IsAdmin)
        {
            throw AppException.Forbidden("仅平台管理员可完成结算");
        }

        if (statement.Status != StatementStatus.Confirmed)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "请先完成对账确认再结算");
        }

        statement.Status = StatementStatus.Settled;
        statement.SettledAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<byte[]> ExportAsync(Guid id, CancellationToken ct = default)
    {
        var statement = await GetAsync(id, ct);
        return _exporter.BuildStatement(statement);
    }

    private static SettlementStatementDto Map(
        SettlementStatement statement,
        IReadOnlyList<SettlementItemDto>? items,
        SettlementReconciliationDto? reconciliation) => new(
        statement.Id,
        statement.StatementNo,
        statement.MerchantId,
        statement.PeriodStart,
        statement.PeriodEnd,
        statement.OrderCount,
        statement.TotalAmount,
        statement.CommissionRate,
        statement.CommissionAmount,
        statement.NetAmount,
        statement.Status.ToString(),
        statement.GeneratedAt,
        statement.ConfirmedAt,
        statement.SettledAt,
        statement.Remark,
        reconciliation,
        items);
}

public interface IInvoiceService
{
    Task<InvoiceDto> ApplyAsync(CreateInvoiceRequest request, CancellationToken ct = default);
    Task<PagedResult<InvoiceDto>> SearchAsync(InvoiceQuery query, CancellationToken ct = default);
    Task<InvoiceDto> IssueAsync(Guid id, IssueInvoiceRequest request, CancellationToken ct = default);
    Task<InvoiceDto> RejectAsync(Guid id, RejectInvoiceRequest request, CancellationToken ct = default);
}

public sealed class InvoiceService : IInvoiceService
{
    private readonly IAppDbContext _db;
    private readonly MerchantContext _merchant;
    private readonly IDateTime _clock;

    public InvoiceService(IAppDbContext db, MerchantContext merchant, IDateTime clock)
    {
        _db = db;
        _merchant = merchant;
        _clock = clock;
    }

    public async Task<InvoiceDto> ApplyAsync(CreateInvoiceRequest request, CancellationToken ct = default)
    {
        if (request.OrderIds is null || request.OrderIds.Count == 0)
        {
            throw AppException.Validation("请选择需要开票的订单");
        }

        if (request.OrderIds.Count > 50)
        {
            throw AppException.Validation("单次最多为 50 个订单申请开票");
        }

        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.TaxNo))
        {
            throw AppException.Validation("发票抬头与税号不能为空");
        }

        var orderIds = request.OrderIds.Distinct().ToList();
        var orders = await _db.Orders.AsNoTracking()
            .Where(o => orderIds.Contains(o.Id))
            .ToListAsync(ct);

        if (orders.Count != orderIds.Count)
        {
            throw AppException.Validation("存在无效的订单");
        }

        var me = await _merchant.GetCurrentUserAsync(ct);
        Guid? merchantId = null;

        if (me.UserType is UserType.IndividualCustomer or UserType.EnterpriseCustomer)
        {
            if (orders.Any(o => o.CustomerId != me.Id))
            {
                throw AppException.Forbidden("仅可为本人订单申请开票");
            }
        }
        else
        {
            merchantId = await _merchant.ResolveMerchantIdAsync(null, ct);
            if (orders.Any(o => o.MerchantId != merchantId))
            {
                throw AppException.Forbidden("仅可为本企业订单申请开票");
            }
        }

        if (orders.Any(o => o.Status != OrderStatus.Delivered))
        {
            throw AppException.Validation("仅已送达订单可申请开票");
        }

        if (orders.Any(o => o.PaymentStatus != OrderPaymentStatus.Paid))
        {
            throw AppException.Validation("存在未支付的订单，无法开票");
        }

        var invoice = new InvoiceApplication
        {
            ApplicantUserId = me.Id,
            MerchantId = merchantId,
            Title = request.Title.Trim(),
            TaxNo = request.TaxNo.Trim(),
            Amount = orders.Sum(o => o.TotalAmount),
            OrderIds = JsonSerializer.Serialize(orderIds),
            Status = InvoiceStatus.Submitted,
            Remark = request.Remark
        };

        _db.InvoiceApplications.Add(invoice);
        await _db.SaveChangesAsync(ct);
        return Map(invoice);
    }

    public async Task<PagedResult<InvoiceDto>> SearchAsync(InvoiceQuery query, CancellationToken ct = default)
    {
        var pageNum = Math.Max(1, query.PageNum);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var q = _db.InvoiceApplications.AsNoTracking();
        var me = await _merchant.GetCurrentUserAsync(ct);

        if (_merchant.IsAdmin)
        {
            // 平台可见全部
        }
        else if (me.UserType is UserType.IndividualCustomer or UserType.EnterpriseCustomer)
        {
            q = q.Where(i => i.ApplicantUserId == me.Id);
        }
        else
        {
            var merchantId = await _merchant.ResolveMerchantIdAsync(null, ct);
            q = q.Where(i => i.MerchantId == merchantId);
        }

        if (query.Status is not null)
        {
            q = q.Where(i => i.Status == query.Status);
        }

        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(i => i.CreatedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<InvoiceDto>
        {
            Items = rows.Select(Map).ToList(),
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task<InvoiceDto> IssueAsync(Guid id, IssueInvoiceRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.InvoiceNo))
        {
            throw AppException.Validation("发票号码不能为空");
        }

        var invoice = await GetTrackedAsync(id, ct);
        EnsureAdmin();
        EnsureSubmitted(invoice);

        invoice.Status = InvoiceStatus.Issued;
        invoice.InvoiceNo = request.InvoiceNo.Trim();
        invoice.FileUrl = request.FileUrl;
        invoice.IssuedAt = _clock.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Map(invoice);
    }

    public async Task<InvoiceDto> RejectAsync(Guid id, RejectInvoiceRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw AppException.Validation("驳回原因不能为空");
        }

        var invoice = await GetTrackedAsync(id, ct);
        EnsureAdmin();
        EnsureSubmitted(invoice);

        invoice.Status = InvoiceStatus.Rejected;
        invoice.RejectedReason = request.Reason.Trim();

        await _db.SaveChangesAsync(ct);
        return Map(invoice);
    }

    private async Task<InvoiceApplication> GetTrackedAsync(Guid id, CancellationToken ct) =>
        await _db.InvoiceApplications.FirstOrDefaultAsync(i => i.Id == id, ct)
        ?? throw AppException.NotFound("发票申请不存在");

    private void EnsureAdmin()
    {
        if (!_merchant.IsAdmin)
        {
            throw AppException.Forbidden("仅平台管理员可开具或驳回发票");
        }
    }

    private static void EnsureSubmitted(InvoiceApplication invoice)
    {
        if (invoice.Status != InvoiceStatus.Submitted)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "该发票申请已处理");
        }
    }

    private static InvoiceDto Map(InvoiceApplication invoice) => new(
        invoice.Id,
        invoice.ApplicantUserId,
        invoice.MerchantId,
        invoice.Title,
        invoice.TaxNo,
        invoice.Amount,
        JsonSerializer.Deserialize<List<Guid>>(invoice.OrderIds) ?? new List<Guid>(),
        invoice.Status.ToString(),
        invoice.InvoiceNo,
        invoice.FileUrl,
        invoice.RejectedReason,
        invoice.IssuedAt,
        invoice.Remark,
        invoice.CreatedAt);
}
