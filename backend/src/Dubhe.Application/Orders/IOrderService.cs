using Dubhe.Application.Common;
using Dubhe.Application.Orders.Dtos;

namespace Dubhe.Application.Orders;

public interface IOrderService
{
    Task<OrderEstimateDto> EstimateAsync(OrderCreateRequest request, CancellationToken ct = default);
    Task<OrderDto> CreateAsync(OrderCreateRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<MerchantOptionDto>> AvailableMerchantsAsync(string? keyword, CancellationToken ct = default);
    Task<OrderImportResultDto> ImportAsync(Guid merchantId, Stream stream, CancellationToken ct = default);
    Task<PagedResult<OrderListItemDto>> SearchAsync(OrderQuery query, CancellationToken ct = default);
    Task<OrderDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<OrderDto> AcceptAsync(Guid id, CancellationToken ct = default);
    Task<OrderDto> RejectAsync(Guid id, RejectOrderRequest request, CancellationToken ct = default);
    Task<OrderDto> CancelAsync(Guid id, CancelOrderRequest request, CancellationToken ct = default);
    Task<OrderDto> DispatchAsync(Guid id, DispatchOrderRequest request, CancellationToken ct = default);
    Task<OrderDto> StartFlightAsync(Guid id, CancellationToken ct = default);
    Task<OrderDto> CompleteAsync(Guid id, CompleteOrderRequest request, CancellationToken ct = default);
    Task<OrderDto> DeclineAsync(Guid id, RejectOrderRequest request, CancellationToken ct = default);
    Task<OrderDto> ReviewAsync(Guid id, ReviewOrderRequest request, CancellationToken ct = default);
}
