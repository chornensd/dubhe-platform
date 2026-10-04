using Dubhe.Application.Orders.Dtos;

namespace Dubhe.Application.Orders;

public interface IOrderExcelParser
{
    byte[] BuildTemplate();
    IReadOnlyList<OrderImportRow> Parse(Stream stream);
}
