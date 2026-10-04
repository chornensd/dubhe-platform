using Dubhe.Application.Abstractions;
using Dubhe.Application.Common;
using Dubhe.Application.Resource.Dtos;
using Dubhe.Domain.Auth;
using Dubhe.Domain.Common;
using Dubhe.Domain.Order;
using Dubhe.Domain.Resource;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Resource;

public sealed class DroneService : IDroneService
{
    private readonly IAppDbContext _db;
    private readonly MerchantContext _merchant;

    public DroneService(IAppDbContext db, MerchantContext merchant)
    {
        _db = db;
        _merchant = merchant;
    }

    public async Task<DroneDto> CreateAsync(CreateDroneRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.SerialNo) || string.IsNullOrWhiteSpace(request.Model))
        {
            throw AppException.Validation("飞行器编号与型号不能为空");
        }

        if (request.MaxPayloadKg <= 0 || request.EnduranceMinutes <= 0)
        {
            throw AppException.Validation("载重与续航参数必须大于 0");
        }

        if (request.BatteryPercent is < 0 or > 100)
        {
            throw AppException.Validation("电量必须在 0-100 之间");
        }

        var merchantId = await _merchant.ResolveMerchantIdAsync(request.MerchantId, ct);
        var serialNo = request.SerialNo.Trim().ToUpperInvariant();

        var exists = await _db.Drones.AnyAsync(d => d.SerialNo == serialNo, ct);
        if (exists)
        {
            throw AppException.Conflict("飞行器编号已存在");
        }

        var drone = new Drone
        {
            MerchantId = merchantId,
            SerialNo = serialNo,
            Model = request.Model.Trim(),
            MaxPayloadKg = request.MaxPayloadKg,
            EnduranceMinutes = request.EnduranceMinutes,
            BatteryPercent = request.BatteryPercent,
            Status = DroneStatus.Idle
        };

        _db.Drones.Add(drone);
        await _db.SaveChangesAsync(ct);
        return Map(drone);
    }

    public async Task<PagedResult<DroneDto>> SearchAsync(DroneQuery query, CancellationToken ct = default)
    {
        var pageNum = Math.Max(1, query.PageNum);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        var q = _db.Drones.AsNoTracking();

        if (_merchant.CanOverseeResources)
        {
            if (query.MerchantId is not null)
            {
                q = q.Where(d => d.MerchantId == query.MerchantId);
            }
        }
        else
        {
            var me = await _merchant.GetCurrentUserAsync(ct);
            if (me.UserType == UserType.Pilot || _merchant.IsPilotRole)
            {
                // 机长仅可见自己被指派订单涉及的飞行器
                var droneIds = await _db.Orders.AsNoTracking()
                    .Where(o => o.PilotId == me.Id && o.DroneId != null)
                    .Select(o => o.DroneId!.Value)
                    .Distinct()
                    .ToListAsync(ct);
                q = q.Where(d => droneIds.Contains(d.Id));
            }
            else
            {
                var merchantId = await _merchant.ResolveMerchantIdAsync(query.MerchantId, ct);
                q = q.Where(d => d.MerchantId == merchantId);
            }
        }

        if (query.Status is not null)
        {
            q = q.Where(d => d.Status == query.Status);
        }

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var keyword = query.Keyword.Trim();
            q = q.Where(d => d.SerialNo.Contains(keyword.ToUpper()) || d.Model.Contains(keyword));
        }

        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(d => d.CreatedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<DroneDto>
        {
            Items = rows.Select(Map).ToList(),
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    private static DroneDto Map(Drone drone) => new(
        drone.Id,
        drone.MerchantId,
        drone.SerialNo,
        drone.Model,
        drone.Status.ToString(),
        drone.MaxPayloadKg,
        drone.EnduranceMinutes,
        drone.BatteryPercent,
        drone.CumulativeFlightMinutes,
        drone.HealthScore,
        drone.LastMaintainedAt,
        drone.CreatedAt);
}

public sealed class ServiceAreaService : IServiceAreaService
{
    private readonly IAppDbContext _db;
    private readonly MerchantContext _merchant;

    public ServiceAreaService(IAppDbContext db, MerchantContext merchant)
    {
        _db = db;
        _merchant = merchant;
    }

    public async Task<ServiceAreaDto> CreateAsync(CreateServiceAreaRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw AppException.Validation("服务区域名称不能为空");
        }

        if (request.RadiusKm is <= 0 or > 500)
        {
            throw AppException.Validation("服务半径需在 0-500 公里之间");
        }

        if (request.CenterLat is < -90 or > 90 || request.CenterLng is < -180 or > 180
            || (request.CenterLat == 0 && request.CenterLng == 0))
        {
            throw AppException.Validation("中心坐标不合法");
        }

        var merchantId = await _merchant.ResolveMerchantIdAsync(request.MerchantId, ct);
        var area = new ServiceArea
        {
            MerchantId = merchantId,
            Name = request.Name.Trim(),
            CenterLat = request.CenterLat,
            CenterLng = request.CenterLng,
            RadiusKm = request.RadiusKm,
            IsActive = true
        };

        _db.ServiceAreas.Add(area);
        await _db.SaveChangesAsync(ct);
        return Map(area);
    }

    public async Task<IReadOnlyList<ServiceAreaDto>> ListAsync(Guid? merchantId, CancellationToken ct = default)
    {
        IQueryable<ServiceArea> q = _db.ServiceAreas.AsNoTracking();
        if (_merchant.IsAdmin)
        {
            if (merchantId is not null)
            {
                q = q.Where(a => a.MerchantId == merchantId);
            }
        }
        else
        {
            var effectiveMerchantId = await _merchant.ResolveMerchantIdAsync(merchantId, ct);
            q = q.Where(a => a.MerchantId == effectiveMerchantId);
        }

        var areas = await q.OrderByDescending(a => a.CreatedAt).ToListAsync(ct);
        return areas.Select(Map).ToList();
    }

    private static ServiceAreaDto Map(ServiceArea area) => new(
        area.Id,
        area.MerchantId,
        area.Name,
        area.CenterLat,
        area.CenterLng,
        area.RadiusKm,
        area.IsActive,
        area.CreatedAt);
}
