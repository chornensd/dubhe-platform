namespace Dubhe.Application.Admin.Dtos;

public sealed record RoleDto(
    Guid Id,
    string Code,
    string Name,
    string Description,
    bool IsSystem,
    IReadOnlyList<string> Permissions);

public sealed record PermissionDto(string Code, string Name);

public sealed record PermissionGroupDto(string Module, IReadOnlyList<PermissionDto> Items);
