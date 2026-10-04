using ClosedXML.Excel;
using Dubhe.Application.Orders.Dtos;

namespace Dubhe.Infrastructure.Excel;

public sealed class SettlementExporter : ISettlementExporter
{
    public byte[] BuildStatement(SettlementStatementDto statement)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add("结算单");

        sheet.Cell(1, 1).Value = "结算单";
        sheet.Range(1, 1, 1, 6).Merge();
        sheet.Cell(1, 1).Style.Font.Bold = true;
        sheet.Cell(1, 1).Style.Font.FontSize = 16;
        sheet.Cell(1, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

        var summary = new (string Label, string Value)[]
        {
            ("结算单号", statement.StatementNo),
            ("商家 ID", statement.MerchantId.ToString()),
            ("结算周期", $"{statement.PeriodStart.LocalDateTime:yyyy-MM-dd} ~ {statement.PeriodEnd.LocalDateTime:yyyy-MM-dd}"),
            ("订单数量", statement.OrderCount.ToString()),
            ("订单总额", statement.TotalAmount.ToString("0.00")),
            ("平台佣金比例", statement.CommissionRate.ToString("P2")),
            ("平台佣金", statement.CommissionAmount.ToString("0.00")),
            ("商家应结", statement.NetAmount.ToString("0.00")),
            ("状态", statement.Status),
            ("生成时间", statement.GeneratedAt.LocalDateTime.ToString("yyyy-MM-dd HH:mm"))
        };

        var row = 3;
        foreach (var (label, value) in summary)
        {
            sheet.Cell(row, 1).Value = label;
            sheet.Cell(row, 1).Style.Font.Bold = true;
            sheet.Cell(row, 2).Value = value;
            row++;
        }

        row++;
        var headerRow = row;
        var headers = new[] { "订单号", "订单金额", "佣金", "商家应结", "支付状态", "送达时间" };
        for (var i = 0; i < headers.Length; i++)
        {
            var cell = sheet.Cell(headerRow, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#E8F0FE");
        }

        row++;
        foreach (var item in statement.Items ?? Array.Empty<SettlementItemDto>())
        {
            sheet.Cell(row, 1).Value = item.OrderNo;
            sheet.Cell(row, 2).Value = item.TotalAmount;
            sheet.Cell(row, 3).Value = item.CommissionAmount;
            sheet.Cell(row, 4).Value = item.NetAmount;
            sheet.Cell(row, 5).Value = item.PaymentStatus;
            sheet.Cell(row, 6).Value = item.DeliveredAt?.LocalDateTime.ToString("yyyy-MM-dd HH:mm") ?? string.Empty;
            row++;
        }

        if (statement.Reconciliation is { } reconciliation)
        {
            row++;
            sheet.Cell(row, 1).Value = "对账差异";
            sheet.Cell(row, 1).Style.Font.Bold = true;
            row++;
            sheet.Cell(row, 1).Value = "已支付订单";
            sheet.Cell(row, 2).Value = reconciliation.PaidCount;
            row++;
            sheet.Cell(row, 1).Value = "未支付订单";
            sheet.Cell(row, 2).Value = reconciliation.UnpaidCount;
            sheet.Cell(row, 3).Value = $"金额 {reconciliation.UnpaidAmount:0.00}";
            row++;
            sheet.Cell(row, 1).Value = "已退款订单";
            sheet.Cell(row, 2).Value = reconciliation.RefundedCount;
            sheet.Cell(row, 3).Value = $"金额 {reconciliation.RefundedAmount:0.00}";
        }

        sheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }
}
