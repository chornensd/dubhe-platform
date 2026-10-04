using Dubhe.Api.Authorization;
using Dubhe.Api.Common;
using Dubhe.Application.Airspace;
using Dubhe.Application.Airspace.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dubhe.Api.Controllers.Airspace;

[Route("api/airspace/zones")]
[Authorize]
public sealed class AirspaceZonesController : ApiControllerBase
{
    private readonly IAirspaceZoneService _zoneService;

    public AirspaceZonesController(IAirspaceZoneService zoneService)
    {
        _zoneService = zoneService;
    }

    [HttpGet]
    [RequirePermission("airspace.read")]
    public async Task<IActionResult> Search([FromQuery] AirspaceZoneQuery query, CancellationToken ct)
    {
        return Success(await _zoneService.SearchAsync(query, ct));
    }

    [HttpPost]
    [RequirePermission("airspace.zone.manage")]
    public async Task<IActionResult> Create([FromBody] CreateAirspaceZoneRequest request, CancellationToken ct)
    {
        return Success(await _zoneService.CreatePlatformZoneAsync(request, ct));
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("airspace.zone.manage")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateAirspaceZoneRequest request, CancellationToken ct)
    {
        return Success(await _zoneService.UpdatePlatformZoneAsync(id, request, ct));
    }

    [HttpPost("{id:guid}/deactivate")]
    [RequirePermission("airspace.zone.manage")]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken ct)
    {
        await _zoneService.DeactivateAsync(id, requireFence: false, ct);
        return Success();
    }

    [HttpPost("mock-sync")]
    [RequirePermission("airspace.zone.manage")]
    public async Task<IActionResult> MockSync(CancellationToken ct)
    {
        return Success(await _zoneService.MockAtsSyncAsync(ct));
    }
}

[Route("api/airspace/fences")]
[Authorize]
public sealed class AirspaceFencesController : ApiControllerBase
{
    private readonly IAirspaceZoneService _zoneService;

    public AirspaceFencesController(IAirspaceZoneService zoneService)
    {
        _zoneService = zoneService;
    }

    [HttpPost]
    [RequirePermission("airspace.fence.manage")]
    public async Task<IActionResult> Create([FromBody] CreateAirspaceZoneRequest request, CancellationToken ct)
    {
        return Success(await _zoneService.CreateFenceAsync(request, ct));
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("airspace.fence.manage")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateAirspaceZoneRequest request, CancellationToken ct)
    {
        return Success(await _zoneService.UpdateFenceAsync(id, request, ct));
    }

    [HttpPost("{id:guid}/deactivate")]
    [RequirePermission("airspace.fence.manage")]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken ct)
    {
        await _zoneService.DeactivateAsync(id, requireFence: true, ct);
        return Success();
    }
}

[Route("api/airspace/flight-plans")]
[Authorize]
public sealed class FlightPlansController : ApiControllerBase
{
    private readonly IFlightPlanService _flightPlanService;

    public FlightPlansController(IFlightPlanService flightPlanService)
    {
        _flightPlanService = flightPlanService;
    }

    [HttpPost]
    [RequirePermission("airspace.plan.submit")]
    public async Task<IActionResult> Create([FromBody] CreateFlightPlanRequest request, CancellationToken ct)
    {
        return Success(await _flightPlanService.CreateAsync(request, ct));
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("airspace.plan.submit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreateFlightPlanRequest request, CancellationToken ct)
    {
        return Success(await _flightPlanService.UpdateAsync(id, request, ct));
    }

    [HttpGet]
    [RequirePermission("airspace.read")]
    public async Task<IActionResult> Search([FromQuery] FlightPlanQuery query, CancellationToken ct)
    {
        return Success(await _flightPlanService.SearchAsync(query, ct));
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("airspace.read")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        return Success(await _flightPlanService.GetAsync(id, ct));
    }

    [HttpPost("{id:guid}/submit")]
    [RequirePermission("airspace.plan.submit")]
    public async Task<IActionResult> Submit(Guid id, CancellationToken ct)
    {
        return Success(await _flightPlanService.SubmitAsync(id, ct));
    }

    [HttpPost("{id:guid}/approve")]
    [RequirePermission("airspace.plan.approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveFlightPlanRequest request, CancellationToken ct)
    {
        return Success(await _flightPlanService.ApproveAsync(id, request, ct));
    }

    [HttpPost("{id:guid}/reject")]
    [RequirePermission("airspace.plan.approve")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectFlightPlanRequest request, CancellationToken ct)
    {
        return Success(await _flightPlanService.RejectAsync(id, request, ct));
    }

    [HttpGet("{id:guid}/approval-suggestion")]
    [RequirePermission("airspace.plan.approve")]
    public async Task<IActionResult> Suggestion(Guid id, CancellationToken ct)
    {
        return Success(await _flightPlanService.SuggestAsync(id, ct));
    }

    [HttpPost("{id:guid}/cancel")]
    [RequirePermission("airspace.plan.submit")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        return Success(await _flightPlanService.CancelAsync(id, ct));
    }

    [HttpPost("{id:guid}/complete")]
    [RequirePermission("airspace.plan.submit")]
    public async Task<IActionResult> Complete(Guid id, CancellationToken ct)
    {
        return Success(await _flightPlanService.CompleteAsync(id, ct));
    }
}

[Route("api/airspace/violations")]
[Authorize]
public sealed class ViolationsController : ApiControllerBase
{
    private readonly IViolationService _violationService;

    public ViolationsController(IViolationService violationService)
    {
        _violationService = violationService;
    }

    [HttpPost]
    [RequirePermission("airspace.violation.manage")]
    public async Task<IActionResult> Report([FromBody] ReportViolationRequest request, CancellationToken ct)
    {
        return Success(await _violationService.ReportAsync(request, ct));
    }

    [HttpGet]
    [RequirePermission("airspace.violation.read")]
    public async Task<IActionResult> Search([FromQuery] ViolationQuery query, CancellationToken ct)
    {
        return Success(await _violationService.SearchAsync(query, ct));
    }

    [HttpPost("{id:guid}/handle")]
    [RequirePermission("airspace.violation.manage")]
    public async Task<IActionResult> Handle(Guid id, [FromBody] HandleViolationRequest request, CancellationToken ct)
    {
        return Success(await _violationService.HandleAsync(id, request, ct));
    }

    [HttpPost("{id:guid}/resolve")]
    [RequirePermission("airspace.violation.manage")]
    public async Task<IActionResult> Resolve(Guid id, [FromBody] ResolveViolationRequest request, CancellationToken ct)
    {
        return Success(await _violationService.ResolveAsync(id, request, ct));
    }

    [HttpPost("{id:guid}/penalties")]
    [RequirePermission("airspace.violation.manage")]
    public async Task<IActionResult> Penalty(Guid id, [FromBody] IssuePenaltyRequest request, CancellationToken ct)
    {
        return Success(await _violationService.IssuePenaltyAsync(id, request, ct));
    }
}

[Route("api/airspace/monitoring")]
[Authorize]
public sealed class AirspaceMonitoringController : ApiControllerBase
{
    private readonly IMonitoringService _monitoringService;

    public AirspaceMonitoringController(IMonitoringService monitoringService)
    {
        _monitoringService = monitoringService;
    }

    [HttpPost("positions")]
    [RequirePermission("airspace.monitoring.report")]
    public async Task<IActionResult> ReportPosition([FromBody] ReportPositionRequest request, CancellationToken ct)
    {
        return Success(await _monitoringService.ReportPositionAsync(request, ct));
    }
}
