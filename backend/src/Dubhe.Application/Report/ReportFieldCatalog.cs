namespace Dubhe.Application.Report;

public static class ReportFieldCatalog
{
    private static readonly IReadOnlyList<Dtos.ReportFieldDefDto> OrderFields = new List<Dtos.ReportFieldDefDto>
    {
        new("orderNo", "订单号", "string"),
        new("status", "订单状态", "string"),
        new("merchantName", "商家", "string"),
        new("customerName", "客户", "string"),
        new("itemName", "物品名称", "string"),
        new("weightKg", "重量(kg)", "number"),
        new("quantity", "数量", "number"),
        new("isUrgent", "加急", "bool"),
        new("totalAmount", "订单金额", "number"),
        new("paymentStatus", "支付状态", "string"),
        new("receiverName", "收件人", "string"),
        new("receiverAddress", "收件地址", "string"),
        new("createdAt", "创建时间", "datetime"),
        new("deliveredAt", "送达时间", "datetime")
    };

    public static IReadOnlyList<Dtos.ReportFieldDefDto> For(string businessType) =>
        string.Equals(businessType, "order", StringComparison.OrdinalIgnoreCase)
            ? OrderFields
            : Array.Empty<Dtos.ReportFieldDefDto>();

    public static IReadOnlyList<string> DefaultFieldKeys { get; } = new[]
    {
        "orderNo", "status", "totalAmount", "paymentStatus", "createdAt"
    };
}
