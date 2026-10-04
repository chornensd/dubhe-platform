using Dubhe.Application.Abstractions;
using Dubhe.Domain.Auth;
using Dubhe.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Common;

public sealed class MerchantContext
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;

    public MerchantContext(IAppDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public bool IsAdmin => _currentUser.Roles.Contains(RoleCodes.Admin);

    /// <summary>当前账号是否具有指定角色（机长等角色由管理员分配，UserType 可能仍是个人客户）。</summary>
    public bool HasRole(string roleCode) => _currentUser.Roles.Contains(roleCode);

    public bool IsPilotRole => HasRole(RoleCodes.Pilot);

    /// <summary>运维人员：平台级设备/场站/维保维护角色，可跨商家查看与处置资源。</summary>
    public bool IsOperationsStaff => HasRole(RoleCodes.OperationsStaff);

    /// <summary>资源域管理员视角：平台管理员或运维人员。</summary>
    public bool CanOverseeResources => IsAdmin || IsOperationsStaff;

    public async Task<User> GetCurrentUserAsync(CancellationToken ct = default)
    {
        var id = _currentUser.UserId ?? throw new AppException(ErrorCodes.Forbidden, "未登录");
        return await _db.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw AppException.NotFound("用户不存在");
    }

    public async Task<bool> CanOperateMerchantAsync(Guid merchantId, CancellationToken ct = default)
    {
        if (IsAdmin)
        {
            return true;
        }

        var me = await GetCurrentUserAsync(ct);
        if (me.Id == merchantId)
        {
            return true;
        }

        if (me.UserType != UserType.MerchantStaff || string.IsNullOrWhiteSpace(me.CompanyName))
        {
            return false;
        }

        var merchant = await _db.Users.FirstOrDefaultAsync(u => u.Id == merchantId, ct);
        return merchant is not null
               && merchant.UserType == UserType.Merchant
               && merchant.CompanyName == me.CompanyName;
    }

    public async Task<Guid> ResolveMerchantIdAsync(Guid? requested, CancellationToken ct = default)
    {
        if (IsAdmin)
        {
            return requested ?? throw AppException.Validation("平台管理员需指定 merchantId");
        }

        var me = await GetCurrentUserAsync(ct);
        if (me.UserType == UserType.Merchant)
        {
            return me.Id;
        }

        if (me.UserType == UserType.MerchantStaff && !string.IsNullOrWhiteSpace(me.CompanyName))
        {
            var merchant = await _db.Users.FirstOrDefaultAsync(
                u => u.UserType == UserType.Merchant && u.CompanyName == me.CompanyName, ct)
                ?? throw AppException.Forbidden("未找到所属企业主账号");

            if (requested is not null && requested != merchant.Id)
            {
                throw AppException.Forbidden("无权操作其他企业");
            }

            return merchant.Id;
        }

        throw AppException.Forbidden("当前账号无商家操作权限");
    }
}
