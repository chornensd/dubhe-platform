using System.Text.Json;
using Dubhe.Application.Abstractions;
using Dubhe.Application.Common;
using Dubhe.Application.Report.Dtos;
using Dubhe.Domain.Auth;
using Dubhe.Domain.Common;
using Dubhe.Domain.Report;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Report;

public interface IReportTemplateService
{
    Task<ReportTemplateDto> CreateAsync(CreateReportTemplateRequest request, CancellationToken ct = default);
    Task<ReportTemplateDto> UpdateAsync(Guid id, UpdateReportTemplateRequest request, CancellationToken ct = default);
    Task<PagedResult<ReportTemplateDto>> SearchAsync(int pageNum, int pageSize, bool includeShared, CancellationToken ct = default);
    Task<ReportTemplateDto> GetAsync(Guid id, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public sealed class ReportTemplateService : IReportTemplateService
{
    private readonly IAppDbContext _db;
    private readonly MerchantContext _merchant;
    private readonly ICurrentUser _currentUser;

    public ReportTemplateService(IAppDbContext db, MerchantContext merchant, ICurrentUser currentUser)
    {
        _db = db;
        _merchant = merchant;
        _currentUser = currentUser;
    }

    public async Task<ReportTemplateDto> CreateAsync(
        CreateReportTemplateRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw AppException.Validation("模板名称不能为空");
        }

        if (ReportFieldCatalog.For(request.BusinessType).Count == 0)
        {
            throw AppException.Validation("业务维度不合法");
        }

        var userId = RequireUserId();
        var me = await _merchant.GetCurrentUserAsync(ct);
        Guid? merchantId = null;
        if (!_merchant.IsAdmin && me.UserType != UserType.IndividualCustomer && me.UserType != UserType.EnterpriseCustomer)
        {
            merchantId = await _merchant.ResolveMerchantIdAsync(null, ct);
        }

        var template = new ReportTemplate
        {
            Name = request.Name.Trim(),
            BusinessType = request.BusinessType.ToLowerInvariant(),
            Fields = JsonSerializer.Serialize(request.Fields ?? Array.Empty<string>()),
            Filters = JsonSerializer.Serialize(request.Filters ?? new ReportFilterDto()),
            OwnerUserId = userId,
            MerchantId = merchantId,
            IsShared = request.IsShared,
            Remark = request.Remark
        };

        _db.ReportTemplates.Add(template);
        await _db.SaveChangesAsync(ct);
        return Map(template);
    }

    public async Task<ReportTemplateDto> UpdateAsync(
        Guid id,
        UpdateReportTemplateRequest request,
        CancellationToken ct = default)
    {
        var template = await _db.ReportTemplates.FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw AppException.NotFound("报表模板不存在");

        if (template.OwnerUserId != RequireUserId())
        {
            throw AppException.Forbidden("仅模板创建者可修改");
        }

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            template.Name = request.Name.Trim();
        }

        if (request.Fields is not null)
        {
            template.Fields = JsonSerializer.Serialize(request.Fields);
        }

        if (request.Filters is not null)
        {
            template.Filters = JsonSerializer.Serialize(request.Filters);
        }

        if (request.IsShared is not null)
        {
            template.IsShared = request.IsShared.Value;
        }

        if (request.Remark is not null)
        {
            template.Remark = string.IsNullOrWhiteSpace(request.Remark) ? null : request.Remark.Trim();
        }

        await _db.SaveChangesAsync(ct);
        return Map(template);
    }

