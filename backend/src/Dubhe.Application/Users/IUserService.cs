using Dubhe.Application.Auth.Dtos;
using Dubhe.Application.Common;
using Dubhe.Application.Users.Dtos;

namespace Dubhe.Application.Users;

public interface IUserService
{
    Task<AuthUserDto> GetCurrentAsync(CancellationToken ct = default);
    Task<AuthUserDto> UpdateProfileAsync(UpdateProfileRequest request, CancellationToken ct = default);
    Task<PagedResult<UserListItemDto>> SearchAsync(UserQuery query, CancellationToken ct = default);
    Task FreezeAsync(Guid userId, FreezeUserRequest request, CancellationToken ct = default);
    Task UnfreezeAsync(Guid userId, CancellationToken ct = default);
    Task ApproveAsync(Guid userId, CancellationToken ct = default);
    Task RejectAsync(Guid userId, RejectUserRequest request, CancellationToken ct = default);
    Task AssignRolesAsync(Guid userId, AssignRolesRequest request, CancellationToken ct = default);
}
