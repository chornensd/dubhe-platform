using Dubhe.Api.Common;
using Dubhe.Application.Users;
using Dubhe.Application.Users.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dubhe.Api.Controllers;

[Route("api/users")]
[Authorize]
public sealed class UsersController : ApiControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetCurrent(CancellationToken ct)
    {
        return Success(await _userService.GetCurrentAsync(ct));
    }

    [HttpPut("me")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request, CancellationToken ct)
    {
        return Success(await _userService.UpdateProfileAsync(request, ct));
    }
}
