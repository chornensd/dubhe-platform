using Dubhe.Api.Authorization;
using Dubhe.Api.Common;
using Dubhe.Application.Orders;
using Dubhe.Application.Orders.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dubhe.Api.Controllers;

[Route("api/orders")]
[Authorize]
public sealed class OrderPaymentsController : ApiControllerBase
{
    private readonly IPaymentService _paymentService;

    public OrderPaymentsController(IPaymentService paymentService)
    {
        _paymentService = paymentService;
    }

    [HttpPost("{id:guid}/pay")]
    [RequirePermission("order.pay")]
    public async Task<IActionResult> Pay(Guid id, [FromBody] PayOrderRequest request, CancellationToken ct)
    {
        return Success(await _paymentService.PayAsync(id, request, ct));
    }

    [HttpGet("{id:guid}/payments")]
    [RequirePermission("order.read")]
    public async Task<IActionResult> List(Guid id, CancellationToken ct)
    {
        return Success(await _paymentService.ListAsync(id, ct));
    }

    [HttpPost("{id:guid}/refund")]
    [RequirePermission("order.settle")]
    public async Task<IActionResult> Refund(Guid id, [FromBody] RefundOrderRequest request, CancellationToken ct)
    {
        return Success(await _paymentService.RefundAsync(id, request, ct));
    }
}

[Route("api/settlements")]
[Authorize]
public sealed class SettlementsController : ApiControllerBase
{
    private readonly ISettlementService _settlementService;

    public SettlementsController(ISettlementService settlementService)
    {
        _settlementService = settlementService;
    }

    [HttpPost("generate")]
    [RequirePermission("order.settle")]
    public async Task<IActionResult> Generate([FromBody] GenerateSettlementRequest request, CancellationToken ct)
    {
        return Success(await _settlementService.GenerateAsync(request, ct));
    }

    [HttpGet]
    [RequirePermission("order.settle")]
    public async Task<IActionResult> Search([FromQuery] SettlementQuery query, CancellationToken ct)
    {
        return Success(await _settlementService.SearchAsync(query, ct));
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("order.settle")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        return Success(await _settlementService.GetAsync(id, ct));
    }

    [HttpGet("{id:guid}/export")]
    [RequirePermission("order.settle")]
    public async Task<IActionResult> Export(Guid id, CancellationToken ct)
    {
        var statement = await _settlementService.GetAsync(id, ct);
        var content = await _settlementService.ExportAsync(id, ct);
        return File(
            content,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"settlement-{statement.StatementNo}.xlsx");
    }

    [HttpPost("{id:guid}/confirm")]
    [RequirePermission("order.settle")]
    public async Task<IActionResult> Confirm(Guid id, CancellationToken ct)
    {
        return Success(await _settlementService.ConfirmAsync(id, ct));
    }

    [HttpPost("{id:guid}/settle")]
    [RequirePermission("order.settle")]
    public async Task<IActionResult> Settle(Guid id, CancellationToken ct)
    {
        return Success(await _settlementService.SettleAsync(id, ct));
    }
}

[Route("api/invoices")]
[Authorize]
public sealed class InvoicesController : ApiControllerBase
{
    private readonly IInvoiceService _invoiceService;

    public InvoicesController(IInvoiceService invoiceService)
    {
        _invoiceService = invoiceService;
    }

    [HttpPost]
    [RequirePermission("order.invoice.apply")]
    public async Task<IActionResult> Apply([FromBody] CreateInvoiceRequest request, CancellationToken ct)
    {
        return Success(await _invoiceService.ApplyAsync(request, ct));
    }

    [HttpGet]
    [RequirePermission("order.invoice.apply")]
    public async Task<IActionResult> Search([FromQuery] InvoiceQuery query, CancellationToken ct)
    {
        return Success(await _invoiceService.SearchAsync(query, ct));
    }

    [HttpPost("{id:guid}/issue")]
    [RequirePermission("order.invoice.manage")]
    public async Task<IActionResult> Issue(Guid id, [FromBody] IssueInvoiceRequest request, CancellationToken ct)
    {
        return Success(await _invoiceService.IssueAsync(id, request, ct));
    }

    [HttpPost("{id:guid}/reject")]
    [RequirePermission("order.invoice.manage")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectInvoiceRequest request, CancellationToken ct)
    {
        return Success(await _invoiceService.RejectAsync(id, request, ct));
    }
}