    public async Task<PagedResult<ReportTemplateDto>> SearchAsync(
        int pageNum,
        int pageSize,
        bool includeShared,
        CancellationToken ct = default)
    {
        var userId = RequireUserId();
        pageNum = Math.Max(1, pageNum);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var q = _db.ReportTemplates.AsNoTracking();
        if (includeShared)
        {
            var roleIds = await _db.UserRoles.AsNoTracking()
                .Where(ur => ur.UserId == userId)
                .Select(ur => ur.RoleId)
                .ToListAsync(ct);

            var sameRoleUserIds = await _db.UserRoles.AsNoTracking()
                .Where(ur => roleIds.Contains(ur.RoleId))
                .Select(ur => ur.UserId)
                .Distinct()
                .ToListAsync(ct);

            q = q.Where(t => t.OwnerUserId == userId
                             || (t.IsShared && sameRoleUserIds.Contains(t.OwnerUserId)));
        }
        else
        {
            q = q.Where(t => t.OwnerUserId == userId);
        }

        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(t => t.UpdatedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<ReportTemplateDto>
        {
            Items = rows.Select(Map).ToList(),
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task<ReportTemplateDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var template = await _db.ReportTemplates.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw AppException.NotFound("报表模板不存在");

        if (template.OwnerUserId != RequireUserId())
        {
            var isSameRoleShared = template.IsShared && await SharesRoleAsync(template.OwnerUserId, ct);
            if (!isSameRoleShared)
            {
                throw AppException.Forbidden("无权查看该模板");
            }
        }

        return Map(template);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var template = await _db.ReportTemplates.FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw AppException.NotFound("报表模板不存在");

        if (template.OwnerUserId != RequireUserId())
        {
            throw AppException.Forbidden("仅模板创建者可删除");
        }

        _db.ReportTemplates.Remove(template);
        await _db.SaveChangesAsync(ct);
    }

    private async Task<bool> SharesRoleAsync(Guid otherUserId, CancellationToken ct)
    {
        var userId = RequireUserId();
        var myRoleIds = await _db.UserRoles.AsNoTracking()
            .Where(ur => ur.UserId == userId)
            .Select(ur => ur.RoleId)
            .ToListAsync(ct);

        return await _db.UserRoles.AsNoTracking()
            .AnyAsync(ur => ur.UserId == otherUserId && myRoleIds.Contains(ur.RoleId), ct);
    }

    private Guid RequireUserId() =>
        _currentUser.UserId ?? throw new AppException(ErrorCodes.Forbidden, "未登录");

    private static ReportTemplateDto Map(ReportTemplate template) => new(
        template.Id,
        template.Name,
        template.BusinessType,
        Deserialize<List<string>>(template.Fields) ?? new List<string>(),
        Deserialize<ReportFilterDto>(template.Filters) ?? new ReportFilterDto(),
        template.OwnerUserId,
        template.MerchantId,
        template.IsShared,
        template.Remark,
        template.CreatedAt,
        template.UpdatedAt);

    private static T? Deserialize<T>(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<T>(json);
        }
        catch
        {
            return default;
        }
    }
}

public interface IReportShareService
{
    Task<ReportShareDto> CreateAsync(CreateReportShareRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<ReportShareDto>> ListOwnAsync(CancellationToken ct = default);
    Task<IReadOnlyList<ReportShareDto>> ListReceivedAsync(CancellationToken ct = default);
    Task<ReportShareDto> RevokeAsync(Guid id, CancellationToken ct = default);
    Task<ReportRunResultDto> AccessAsync(Guid id, CancellationToken ct = default);
}

public sealed class ReportShareService : IReportShareService
{
    private readonly IAppDbContext _db;
    private readonly IReportService _reportService;
    private readonly ICurrentUser _currentUser;
    private readonly IDateTime _clock;

