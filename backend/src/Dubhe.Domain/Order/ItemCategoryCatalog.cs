namespace Dubhe.Domain.Order;

public sealed record ItemCategoryDef(string Code, string Name, bool IsProhibited);

public static class ItemCategoryCatalog
{
    public static readonly IReadOnlyList<ItemCategoryDef> Categories = new List<ItemCategoryDef>
    {
        new("documents", "文件票据", false),
        new("food", "食品", false),
        new("medicine", "医药用品", false),
        new("electronics", "电子产品", false),
        new("clothing", "服饰", false),
        new("other", "其他", false),
        new("flammable", "易燃易爆品", true),
        new("weapon", "武器及管制刀具", true),
        new("drug", "毒品及违禁药物", true),
        new("live_animal", "活体动物", true),
        new("chemical", "危险化学品", true)
    };

    public static bool Exists(string code) =>
        Categories.Any(c => string.Equals(c.Code, code, StringComparison.OrdinalIgnoreCase));

    public static bool IsProhibited(string code) =>
        Categories.Any(c => string.Equals(c.Code, code, StringComparison.OrdinalIgnoreCase) && c.IsProhibited);

    public static bool TryResolve(string raw, out string code)
    {
        var value = raw?.Trim() ?? string.Empty;
        var match = Categories.FirstOrDefault(c =>
            string.Equals(c.Code, value, StringComparison.OrdinalIgnoreCase) || c.Name == value);
        code = match?.Code ?? string.Empty;
        return match is not null;
    }
}
