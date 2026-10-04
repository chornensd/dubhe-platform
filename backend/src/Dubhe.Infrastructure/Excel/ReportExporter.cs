using ClosedXML.Excel;
using Dubhe.Application.Report.Dtos;

namespace Dubhe.Infrastructure.Excel;

public sealed class ReportExporter : IReportExporter
{
    public byte[] BuildReport(
        string title,
        IReadOnlyList<ReportFieldDefDto> columns,
        IReadOnlyList<IReadOnlyDictionary<string, object?>> rows)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.Worksheets.Add("报表");

        var columnCount = Math.Max(1, columns.Count);
        sheet.Cell(1, 1).Value = title;
        sheet.Range(1, 1, 1, columnCount).Merge();
        sheet.Cell(1, 1).Style.Font.Bold = true;
        sheet.Cell(1, 1).Style.Font.FontSize = 14;
        sheet.Cell(1, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

        for (var i = 0; i < columns.Count; i++)
        {
            var cell = sheet.Cell(2, i + 1);
            cell.Value = columns[i].Name;
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#E8F0FE");
        }

        var rowNumber = 3;
        foreach (var row in rows)
        {
            for (var i = 0; i < columns.Count; i++)
            {
                SetCellValue(sheet.Cell(rowNumber, i + 1), row.GetValueOrDefault(columns[i].Key));
            }

            rowNumber++;
        }

        sheet.SheetView.FreezeRows(2);
        sheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    private static void SetCellValue(IXLCell cell, object? value)
    {
        switch (value)
        {
            case null:
                cell.Value = string.Empty;
                break;
            case bool boolValue:
                cell.Value = boolValue ? "是" : "否";
                break;
            case decimal decimalValue:
                cell.Value = decimalValue;
                break;
            case int intValue:
                cell.Value = intValue;
                break;
            case long longValue:
                cell.Value = longValue;
                break;
            case double doubleValue:
                cell.Value = doubleValue;
                break;
            default:
                cell.Value = value.ToString() ?? string.Empty;
                break;
        }
    }
}
