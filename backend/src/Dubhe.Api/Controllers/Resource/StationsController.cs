using Dubhe.Api.Authorization;
using Dubhe.Api.Common;
using Dubhe.Application.Resource;
using Dubhe.Application.Resource.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dubhe.Api.Controllers.Resource;

[Route("api/resource/stations")]
[Authorize]
public sealed class StationsController : ApiControllerBase
{
    private readonly IStationService _stationService;

    public StationsController(IStationService stationService)
    {
        _stationService = stationService;
    }

    [HttpPost]
    [RequirePermission("resource.station.manage")]
    public async Task<IActionResult> Create([FromBody] CreateStationRequest request, CancellationToken ct)
    {
        return Success(await _stationService.CreateAsync(request, ct));
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("resource.station.manage")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateStationRequest request, CancellationToken ct)
    {
        return Success(await _stationService.UpdateAsync(id, request, ct));
    }

    [HttpGet]
    [RequirePermission("resource.station.read")]
    public async Task<IActionResult> Search([FromQuery] StationQuery query, CancellationToken ct)
    {
        return Success(await _stationService.SearchAsync(query, ct));
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("resource.station.read")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        return Success(await _stationService.GetAsync(id, ct));
    }

    [HttpPost("{id:guid}/reservations")]
    [RequirePermission("resource.station.manage")]
    public async Task<IActionResult> CreateReservation(
        Guid id,
        [FromBody] CreateReservationRequest request,
        CancellationToken ct)
    {
        return Success(await _stationService.CreateReservationAsync(id, request, ct));
    }

    [HttpGet("{id:guid}/reservations")]
    [RequirePermission("resource.station.read")]
    public async Task<IActionResult> ListReservations(
        Guid id,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        CancellationToken ct)
    {
        return Success(await _stationService.ListReservationsAsync(id, from, to, ct));
    }
}

[Route("api/resource/reservations")]
[Authorize]
public sealed class StationReservationsController : ApiControllerBase
{
    private readonly IStationService _stationService;

    public StationReservationsController(IStationService stationService)
    {
        _stationService = stationService;
    }

    [HttpPost("{id:guid}/cancel")]
    [RequirePermission("resource.station.manage")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        return Success(await _stationService.CancelReservationAsync(id, ct));
    }
}
