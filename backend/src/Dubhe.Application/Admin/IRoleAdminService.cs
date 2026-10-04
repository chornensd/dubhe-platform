using Dubhe.Application.Admin.Dtos;

namespace Dubhe.Application.Admin;

public interface IRoleAdminService
{
    Task<IReadOnlyList<RoleDto>> ListAsync(CancellationToken ct = default);
    Task<IReadOnlyList<PermissionGroupDto>> PermissionCatalogAsync(CancellationToken ct = default);
}