    public ReportShareService(
        IAppDbContext db,
        IReportService reportService,
        ICurrentUser currentUser,
        IDateTime clock)
    {
        _db = db;
        _reportService = reportService;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<ReportShareDto> CreateAsync(CreateReportShareRequest request, CancellationToken ct = default)
    {
        if (ReportFieldCatalog.For(request.BusinessType).Count == 0)
        {
            throw AppException.Validation("业务维度不合法");
        }

        if (request.Fields is null || request.Fields.Count == 0)
        {
            throw AppException.Validation("请选择需要分享的字段");
        }

        if (request.ExpireDays is < 1 or > 90)
        {
            throw AppException.Validation("分享有效期需在 1-90 天之间");
        }

        var userId = RequireUserId();
        if (request.RecipientUserId == userId)
        {
            throw AppException.Validation("不能分享给自己");
        }

        var recipientExists = await _db.Users.AnyAsync(
            u => u.Id == request.RecipientUserId && u.Status == AccountStatus.Active, ct);
        if (!recipientExists)
        {
            throw AppException.Validation("接收人不存在或未激活");
        }

        var share = new ReportShare
        {
            OwnerUserId = userId,
            RecipientUserId = request.RecipientUserId,
            Title = string.IsNullOrWhiteSpace(request.Title) ? "报表分享" : request.Title.Trim(),
            BusinessType = request.BusinessType.ToLowerInvariant(),
            Fields = JsonSerializer.Serialize(request.Fields),
            Filters = JsonSerializer.Serialize(request.Filters ?? new ReportFilterDto()),
            ExpireAt = _clock.UtcNow.AddDays(request.ExpireDays),
            CanExport = request.CanExport
        };

        _db.ReportShares.Add(share);
        await _db.SaveChangesAsync(ct);
        return Map(share);
    }

    public async Task<IReadOnlyList<ReportShareDto>> ListOwnAsync(CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var rows = await _db.ReportShares.AsNoTracking()
            .Where(s => s.OwnerUserId == userId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<IReadOnlyList<ReportShareDto>> ListReceivedAsync(CancellationToken ct = default)
    {
        var userId = RequireUserId();
        var rows = await _db.ReportShares.AsNoTracking()
            .Where(s => s.RecipientUserId == userId && !s.IsRevoked && s.ExpireAt > _clock.UtcNow)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<ReportShareDto> RevokeAsync(Guid id, CancellationToken ct = default)
    {
        var share = await _db.ReportShares.FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw AppException.NotFound("分享不存在");

        if (share.OwnerUserId != RequireUserId())
        {
            throw AppException.Forbidden("仅分享发起人可撤回");
        }

        if (share.IsRevoked)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "该分享已撤回");
        }

        share.IsRevoked = true;
        await _db.SaveChangesAsync(ct);
        return Map(share);
    }

    public async Task<ReportRunResultDto> AccessAsync(Guid id, CancellationToken ct = default)
    {
        var share = await _db.ReportShares.FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw AppException.NotFound("分享不存在");

        if (share.RecipientUserId != RequireUserId())
        {
            throw AppException.Forbidden("无权访问该分享");
        }

        if (share.IsRevoked)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "该分享已撤回");
        }

        if (share.ExpireAt <= _clock.UtcNow)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "该分享已过期");
        }

        share.AccessCount++;
        share.LastAccessedAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);

        return await _reportService.RunAsync(
            new ReportRunRequest(share.BusinessType, Deserialize<List<string>>(share.Fields) ?? new List<string>(), Deserialize<ReportFilterDto>(share.Filters) ?? new ReportFilterDto()),
            ct);
    }

    private Guid RequireUserId() =>
        _currentUser.UserId ?? throw new AppException(ErrorCodes.Forbidden, "未登录");

    private static ReportShareDto Map(ReportShare share) => new(
        share.Id,
        share.OwnerUserId,
        share.RecipientUserId,
        share.Title,
        share.BusinessType,
        Deserialize<List<string>>(share.Fields) ?? new List<string>(),
        Deserialize<ReportFilterDto>(share.Filters) ?? new ReportFilterDto(),
        share.ExpireAt,
        share.CanExport,
        share.IsRevoked,
        share.AccessCount,
        share.LastAccessedAt,
        share.CreatedAt);

    private static T? Deserialize<T>(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<T>(json);
        }
        catch
        {
            return default;
        }
    }
}
