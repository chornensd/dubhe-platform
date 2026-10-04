using Dubhe.Domain.Order;

namespace Dubhe.Tests.Orders;

public class ItemCategoryCatalogTests
{
    [Theory]
    [InlineData("flammable")]
    [InlineData("weapon")]
    [InlineData("drug")]
    [InlineData("live_animal")]
    [InlineData("chemical")]
    public void Prohibited_Categories_Are_Flagged(string code)
    {
        Assert.True(ItemCategoryCatalog.Exists(code));
        Assert.True(ItemCategoryCatalog.IsProhibited(code));
    }

    [Theory]
    [InlineData("documents")]
    [InlineData("food")]
    [InlineData("medicine")]
    [InlineData("electronics")]
    public void Allowed_Categories_Are_Not_Flagged(string code)
    {
        Assert.True(ItemCategoryCatalog.Exists(code));
        Assert.False(ItemCategoryCatalog.IsProhibited(code));
    }

    [Fact]
    public void Unknown_Category_Does_Not_Exist()
    {
        Assert.False(ItemCategoryCatalog.Exists("unknown-code"));
    }
}
