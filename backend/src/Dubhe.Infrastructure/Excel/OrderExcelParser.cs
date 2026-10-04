using ClosedXML.Excel;
using Dubhe.Application.Orders;
using Dubhe.Application.Orders.Dtos;
using Dubhe.Domain.Common;

namespace Dubhe.Infrastructure.Excel;

public sealed class OrderExcelParser : IOrderExcelParser
{
    private static readonly string[] ExampleRow =
    {
        "张三", "13800000001", "杭州市西湖区文一西路 1 号", "30.2730", "120.0750",
        "李四", "13900000002", "杭州市滨江区江南大道 2 号", "30.2080", "120.2110",
        "文件票据", "合同文件", "1.5", "0.01", "1", "否", "2026-10-01 10:00", "0", "易碎品"
    };

    public byte[] BuildTemplate()
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add("订单导入");

        for (var i = 0; i < OrderImportColumns.All.Length; i++)
        {
            var cell = sheet.Cell(1, i + 1);
            cell.Value = OrderImportColumns.All[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#E8F0FE");
        }

        for (var i = 0; i < ExampleRow.Length; i++)
        {
            sheet.Cell(2, i + 1).Value = ExampleRow[i];
        }

        var notes = workbook.Worksheets.Add("填写说明");
        notes.Cell(1, 1).Value = "填写说明";
        notes.Cell(1, 1).Style.Font.Bold = true;

        var lines = new[]
        {
            "1. 请勿修改表头名称；从第 2 行开始填写数据。",
            "2. 必填：寄件人/收件人姓名、电话、地址、经纬度，物品类型、物品名称、重量。",
            "3. 物品类型可填编码或中文名：documents 文件票据 / food 食品 / medicine 医药用品 / electronics 电子产品 / clothing 服饰 / other 其他；禁运品将被拒绝。",
            "4. 坐标格式为十进制度（如 30.2730）；加急填“是/否”；预约时间格式 yyyy-MM-dd HH:mm。",
            "5. 单次最多导入 500 行，失败行会在导入结果中返回行号与原因。"
        };

        for (var i = 0; i < lines.Length; i++)
        {
            notes.Cell(i + 2, 1).Value = lines[i];
        }

        sheet.SheetView.FreezeRows(1);
        sheet.Columns().AdjustToContents();
        notes.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    public IReadOnlyList<OrderImportRow> Parse(Stream stream)
    {
        XLWorkbook workbook;
        try
        {
            workbook = new XLWorkbook(stream);
        }
        catch
        {
            throw AppException.Validation("Excel 文件无法解析，请使用 .xlsx 模板");
        }

        using (workbook)
        {
            var sheet = workbook.Worksheets.FirstOrDefault()
                ?? throw AppException.Validation("Excel 中没有工作表");

            var columns = new Dictionary<string, int>(StringComparer.Ordinal);
            foreach (var cell in sheet.Row(1).CellsUsed())
            {
                var header = cell.GetString().Trim();
                if (!string.IsNullOrEmpty(header) && !columns.ContainsKey(header))
                {
                    columns[header] = cell.Address.ColumnNumber;
                }
            }

            foreach (var required in OrderImportColumns.Required)
            {
                if (!columns.ContainsKey(required))
                {
                    throw AppException.Validation($"Excel 缺少必需列：{required}");
                }
            }

            var rows = new List<OrderImportRow>();
            var lastRowNumber = sheet.LastRowUsed()?.RowNumber() ?? 1;

            for (var rowNumber = 2; rowNumber <= lastRowNumber; rowNumber++)
            {
                var row = sheet.Row(rowNumber);
                if (OrderImportColumns.All.All(header => string.IsNullOrWhiteSpace(GetCell(row, columns, header))))
                {
                    break;
                }

                rows.Add(new OrderImportRow(
                    rowNumber,
                    GetCell(row, columns, OrderImportColumns.SenderName),
                    GetCell(row, columns, OrderImportColumns.SenderPhone),
                    GetCell(row, columns, OrderImportColumns.SenderAddress),
                    GetCell(row, columns, OrderImportColumns.SenderLat),
                    GetCell(row, columns, OrderImportColumns.SenderLng),
                    GetCell(row, columns, OrderImportColumns.ReceiverName),
                    GetCell(row, columns, OrderImportColumns.ReceiverPhone),
                    GetCell(row, columns, OrderImportColumns.ReceiverAddress),
                    GetCell(row, columns, OrderImportColumns.ReceiverLat),
                    GetCell(row, columns, OrderImportColumns.ReceiverLng),
                    GetCell(row, columns, OrderImportColumns.ItemCategory),
                    GetCell(row, columns, OrderImportColumns.ItemName),
                    GetCell(row, columns, OrderImportColumns.WeightKg),
                    GetCell(row, columns, OrderImportColumns.VolumeM3),
                    GetCell(row, columns, OrderImportColumns.Quantity),
                    GetCell(row, columns, OrderImportColumns.IsUrgent),
                    GetCell(row, columns, OrderImportColumns.ScheduledAt),
                    GetCell(row, columns, OrderImportColumns.CouponAmount),
                    GetCell(row, columns, OrderImportColumns.Remark)));
            }

            return rows;
        }
    }

    private static string GetCell(IXLRow row, IReadOnlyDictionary<string, int> columns, string header) =>
        columns.TryGetValue(header, out var columnNumber)
            ? row.Cell(columnNumber).GetString().Trim()
            : string.Empty;
}
