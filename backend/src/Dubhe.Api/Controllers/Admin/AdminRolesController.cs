using Dubhe.Api.Authorization;
using Dubhe.Api.Common;
using Dubhe.Application.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dubhe.Api.Controllers.Admin;

[Route("api/admin/roles")]
[Authorize]
public sealed class AdminRolesController : ApiControllerBase
{
    private readonly IRoleAdminService _roleAdminService;

    public AdminRolesController(IRoleAdminService roleAdminService)
    {
        _roleAdminService = roleAdminService;
    }

    [HttpGet]
    [RequirePermission("account.role.manage")]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        return Success(await _roleAdminService.ListAsync(ct));
    }

    [HttpGet("permissions")]
    [RequirePermission("account.role.manage")]
    public async Task<IActionResult> PermissionCatalog(CancellationToken ct)
    {
        return Success(await _roleAdminService.PermissionCatalogAsync(ct));
    }
}
