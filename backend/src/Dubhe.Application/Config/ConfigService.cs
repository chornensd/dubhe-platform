using Dubhe.Application.Abstractions;
using Dubhe.Application.Common;
using Dubhe.Application.Config.Dtos;
using Dubhe.Domain.Common;
using Dubhe.Domain.Config;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Config;

public interface IConfigService
{
    Task<IReadOnlyList<SystemConfigDto>> ListAsync(string? group, CancellationToken ct = default);
    Task<IReadOnlyList<SystemConfigDto>> UpdateAsync(UpdateConfigRequest request, CancellationToken ct = default);
}

public sealed class ConfigService : IConfigService
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly IDateTime _clock;

    public ConfigService(IAppDbContext db, ICurrentUser currentUser, IDateTime clock)
    {
        _db = db;
        _currentUser = currentUser;
        _clock = clock;
    }

    public async Task<IReadOnlyList<SystemConfigDto>> ListAsync(string? group, CancellationToken ct = default)
    {
        var q = _db.SystemConfigItems.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(group))
        {
            var value = group.Trim();
            q = q.Where(c => c.Group == value);
        }

        var rows = await q.OrderBy(c => c.Group).ThenBy(c => c.Key).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<IReadOnlyList<SystemConfigDto>> UpdateAsync(
        UpdateConfigRequest request,
        CancellationToken ct = default)
    {
        if (request.Items is not { Count: > 0 })
        {
            throw AppException.Validation("请提供需要修改的参数");
        }

        var keys = request.Items.Select(i => i.Key).Distinct().ToList();
        var items = await _db.SystemConfigItems.Where(c => keys.Contains(c.Key)).ToListAsync(ct);
        if (items.Count != keys.Count)
        {
            var missing = keys.Except(items.Select(i => i.Key));
            throw AppException.Validation($"参数不存在：{string.Join("、", missing)}");
        }

        var userId = _currentUser.UserId;
        foreach (var item in items)
        {
            var newValue = request.Items.First(i => i.Key == item.Key).Value ?? string.Empty;
            ValidateValue(item, newValue);
            item.Value = newValue.Trim();
            item.UpdatedBy = userId;
        }

        await _db.SaveChangesAsync(ct);
        return (await ListAsync(null, ct));
    }

    private static void ValidateValue(SystemConfigItem item, string value)
    {
        switch (item.ValueType)
        {
            case "number" when !decimal.TryParse(value.Trim(), out _):
                throw AppException.Validation($"参数 {item.Key} 需要数字值");
            case "bool" when !bool.TryParse(value.Trim(), out _):
                throw AppException.Validation($"参数 {item.Key} 需要布尔值（true/false）");
        }

        if (string.IsNullOrWhiteSpace(value))
        {
            throw AppException.Validation($"参数 {item.Key} 的值不能为空");
        }
    }

    private static SystemConfigDto Map(SystemConfigItem item) => new(
        item.Id,
        item.Key,
        item.Value,
        item.Group,
        item.Name,
        item.Description,
        item.ValueType,
        item.UpdatedAt);
}
