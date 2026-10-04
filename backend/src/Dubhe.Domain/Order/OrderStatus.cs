namespace Dubhe.Domain.Order;

public enum OrderStatus
{
    PendingAccept = 1,
    PendingDispatch = 2,
    InFlight = 3,
    Delivered = 4,
    Cancelled = 5
}
