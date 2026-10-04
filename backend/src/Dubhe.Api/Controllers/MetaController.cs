using Dubhe.Api.Common;
using Dubhe.Application.Abstractions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dubhe.Api.Controllers;

[Route("api/meta")]
public sealed class MetaController : ApiControllerBase
{
    [HttpGet("context")]
    [AllowAnonymous]
    public IActionResult Context([FromServices] IClientContext client, [FromServices] IDateTime clock)
    {
        return Success(new
        {
            apiVersion = "1.0.0",
            deviceType = client.DeviceType.ToString(),
            ip = client.Ip,
            serverTime = clock.UtcNow
        });
    }
}
