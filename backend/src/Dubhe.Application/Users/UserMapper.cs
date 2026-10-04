using Dubhe.Application.Abstractions;
using Dubhe.Application.Auth.Dtos;
using Dubhe.Domain.Auth;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Users;

public sealed class UserMapper
{
    private readonly IAppDbContext _db;
    private readonly IClientContext _client;

    public UserMapper(IAppDbContext db, IClientContext client)
    {
        _db = db;
        _client = client;
    }

    public async Task<AuthUserDto> ToAuthUserAsync(User user, CancellationToken ct = default)
    {
        var (roles, permissions) = await LoadAsync(user.Id, ct);
        return Map(user, roles, permissions);
    }

    public AuthUserDto Map(User user, IReadOnlyList<string> roles, IReadOnlyList<string> permissions)
    {
        var isPc = _client.DeviceType != DeviceType.Mobile;
        return new AuthUserDto(
            user.Id,
            user.Username,
            user.DisplayName,
            MaskPhone(user.Phone),
            isPc ? user.Email : null,
            user.UserType.ToString(),
            user.Status.ToString(),
            user.CompanyName,
            roles,
            isPc ? permissions : null,
            isPc ? user.LastLoginAt : null);
    }

    public async Task<(List<string> Roles, List<string> Permissions)> LoadAsync(Guid userId, CancellationToken ct = default)
    {
        var roles = await (from ur in _db.UserRoles
                           join r in _db.Roles on ur.RoleId equals r.Id
                           where ur.UserId == userId
                           select r.Code).ToListAsync(ct);

        var permissions = await (from ur in _db.UserRoles
                                 join rp in _db.RolePermissions on ur.RoleId equals rp.RoleId
                                 join p in _db.Permissions on rp.PermissionId equals p.Id
                                 where ur.UserId == userId
                                 select p.Code).Distinct().ToListAsync(ct);

        return (roles, permissions);
    }

    public static string MaskPhone(string phone) =>
        phone.Length == 11 ? $"{phone[..3]}****{phone[7..]}" : phone;
}
