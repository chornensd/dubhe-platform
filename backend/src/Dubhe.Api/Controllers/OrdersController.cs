using Dubhe.Api.Authorization;
using Dubhe.Api.Common;
using Dubhe.Application.Orders;
using Dubhe.Application.Orders.Dtos;
using Dubhe.Domain.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dubhe.Api.Controllers;

[Route("api/orders")]
[Authorize]
public sealed class OrdersController : ApiControllerBase
{
    private const long MaxImportFileSize = 10 * 1024 * 1024;

    private readonly IOrderService _orderService;
    private readonly IAutoAcceptService _autoAcceptService;
    private readonly IOrderExcelParser _excelParser;

    public OrdersController(
        IOrderService orderService,
        IAutoAcceptService autoAcceptService,
        IOrderExcelParser excelParser)
    {
        _orderService = orderService;
        _autoAcceptService = autoAcceptService;
        _excelParser = excelParser;
    }

    [HttpGet("import/template")]
    [RequirePermission("order.create")]
    public IActionResult DownloadTemplate()
    {
        var content = _excelParser.BuildTemplate();
        return File(
            content,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "order-import-template.xlsx");
    }

    [HttpPost("import")]
    [RequirePermission("order.create")]
    [RequestSizeLimit(MaxImportFileSize)]
    public async Task<IActionResult> Import(
        [FromQuery] Guid merchantId,
        IFormFile? file,
        CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            throw AppException.Validation("请上传 .xlsx 文件");
        }

        if (!file.FileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
        {
            throw AppException.Validation("仅支持 .xlsx 格式文件");
        }

        if (file.Length > MaxImportFileSize)
        {
            throw AppException.Validation("文件大小不能超过 10MB");
        }

        await using var stream = file.OpenReadStream();
        return Success(await _orderService.ImportAsync(merchantId, stream, ct));
    }

    [HttpGet("auto-accept")]
    [RequirePermission("order.accept")]
    public async Task<IActionResult> GetAutoAcceptRule(CancellationToken ct)
    {
        return Success(await _autoAcceptService.GetAsync(ct));
    }

    [HttpPut("auto-accept")]
    [RequirePermission("order.accept")]
    public async Task<IActionResult> UpdateAutoAcceptRule(
        [FromBody] UpdateAutoAcceptRuleRequest request,
        CancellationToken ct)
    {
        return Success(await _autoAcceptService.UpdateAsync(request, ct));
    }

    [HttpGet("available-merchants")]
    [RequirePermission("order.create")]
    public async Task<IActionResult> AvailableMerchants([FromQuery] string? keyword, CancellationToken ct)
    {
        return Success(await _orderService.AvailableMerchantsAsync(keyword, ct));
    }

    [HttpPost("estimate")]
    [RequirePermission("order.create")]
    public async Task<IActionResult> Estimate([FromBody] OrderCreateRequest request, CancellationToken ct)
    {
        return Success(await _orderService.EstimateAsync(request, ct));
    }

    [HttpPost]
    [RequirePermission("order.create")]
    public async Task<IActionResult> Create([FromBody] OrderCreateRequest request, CancellationToken ct)
    {
        return Success(await _orderService.CreateAsync(request, ct));
    }

    [HttpGet]
    [RequirePermission("order.read")]
    public async Task<IActionResult> Search([FromQuery] OrderQuery query, CancellationToken ct)
    {
        return Success(await _orderService.SearchAsync(query, ct));
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("order.read")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        return Success(await _orderService.GetAsync(id, ct));
    }

    [HttpPost("{id:guid}/accept")]
    [RequirePermission("order.accept")]
    public async Task<IActionResult> Accept(Guid id, CancellationToken ct)
    {
        return Success(await _orderService.AcceptAsync(id, ct));
    }

    [HttpPost("{id:guid}/reject")]
    [RequirePermission("order.accept")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectOrderRequest request, CancellationToken ct)
    {
        return Success(await _orderService.RejectAsync(id, request, ct));
    }

    [HttpPost("{id:guid}/cancel")]
    [RequirePermission("order.read")]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelOrderRequest request, CancellationToken ct)
    {
        return Success(await _orderService.CancelAsync(id, request, ct));
    }

    [HttpPost("{id:guid}/dispatch")]
    [RequirePermission("order.dispatch")]
    public async Task<IActionResult> Dispatch(Guid id, [FromBody] DispatchOrderRequest request, CancellationToken ct)
    {
        return Success(await _orderService.DispatchAsync(id, request, ct));
    }

    [HttpPost("{id:guid}/start")]
    [RequireAnyPermission("order.dispatch", "order.pilot.execute")]
    public async Task<IActionResult> StartFlight(Guid id, CancellationToken ct)
    {
        return Success(await _orderService.StartFlightAsync(id, ct));
    }

    [HttpPost("{id:guid}/complete")]
    [RequireAnyPermission("order.dispatch", "order.pilot.execute")]
    public async Task<IActionResult> Complete(Guid id, [FromBody] CompleteOrderRequest request, CancellationToken ct)
    {
        return Success(await _orderService.CompleteAsync(id, request, ct));
    }

    /// <summary>机长拒绝调度指派（退回待调度）。</summary>
    [HttpPost("{id:guid}/decline")]
    [RequirePermission("order.pilot.execute")]
    public async Task<IActionResult> Decline(Guid id, [FromBody] RejectOrderRequest request, CancellationToken ct)
    {
        return Success(await _orderService.DeclineAsync(id, request, ct));
    }

    [HttpPost("{id:guid}/review")]
    [RequirePermission("order.review")]
    public async Task<IActionResult> Review(Guid id, [FromBody] ReviewOrderRequest request, CancellationToken ct)
    {
        return Success(await _orderService.ReviewAsync(id, request, ct));
    }
}
