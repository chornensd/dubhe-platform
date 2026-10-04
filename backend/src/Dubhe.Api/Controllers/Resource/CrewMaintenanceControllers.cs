using Dubhe.Api.Authorization;
using Dubhe.Api.Common;
using Dubhe.Application.Resource;
using Dubhe.Application.Resource.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dubhe.Api.Controllers.Resource;

[Route("api/resource/crew")]
[Authorize]
public sealed class CrewController : ApiControllerBase
{
    private readonly ICrewService _crewService;

    public CrewController(ICrewService crewService)
    {
        _crewService = crewService;
    }

    [HttpPost]
    [RequirePermission("resource.crew.manage")]
    public async Task<IActionResult> Create([FromBody] CreateCrewRequest request, CancellationToken ct)
    {
        return Success(await _crewService.CreateAsync(request, ct));
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("resource.crew.manage")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCrewRequest request, CancellationToken ct)
    {
        return Success(await _crewService.UpdateAsync(id, request, ct));
    }

    [HttpGet]
    [RequirePermission("resource.crew.manage")]
    public async Task<IActionResult> Search([FromQuery] CrewQuery query, CancellationToken ct)
    {
        return Success(await _crewService.SearchAsync(query, ct));
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("resource.crew.manage")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        return Success(await _crewService.GetAsync(id, ct));
    }

    [HttpPost("{id:guid}/qualifications")]
    [RequirePermission("resource.crew.manage")]
    public async Task<IActionResult> AddQualification(
        Guid id,
        [FromBody] AddQualificationRequest request,
        CancellationToken ct)
    {
        return Success(await _crewService.AddQualificationAsync(id, request, ct));
    }

    [HttpPut("{id:guid}/qualifications/{qualificationId:guid}")]
    [RequirePermission("resource.crew.manage")]
    public async Task<IActionResult> UpdateQualification(
        Guid id,
        Guid qualificationId,
        [FromBody] AddQualificationRequest request,
        CancellationToken ct)
    {
        return Success(await _crewService.UpdateQualificationAsync(id, qualificationId, request, ct));
    }

    [HttpPost("{id:guid}/schedules")]
    [RequirePermission("resource.crew.manage")]
    public async Task<IActionResult> CreateSchedule(
        Guid id,
        [FromBody] CreateScheduleRequest request,
        CancellationToken ct)
    {
        return Success(await _crewService.CreateScheduleAsync(id, request, ct));
    }

    [HttpGet("{id:guid}/schedules")]
    [RequirePermission("resource.crew.manage")]
    public async Task<IActionResult> ListSchedules(
        Guid id,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        CancellationToken ct)
    {
        return Success(await _crewService.ListSchedulesAsync(id, from, to, ct));
    }

    [HttpPost("{id:guid}/attendances")]
    [RequirePermission("resource.crew.manage")]
    public async Task<IActionResult> RecordAttendance(
        Guid id,
        [FromBody] RecordAttendanceRequest request,
        CancellationToken ct)
    {
        return Success(await _crewService.RecordAttendanceAsync(id, request, ct));
    }

    [HttpGet("{id:guid}/attendances")]
    [RequirePermission("resource.crew.manage")]
    public async Task<IActionResult> ListAttendances(
        Guid id,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        CancellationToken ct)
    {
        return Success(await _crewService.ListAttendancesAsync(id, from, to, ct));
    }
}

[Route("api/resource/maintenance")]
[Authorize]
public sealed class MaintenanceController : ApiControllerBase
{
    private readonly IMaintenanceService _maintenanceService;

    public MaintenanceController(IMaintenanceService maintenanceService)
    {
        _maintenanceService = maintenanceService;
    }

    [HttpPost("plans")]
    [RequirePermission("resource.maintenance.manage")]
    public async Task<IActionResult> UpsertPlan([FromBody] UpsertMaintenancePlanRequest request, CancellationToken ct)
    {
        return Success(await _maintenanceService.UpsertPlanAsync(request, ct));
    }

    [HttpGet("plans")]
    [RequirePermission("resource.maintenance.manage")]
    public async Task<IActionResult> ListPlans([FromQuery] Guid? droneId, CancellationToken ct)
    {
        return Success(await _maintenanceService.ListPlansAsync(droneId, ct));
    }

    [HttpPost("records")]
    [RequirePermission("resource.maintenance.manage")]
    public async Task<IActionResult> CreateRecord([FromBody] CreateMaintenanceRecordRequest request, CancellationToken ct)
    {
        return Success(await _maintenanceService.CreateRecordAsync(request, ct));
    }

    [HttpGet("records")]
    [RequirePermission("resource.maintenance.manage")]
    public async Task<IActionResult> ListRecords(
        [FromQuery] Guid? droneId,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        CancellationToken ct)
    {
        return Success(await _maintenanceService.ListRecordsAsync(droneId, from, to, ct));
    }
}

[Route("api/resource/faults")]
[Authorize]
public sealed class FaultsController : ApiControllerBase
{
    private readonly IFaultService _faultService;

    public FaultsController(IFaultService faultService)
    {
        _faultService = faultService;
    }

    [HttpPost]
    [RequirePermission("resource.fault.report")]
    public async Task<IActionResult> Report([FromBody] ReportFaultRequest request, CancellationToken ct)
    {
        return Success(await _faultService.ReportAsync(request, ct));
    }

    [HttpGet]
    [RequirePermission("resource.fault.report")]
    public async Task<IActionResult> Search([FromQuery] FaultQuery query, CancellationToken ct)
    {
        return Success(await _faultService.SearchAsync(query, ct));
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("resource.fault.report")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        return Success(await _faultService.GetAsync(id, ct));
    }

    [HttpPost("{id:guid}/handle")]
    [RequirePermission("resource.fault.manage")]
    public async Task<IActionResult> Handle(Guid id, [FromBody] HandleFaultRequest request, CancellationToken ct)
    {
        return Success(await _faultService.HandleAsync(id, request, ct));
    }

    [HttpPost("{id:guid}/resolve")]
    [RequirePermission("resource.fault.manage")]
    public async Task<IActionResult> Resolve(Guid id, [FromBody] ResolveFaultRequest request, CancellationToken ct)
    {
        return Success(await _faultService.ResolveAsync(id, request, ct));
    }
}
