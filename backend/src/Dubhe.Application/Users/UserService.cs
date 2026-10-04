using System.Text.Json;
using Dubhe.Application.Abstractions;
using Dubhe.Application.Auth.Dtos;
using Dubhe.Application.Common;
using Dubhe.Application.Users.Dtos;
using Dubhe.Domain.Admin;
using Dubhe.Domain.Auth;
using Dubhe.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Users;

public sealed class UserService : IUserService
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly UserMapper _mapper;

    public UserService(IAppDbContext db, ICurrentUser currentUser, UserMapper mapper)
    {
        _db = db;
        _currentUser = currentUser;
        _mapper = mapper;
    }

    public async Task<AuthUserDto> GetCurrentAsync(CancellationToken ct = default)
    {
        var user = await GetRequiredCurrentUserAsync(ct);
        return await _mapper.ToAuthUserAsync(user, ct);
    }

    public async Task<AuthUserDto> UpdateProfileAsync(UpdateProfileRequest request, CancellationToken ct = default)
    {
        var user = await GetRequiredCurrentUserAsync(ct);

        if (!string.IsNullOrWhiteSpace(request.DisplayName))
        {
            user.DisplayName = request.DisplayName.Trim();
        }

        if (request.Email is not null)
        {
            user.Email = string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim();
        }

        if (request.AvatarUrl is not null)
        {
            user.AvatarUrl = string.IsNullOrWhiteSpace(request.AvatarUrl) ? null : request.AvatarUrl.Trim();
        }

        await _db.SaveChangesAsync(ct);
        return await _mapper.ToAuthUserAsync(user, ct);
    }

    public async Task<PagedResult<UserListItemDto>> SearchAsync(UserQuery query, CancellationToken ct = default)
    {
        var current = await GetRequiredCurrentUserAsync(ct);
        var pageNum = Math.Max(1, query.PageNum);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        var q = _db.Users.AsNoTracking();
        if (!IsAdmin(current))
        {
            q = q.Where(u => u.UserType == UserType.MerchantStaff && u.CompanyName == current.CompanyName);
        }

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var keyword = query.Keyword.Trim();
            q = q.Where(u => u.Username.Contains(keyword) || u.DisplayName.Contains(keyword) || u.Phone.Contains(keyword));
        }

        if (query.Status is not null)
        {
            q = q.Where(u => u.Status == query.Status);
        }

        if (!string.IsNullOrWhiteSpace(query.RoleCode))
        {
            var roleCode = query.RoleCode.Trim();
            q = q.Where(u => u.UserRoles.Any(ur => ur.Role.Code == roleCode));
        }

        var total = await q.LongCountAsync(ct);
        var users = await q.OrderByDescending(u => u.CreatedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var ids = users.Select(u => u.Id).ToList();
        var rolePairs = await (from ur in _db.UserRoles
                               join r in _db.Roles on ur.RoleId equals r.Id
                               where ids.Contains(ur.UserId)
                               select new { ur.UserId, r.Code }).ToListAsync(ct);

        var items = users.Select(u => new UserListItemDto(
            u.Id,
            u.Username,
            UserMapper.MaskPhone(u.Phone),
            u.DisplayName,
            u.UserType.ToString(),
            u.Status.ToString(),
            rolePairs.Where(x => x.UserId == u.Id).Select(x => x.Code).ToList(),
            u.CreatedAt,
            u.LastLoginAt)).ToList();

        return new PagedResult<UserListItemDto>
        {
            Items = items,
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task FreezeAsync(Guid userId, FreezeUserRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw AppException.Validation("冻结原因不能为空");
        }

        var current = await GetRequiredCurrentUserAsync(ct);
        var target = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw AppException.NotFound("用户不存在");

        if (target.Id == current.Id)
        {
            throw AppException.Validation("不能冻结当前登录账号");
        }

        if (target.Status == AccountStatus.Frozen)
        {
            throw AppException.Conflict("账号已处于冻结状态");
        }

        if (!IsAdmin(current))
        {
            if (target.UserType != UserType.MerchantStaff || target.CompanyName != current.CompanyName)
            {
                throw AppException.Forbidden("仅可管理本企业子账号");
            }
        }
        else if (target.UserType == UserType.PlatformAdmin)
        {
            throw AppException.Forbidden("不能冻结平台管理员账号");
        }

        target.Status = AccountStatus.Frozen;
        AddAudit(current, "freeze", new { targetUserId = target.Id, reason = request.Reason });
        await _db.SaveChangesAsync(ct);
    }

    public async Task UnfreezeAsync(Guid userId, CancellationToken ct = default)
    {
        var current = await GetRequiredCurrentUserAsync(ct);
        var target = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw AppException.NotFound("用户不存在");

        if (target.Status != AccountStatus.Frozen)
        {
            throw AppException.Conflict("账号当前不处于冻结状态");
        }

        if (!IsAdmin(current))
        {
            if (target.UserType != UserType.MerchantStaff || target.CompanyName != current.CompanyName)
            {
                throw AppException.Forbidden("仅可管理本企业子账号");
            }
        }

        target.Status = AccountStatus.Active;
        AddAudit(current, "unfreeze", new { targetUserId = target.Id });
        await _db.SaveChangesAsync(ct);
    }

    public async Task ApproveAsync(Guid userId, CancellationToken ct = default)
    {
        var current = await GetRequiredCurrentUserAsync(ct);
        if (!IsAdmin(current))
        {
            throw AppException.Forbidden("仅平台管理员可审核账号");
        }

        var target = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw AppException.NotFound("用户不存在");

        if (target.Status != AccountStatus.PendingReview)
        {
            throw AppException.Conflict("账号不处于待审核状态");
        }

        target.Status = AccountStatus.Active;
        AddAudit(current, "approve", new { targetUserId = target.Id });
        await _db.SaveChangesAsync(ct);
    }

    public async Task RejectAsync(Guid userId, RejectUserRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw AppException.Validation("驳回原因不能为空");
        }

        var current = await GetRequiredCurrentUserAsync(ct);
        if (!IsAdmin(current))
        {
            throw AppException.Forbidden("仅平台管理员可审核账号");
        }

        var target = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw AppException.NotFound("用户不存在");

        if (target.Status != AccountStatus.PendingReview)
        {
            throw AppException.Conflict("账号不处于待审核状态");
        }

        target.Status = AccountStatus.Rejected;
        AddAudit(current, "reject", new { targetUserId = target.Id, reason = request.Reason });
        await _db.SaveChangesAsync(ct);
    }

    public async Task AssignRolesAsync(Guid userId, AssignRolesRequest request, CancellationToken ct = default)
    {
        if (request.RoleCodes is null || request.RoleCodes.Count == 0)
        {
            throw AppException.Validation("角色列表不能为空");
        }

        var current = await GetRequiredCurrentUserAsync(ct);
        if (!IsAdmin(current))
        {
            throw AppException.Forbidden("仅平台管理员可分配角色");
        }

        var target = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw AppException.NotFound("用户不存在");

        if (target.Id == current.Id)
        {
            throw AppException.Validation("不能修改当前登录账号的角色");
        }

        var codes = request.RoleCodes.Distinct().ToList();
        var roles = await _db.Roles.Where(r => codes.Contains(r.Code)).ToListAsync(ct);
        if (roles.Count != codes.Count)
        {
            throw AppException.Validation("存在无效的角色编码");
        }

        var existing = await _db.UserRoles.Where(ur => ur.UserId == target.Id).ToListAsync(ct);
        _db.UserRoles.RemoveRange(existing);
        _db.UserRoles.AddRange(roles.Select(r => new UserRole { UserId = target.Id, RoleId = r.Id }));

        AddAudit(current, "assign_roles", new { targetUserId = target.Id, roles = codes });
        await _db.SaveChangesAsync(ct);
    }

    private async Task<User> GetRequiredCurrentUserAsync(CancellationToken ct)
    {
        var id = _currentUser.UserId ?? throw new AppException(ErrorCodes.Forbidden, "未登录");
        return await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw AppException.NotFound("用户不存在");
    }

    private bool IsAdmin(User user) => _currentUser.Roles.Contains(RoleCodes.Admin);

    private void AddAudit(User current, string action, object detail)
    {
        _db.AuditLogs.Add(new AuditLog
        {
            UserId = current.Id,
            Username = current.Username,
            Module = "account",
            Action = action,
            Detail = JsonSerializer.Serialize(detail),
            Succeeded = true
        });
    }
}
