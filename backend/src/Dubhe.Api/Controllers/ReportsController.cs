using Dubhe.Api.Authorization;
using Dubhe.Api.Common;
using Dubhe.Application.Report;
using Dubhe.Application.Report.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dubhe.Api.Controllers;

[Route("api/reports")]
[Authorize]
public sealed class ReportsController : ApiControllerBase
{
    private readonly IReportService _reportService;
    private readonly IReportTemplateService _templateService;
    private readonly IReportShareService _shareService;
    private readonly IReportExporter _exporter;

    public ReportsController(
        IReportService reportService,
        IReportTemplateService templateService,
        IReportShareService shareService,
        IReportExporter exporter)
    {
        _reportService = reportService;
        _templateService = templateService;
        _shareService = shareService;
        _exporter = exporter;
    }

    [HttpGet("dashboard/admin")]
    [RequirePermission("report.view")]
    public async Task<IActionResult> AdminDashboard(CancellationToken ct)
    {
        return Success(await _reportService.GetAdminDashboardAsync(ct));
    }

    [HttpGet("dashboard/merchant")]
    [RequirePermission("report.view")]
    public async Task<IActionResult> MerchantDashboard([FromQuery] Guid? merchantId, CancellationToken ct)
    {
        return Success(await _reportService.GetMerchantDashboardAsync(merchantId, ct));
    }

    [HttpGet("dashboard/air-traffic")]
    [RequirePermission("report.view")]
    public async Task<IActionResult> AirTrafficDashboard(CancellationToken ct)
    {
        return Success(await _reportService.GetAirTrafficDashboardAsync(ct));
    }

    [HttpGet("fields")]
    [RequirePermission("report.view")]
    public IActionResult Fields([FromQuery] string businessType)
    {
        return Success(_reportService.GetFields(businessType));
    }

    [HttpPost("run")]
    [RequirePermission("report.view")]
    public async Task<IActionResult> Run([FromBody] ReportRunRequest request, CancellationToken ct)
    {
        return Success(await _reportService.RunAsync(request, ct));
    }

    [HttpPost("export")]
    [RequirePermission("report.export")]
    public async Task<IActionResult> Export([FromBody] ReportRunRequest request, CancellationToken ct)
    {
        var result = await _reportService.RunAsync(request, ct);
        var content = _exporter.BuildReport(
            $"报表导出（{result.BusinessType}）",
            result.Columns,
            result.Rows);
        return File(
            content,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"report-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}.xlsx");
    }

    [HttpGet("templates")]
    [RequirePermission("report.view")]
    public async Task<IActionResult> SearchTemplates(
        [FromQuery] int pageNum,
        [FromQuery] int pageSize,
        [FromQuery] bool includeShared,
        CancellationToken ct)
    {
        return Success(await _templateService.SearchAsync(
            pageNum <= 0 ? 1 : pageNum,
            pageSize <= 0 ? 20 : pageSize,
            includeShared,
            ct));
    }

    [HttpPost("templates")]
    [RequirePermission("report.view")]
    public async Task<IActionResult> CreateTemplate([FromBody] CreateReportTemplateRequest request, CancellationToken ct)
    {
        return Success(await _templateService.CreateAsync(request, ct));
    }

    [HttpGet("templates/{id:guid}")]
    [RequirePermission("report.view")]
    public async Task<IActionResult> GetTemplate(Guid id, CancellationToken ct)
    {
        return Success(await _templateService.GetAsync(id, ct));
    }

    [HttpPut("templates/{id:guid}")]
    [RequirePermission("report.view")]
    public async Task<IActionResult> UpdateTemplate(
        Guid id,
        [FromBody] UpdateReportTemplateRequest request,
        CancellationToken ct)
    {
        return Success(await _templateService.UpdateAsync(id, request, ct));
    }

    [HttpDelete("templates/{id:guid}")]
    [RequirePermission("report.view")]
    public async Task<IActionResult> DeleteTemplate(Guid id, CancellationToken ct)
    {
        await _templateService.DeleteAsync(id, ct);
        return Success();
    }

    [HttpPost("shares")]
    [RequirePermission("report.share")]
    public async Task<IActionResult> CreateShare([FromBody] CreateReportShareRequest request, CancellationToken ct)
    {
        return Success(await _shareService.CreateAsync(request, ct));
    }

    [HttpGet("shares")]
    [RequirePermission("report.share")]
    public async Task<IActionResult> ListOwnShares(CancellationToken ct)
    {
        return Success(await _shareService.ListOwnAsync(ct));
    }

    [HttpGet("shares/received")]
    [RequirePermission("report.view")]
    public async Task<IActionResult> ListReceivedShares(CancellationToken ct)
    {
        return Success(await _shareService.ListReceivedAsync(ct));
    }

    [HttpPost("shares/{id:guid}/revoke")]
    [RequirePermission("report.share")]
    public async Task<IActionResult> RevokeShare(Guid id, CancellationToken ct)
    {
        return Success(await _shareService.RevokeAsync(id, ct));
    }

    [HttpPost("shares/{id:guid}/access")]
    [RequirePermission("report.view")]
    public async Task<IActionResult> AccessShare(Guid id, CancellationToken ct)
    {
        return Success(await _shareService.AccessAsync(id, ct));
    }
}
