using Microsoft.AspNetCore.Mvc;

namespace Dubhe.Api.Common;

[ApiController]
public abstract class ApiControllerBase : ControllerBase
{
    protected IActionResult Success() =>
        Ok(ApiResponse.Ok<object?>(null, HttpContext.TraceIdentifier));

    protected IActionResult Success<T>(T data) =>
        Ok(ApiResponse.Ok(data, HttpContext.TraceIdentifier));
}
