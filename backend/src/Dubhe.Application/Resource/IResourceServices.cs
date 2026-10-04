using Dubhe.Application.Common;
using Dubhe.Application.Resource.Dtos;
using Dubhe.Domain.Resource;

namespace Dubhe.Application.Resource;

public interface IDroneService
{
    Task<DroneDto> CreateAsync(CreateDroneRequest request, CancellationToken ct = default);
    Task<PagedResult<DroneDto>> SearchAsync(DroneQuery query, CancellationToken ct = default);
}

public interface IServiceAreaService
{
    Task<ServiceAreaDto> CreateAsync(CreateServiceAreaRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<ServiceAreaDto>> ListAsync(Guid? merchantId, CancellationToken ct = default);
}
