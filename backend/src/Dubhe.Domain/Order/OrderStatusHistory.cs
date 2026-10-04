using Dubhe.Domain.Common;

namespace Dubhe.Domain.Order;

public class OrderStatusHistory : BaseEntity
{
    public Guid OrderId { get; set; }
    public OrderStatus? FromStatus { get; set; }
    public OrderStatus ToStatus { get; set; }
    public Guid? OperatorId { get; set; }
    public string? Remark { get; set; }
}
