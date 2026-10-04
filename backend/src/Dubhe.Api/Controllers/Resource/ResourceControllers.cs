using Dubhe.Api.Authorization;
using Dubhe.Api.Common;
using Dubhe.Application.Resource;
using Dubhe.Application.Resource.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dubhe.Api.Controllers.Resource;

[Route("api/resource/drones")]
[Authorize]
public sealed class DronesController : ApiControllerBase
{
    private readonly IDroneService _droneService;

    public DronesController(IDroneService droneService)
    {
        _droneService = droneService;
    }

    [HttpPost]
    [RequirePermission("resource.drone.manage")]
    public async Task<IActionResult> Create([FromBody] CreateDroneRequest request, CancellationToken ct)
    {
        return Success(await _droneService.CreateAsync(request, ct));
    }

    [HttpGet]
    [RequirePermission("resource.drone.read")]
    public async Task<IActionResult> Search([FromQuery] DroneQuery query, CancellationToken ct)
    {
        return Success(await _droneService.SearchAsync(query, ct));
    }
}

[Route("api/resource/service-areas")]
[Authorize]
public sealed class ServiceAreasController : ApiControllerBase
{
    private readonly IServiceAreaService _serviceAreaService;

    public ServiceAreasController(IServiceAreaService serviceAreaService)
    {
        _serviceAreaService = serviceAreaService;
    }

    [HttpPost]
    [RequirePermission("resource.service-area.manage")]
    public async Task<IActionResult> Create([FromBody] CreateServiceAreaRequest request, CancellationToken ct)
    {
        return Success(await _serviceAreaService.CreateAsync(request, ct));
    }

    [HttpGet]
    [RequirePermission("resource.service-area.manage")]
    public async Task<IActionResult> List([FromQuery] Guid? merchantId, CancellationToken ct)
    {
        return Success(await _serviceAreaService.ListAsync(merchantId, ct));
    }
}
