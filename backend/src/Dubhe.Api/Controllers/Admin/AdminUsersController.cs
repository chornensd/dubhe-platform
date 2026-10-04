using Dubhe.Api.Authorization;
using Dubhe.Api.Common;
using Dubhe.Application.Users;
using Dubhe.Application.Users.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dubhe.Api.Controllers.Admin;

[Route("api/admin/users")]
[Authorize]
public sealed class AdminUsersController : ApiControllerBase
{
    private readonly IUserService _userService;

    public AdminUsersController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet]
    [RequirePermission("account.user.manage")]
    public async Task<IActionResult> Search([FromQuery] UserQuery query, CancellationToken ct)
    {
        return Success(await _userService.SearchAsync(query, ct));
    }

    [HttpPost("{id:guid}/freeze")]
    [RequirePermission("account.user.manage")]
    public async Task<IActionResult> Freeze(Guid id, [FromBody] FreezeUserRequest request, CancellationToken ct)
    {
        await _userService.FreezeAsync(id, request, ct);
        return Success();
    }

    [HttpPost("{id:guid}/unfreeze")]
    [RequirePermission("account.user.manage")]
    public async Task<IActionResult> Unfreeze(Guid id, CancellationToken ct)
    {
        await _userService.UnfreezeAsync(id, ct);
        return Success();
    }

    [HttpPut("{id:guid}/roles")]
    [RequirePermission("account.role.manage")]
    public async Task<IActionResult> AssignRoles(Guid id, [FromBody] AssignRolesRequest request, CancellationToken ct)
    {
        await _userService.AssignRolesAsync(id, request, ct);
        return Success();
    }

    [HttpPost("{id:guid}/approve")]
    [RequirePermission("account.user.manage")]
    public async Task<IActionResult> Approve(Guid id, CancellationToken ct)
    {
        await _userService.ApproveAsync(id, ct);
        return Success();
    }

    [HttpPost("{id:guid}/reject")]
    [RequirePermission("account.user.manage")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectUserRequest request, CancellationToken ct)
    {
        await _userService.RejectAsync(id, request, ct);
        return Success();
    }
}
