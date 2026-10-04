using Dubhe.Application.Abstractions;
using Dubhe.Application.Admin.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Admin;

public sealed class RoleAdminService : IRoleAdminService
{
    private readonly IAppDbContext _db;

    public RoleAdminService(IAppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<RoleDto>> ListAsync(CancellationToken ct = default)
    {
        var roles = await _db.Roles.AsNoTracking().OrderBy(r => r.Code).ToListAsync(ct);
        var roleIds = roles.Select(r => r.Id).ToList();

        var pairs = await (from rp in _db.RolePermissions
                           join p in _db.Permissions on rp.PermissionId equals p.Id
                           where roleIds.Contains(rp.RoleId)
                           select new { rp.RoleId, p.Code }).ToListAsync(ct);

        return roles.Select(r => new RoleDto(
            r.Id,
            r.Code,
            r.Name,
            r.Description ?? string.Empty,
            r.IsSystem,
            pairs.Where(x => x.RoleId == r.Id).Select(x => x.Code).ToList())).ToList();
    }

    public async Task<IReadOnlyList<PermissionGroupDto>> PermissionCatalogAsync(CancellationToken ct = default)
    {
        var permissions = await _db.Permissions.AsNoTracking().OrderBy(p => p.Code).ToListAsync(ct);
        return permissions
            .GroupBy(p => p.Module)
            .OrderBy(g => g.Key)
            .Select(g => new PermissionGroupDto(
                g.Key,
                g.Select(p => new PermissionDto(p.Code, p.Name)).ToList()))
            .ToList();
    }
}
