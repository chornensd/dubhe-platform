using Dubhe.Api.Authorization;
using Dubhe.Api.Common;
using Dubhe.Application.Config;
using Dubhe.Application.Config.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dubhe.Api.Controllers;

[Route("api/admin/config")]
[Authorize]
public sealed class AdminConfigController : ApiControllerBase
{
    private readonly IConfigService _configService;
    private readonly IEndpointService _endpointService;
    private readonly IBackupService _backupService;
    private readonly ILogQueryService _logQueryService;

    public AdminConfigController(
        IConfigService configService,
        IEndpointService endpointService,
        IBackupService backupService,
        ILogQueryService logQueryService)
    {
        _configService = configService;
        _endpointService = endpointService;
        _backupService = backupService;
        _logQueryService = logQueryService;
    }

    [HttpGet("params")]
    [RequirePermission("config.param.manage")]
    public async Task<IActionResult> ListParams([FromQuery] string? group, CancellationToken ct)
    {
        return Success(await _configService.ListAsync(group, ct));
    }

    [HttpPut("params")]
    [RequirePermission("config.param.manage")]
    public async Task<IActionResult> UpdateParams([FromBody] UpdateConfigRequest request, CancellationToken ct)
    {
        return Success(await _configService.UpdateAsync(request, ct));
    }

    [HttpGet("endpoints")]
    [RequirePermission("config.interface.manage")]
    public async Task<IActionResult> ListEndpoints(
        [FromQuery] int pageNum,
        [FromQuery] int pageSize,
        CancellationToken ct)
    {
        return Success(await _endpointService.SearchAsync(
            pageNum <= 0 ? 1 : pageNum,
            pageSize <= 0 ? 20 : pageSize,
            ct));
    }

    [HttpPost("endpoints")]
    [RequirePermission("config.interface.manage")]
    public async Task<IActionResult> CreateEndpoint([FromBody] CreateEndpointRequest request, CancellationToken ct)
    {
        return Success(await _endpointService.CreateAsync(request, ct));
    }

    [HttpPut("endpoints/{id:guid}")]
    [RequirePermission("config.interface.manage")]
    public async Task<IActionResult> UpdateEndpoint(
        Guid id,
        [FromBody] UpdateEndpointRequest request,
        CancellationToken ct)
    {
        return Success(await _endpointService.UpdateAsync(id, request, ct));
    }

    [HttpPost("endpoints/{id:guid}/test")]
    [RequirePermission("config.interface.manage")]
    public async Task<IActionResult> TestEndpoint(Guid id, CancellationToken ct)
    {
        return Success(await _endpointService.TestAsync(id, ct));
    }

    [HttpGet("endpoints/logs")]
    [RequirePermission("config.interface.manage")]
    public async Task<IActionResult> ListEndpointLogs([FromQuery] EndpointLogQuery query, CancellationToken ct)
    {
        return Success(await _endpointService.SearchLogsAsync(query, ct));
    }

    [HttpGet("backups")]
    [RequirePermission("config.backup.manage")]
    public async Task<IActionResult> ListBackups(CancellationToken ct)
    {
        return Success(await _backupService.ListAsync(ct));
    }

    [HttpPost("backups")]
    [RequirePermission("config.backup.manage")]
    public async Task<IActionResult> CreateBackup([FromBody] CreateBackupRequest request, CancellationToken ct)
    {
        return Success(await _backupService.CreateAsync(request, ct));
    }

    [HttpPost("backups/{id:guid}/restore")]
    [RequirePermission("config.backup.manage")]
    public async Task<IActionResult> RestoreBackup(Guid id, CancellationToken ct)
    {
        return Success(await _backupService.RestoreAsync(id, ct));
    }

    [HttpGet("logs")]
    [RequirePermission("config.log.read")]
    public async Task<IActionResult> ListLogs([FromQuery] AuditLogQuery query, CancellationToken ct)
    {
        return Success(await _logQueryService.SearchAsync(query, ct));
    }

    [HttpPost("logs/export")]
    [RequirePermission("config.log.read")]
    public async Task<IActionResult> ExportLogs([FromBody] AuditLogQuery query, CancellationToken ct)
    {
        var content = await _logQueryService.ExportAsync(query, ct);
        return File(
            content,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"audit-logs-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}.xlsx");
    }

    [HttpPost("logs/cleanup")]
    [RequirePermission("config.param.manage")]
    public async Task<IActionResult> CleanupLogs([FromBody] CleanupLogsRequest request, CancellationToken ct)
    {
        return Success(await _logQueryService.CleanupAsync(request.RetentionDays, ct));
    }
}

public sealed record CleanupLogsRequest(int RetentionDays);
