namespace Dubhe.Application.Orders.Dtos;

public static class OrderImportColumns
{
    public const string SenderName = "寄件人姓名";
    public const string SenderPhone = "寄件人电话";
    public const string SenderAddress = "寄件地址";
    public const string SenderLat = "寄件纬度";
    public const string SenderLng = "寄件经度";
    public const string ReceiverName = "收件人姓名";
    public const string ReceiverPhone = "收件人电话";
    public const string ReceiverAddress = "收件地址";
    public const string ReceiverLat = "收件纬度";
    public const string ReceiverLng = "收件经度";
    public const string ItemCategory = "物品类型";
    public const string ItemName = "物品名称";
    public const string WeightKg = "重量(kg)";
    public const string VolumeM3 = "体积(m³)";
    public const string Quantity = "数量";
    public const string IsUrgent = "加急";
    public const string ScheduledAt = "预约时间";
    public const string CouponAmount = "优惠金额";
    public const string Remark = "备注";

    public static readonly string[] All =
    {
        SenderName, SenderPhone, SenderAddress, SenderLat, SenderLng,
        ReceiverName, ReceiverPhone, ReceiverAddress, ReceiverLat, ReceiverLng,
        ItemCategory, ItemName, WeightKg, VolumeM3, Quantity, IsUrgent,
        ScheduledAt, CouponAmount, Remark
    };

    public static readonly string[] Required =
    {
        SenderName, SenderPhone, SenderAddress, SenderLat, SenderLng,
        ReceiverName, ReceiverPhone, ReceiverAddress, ReceiverLat, ReceiverLng,
        ItemCategory, ItemName, WeightKg
    };
}

public sealed record OrderImportRow(
    int RowNumber,
    string SenderName,
    string SenderPhone,
    string SenderAddress,
    string SenderLat,
    string SenderLng,
    string ReceiverName,
    string ReceiverPhone,
    string ReceiverAddress,
    string ReceiverLat,
    string ReceiverLng,
    string ItemCategory,
    string ItemName,
    string WeightKg,
    string VolumeM3,
    string Quantity,
    string IsUrgent,
    string ScheduledAt,
    string CouponAmount,
    string Remark);

public sealed record OrderImportRowErrorDto(int RowNumber, string Message);

public sealed record OrderImportResultDto(
    int Total,
    int Succeeded,
    int Failed,
    IReadOnlyList<OrderImportRowErrorDto> Errors,
    IReadOnlyList<Guid> OrderIds);
