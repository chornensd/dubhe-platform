using Dubhe.Application.Abstractions;
using Dubhe.Application.Common;
using Dubhe.Application.Orders.Dtos;
using Dubhe.Domain.Common;
using Dubhe.Domain.Order;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Orders;

public interface IAutoAcceptService
{
    Task<AutoAcceptRuleDto> GetAsync(CancellationToken ct = default);
    Task<AutoAcceptRuleDto> UpdateAsync(UpdateAutoAcceptRuleRequest request, CancellationToken ct = default);
}

public sealed class AutoAcceptService : IAutoAcceptService
{
    private readonly IAppDbContext _db;
    private readonly MerchantContext _merchant;

    public AutoAcceptService(IAppDbContext db, MerchantContext merchant)
    {
        _db = db;
        _merchant = merchant;
    }

    public async Task<AutoAcceptRuleDto> GetAsync(CancellationToken ct = default)
    {
        var merchantId = await _merchant.ResolveMerchantIdAsync(null, ct);
        var rule = await _db.AutoAcceptRules.AsNoTracking()
            .FirstOrDefaultAsync(r => r.MerchantId == merchantId, ct);

        return rule is null
            ? new AutoAcceptRuleDto(merchantId, false, null, null)
            : new AutoAcceptRuleDto(rule.MerchantId, rule.Enabled, rule.MaxWeightKg, rule.MaxDistanceKm);
    }

    public async Task<AutoAcceptRuleDto> UpdateAsync(UpdateAutoAcceptRuleRequest request, CancellationToken ct = default)
    {
        if (request.MaxWeightKg is <= 0)
        {
            throw AppException.Validation("最大重量必须大于 0");
        }

        if (request.MaxDistanceKm is <= 0)
        {
            throw AppException.Validation("最大距离必须大于 0");
        }

        var merchantId = await _merchant.ResolveMerchantIdAsync(null, ct);
        var rule = await _db.AutoAcceptRules.FirstOrDefaultAsync(r => r.MerchantId == merchantId, ct);

        if (rule is null)
        {
            rule = new AutoAcceptRule { MerchantId = merchantId };
            _db.AutoAcceptRules.Add(rule);
        }

        rule.Enabled = request.Enabled;
        rule.MaxWeightKg = request.MaxWeightKg;
        rule.MaxDistanceKm = request.MaxDistanceKm;

        await _db.SaveChangesAsync(ct);
        return new AutoAcceptRuleDto(rule.MerchantId, rule.Enabled, rule.MaxWeightKg, rule.MaxDistanceKm);
    }
}
