using Dubhe.Domain.Auth;

namespace Dubhe.Application.Users.Dtos;

public sealed record UpdateProfileRequest(string? DisplayName, string? Email, string? AvatarUrl);

public sealed record FreezeUserRequest(string Reason);

public sealed record RejectUserRequest(string Reason);

public sealed record AssignRolesRequest(IReadOnlyList<string> RoleCodes);

public sealed record UserQuery
{
    public int PageNum { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? Keyword { get; init; }
    public AccountStatus? Status { get; init; }
    public string? RoleCode { get; init; }
}

public sealed record UserListItemDto(
    Guid Id,
    string Username,
    string Phone,
    string DisplayName,
    string UserType,
    string Status,
    IReadOnlyList<string> Roles,
    DateTimeOffset CreatedAt,
    DateTimeOffset? LastLoginAt);
