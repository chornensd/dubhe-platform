using Dubhe.Application.Abstractions;
using Dubhe.Application.Airspace.Dtos;
using Dubhe.Application.Common;
using Dubhe.Domain.Airspace;
using Dubhe.Domain.Auth;
using Dubhe.Domain.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Dubhe.Application.Airspace;

public interface IAirspaceZoneService
{
    Task<PagedResult<AirspaceZoneDto>> SearchAsync(AirspaceZoneQuery query, CancellationToken ct = default);
    Task<AirspaceZoneDto> CreatePlatformZoneAsync(CreateAirspaceZoneRequest request, CancellationToken ct = default);
    Task<AirspaceZoneDto> UpdatePlatformZoneAsync(Guid id, UpdateAirspaceZoneRequest request, CancellationToken ct = default);
    Task<AirspaceZoneDto> CreateFenceAsync(CreateAirspaceZoneRequest request, CancellationToken ct = default);
    Task<AirspaceZoneDto> UpdateFenceAsync(Guid id, UpdateAirspaceZoneRequest request, CancellationToken ct = default);
    Task DeactivateAsync(Guid id, bool requireFence, CancellationToken ct = default);
    Task<AirspaceZoneDto> MockAtsSyncAsync(CancellationToken ct = default);
}

public sealed class AirspaceZoneService : IAirspaceZoneService
{
    private readonly IAppDbContext _db;
    private readonly MerchantContext _merchant;
    private readonly IDateTime _clock;
    private readonly AirspaceOptions _options;

    public AirspaceZoneService(
        IAppDbContext db,
        MerchantContext merchant,
        IDateTime clock,
        IOptions<AirspaceOptions> options)
    {
        _db = db;
        _merchant = merchant;
        _clock = clock;
        _options = options.Value;
    }

    public async Task<PagedResult<AirspaceZoneDto>> SearchAsync(
        AirspaceZoneQuery query,
        CancellationToken ct = default)
    {
        var pageNum = Math.Max(1, query.PageNum);
        var pageSize = Math.Clamp(query.PageSize, 1, 500);
        var q = _db.AirspaceZones.AsNoTracking();

        var me = await _merchant.GetCurrentUserAsync(ct);
        var overseer = _merchant.IsAdmin
                       || me.UserType == UserType.AirTrafficController
                       || me.UserType == UserType.Pilot
                       || _merchant.IsPilotRole;

        if (!overseer)
        {
            var merchantId = await _merchant.ResolveMerchantIdAsync(null, ct);
            q = q.Where(z => z.MerchantId == null || z.MerchantId == merchantId);
        }

        if (query.Type is not null)
        {
            q = q.Where(z => z.Type == query.Type);
        }

        if (query.ActiveOnly)
        {
            q = q.Where(z => z.IsActive);
        }

        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderBy(z => z.Type).ThenByDescending(z => z.CreatedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<AirspaceZoneDto>
        {
            Items = rows.Select(Map).ToList(),
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task<AirspaceZoneDto> CreatePlatformZoneAsync(
        CreateAirspaceZoneRequest request,
        CancellationToken ct = default)
    {
        Validate(request, isFence: false);

        var zone = new AirspaceZone
        {
            Code = GenerateCode("AZ"),
            Name = request.Name.Trim(),
            Type = (AirspaceZoneType)request.Type,
            Source = AirspaceZoneSource.Manual,
            MerchantId = null,
            CenterLat = request.CenterLat,
            CenterLng = request.CenterLng,
            RadiusKm = request.RadiusKm,
            MinAltitudeM = request.MinAltitudeM,
            MaxAltitudeM = request.MaxAltitudeM,
            EffectiveFrom = request.EffectiveFrom?.ToUniversalTime(),
            EffectiveTo = request.EffectiveTo?.ToUniversalTime(),
            Reason = request.Reason,
            IsActive = true
        };

        _db.AirspaceZones.Add(zone);
        await _db.SaveChangesAsync(ct);
        return Map(zone);
    }

    public async Task<AirspaceZoneDto> UpdatePlatformZoneAsync(
        Guid id,
        UpdateAirspaceZoneRequest request,
        CancellationToken ct = default)
    {
        var zone = await _db.AirspaceZones.FirstOrDefaultAsync(z => z.Id == id, ct)
            ?? throw AppException.NotFound("空域不存在");

        if (zone.MerchantId is not null)
        {
            throw AppException.Forbidden("商家电子围栏请使用围栏接口维护");
        }

        Apply(zone, request);
        await _db.SaveChangesAsync(ct);
        return Map(zone);
    }

    public async Task<AirspaceZoneDto> CreateFenceAsync(
        CreateAirspaceZoneRequest request,
        CancellationToken ct = default)
    {
        Validate(request, isFence: true);
        var merchantId = await _merchant.ResolveMerchantIdAsync(null, ct);

        var fence = new AirspaceZone
        {
            Code = GenerateCode("FNC"),
            Name = request.Name.Trim(),
            Type = (AirspaceZoneType)request.Type,
            Source = AirspaceZoneSource.MerchantFence,
            MerchantId = merchantId,
            CenterLat = request.CenterLat,
            CenterLng = request.CenterLng,
            RadiusKm = request.RadiusKm,
            MinAltitudeM = request.MinAltitudeM,
            MaxAltitudeM = request.MaxAltitudeM,
            EffectiveFrom = null,
            EffectiveTo = null,
            Reason = request.Reason,
            IsActive = true
        };

        _db.AirspaceZones.Add(fence);
        await _db.SaveChangesAsync(ct);
        return Map(fence);
    }

    public async Task<AirspaceZoneDto> UpdateFenceAsync(
        Guid id,
        UpdateAirspaceZoneRequest request,
        CancellationToken ct = default)
    {
        var fence = await _db.AirspaceZones.FirstOrDefaultAsync(z => z.Id == id, ct)
            ?? throw AppException.NotFound("围栏不存在");

        var merchantId = await _merchant.ResolveMerchantIdAsync(null, ct);
        if (fence.MerchantId != merchantId)
        {
            throw AppException.Forbidden("无权操作该围栏");
        }

        Apply(fence, request);
        await _db.SaveChangesAsync(ct);
        return Map(fence);
    }

    public async Task DeactivateAsync(Guid id, bool requireFence, CancellationToken ct = default)
    {
        var zone = await _db.AirspaceZones.FirstOrDefaultAsync(z => z.Id == id, ct)
            ?? throw AppException.NotFound("空域不存在");

        if (requireFence)
        {
            var merchantId = await _merchant.ResolveMerchantIdAsync(null, ct);
            if (zone.MerchantId != merchantId)
            {
                throw AppException.Forbidden("无权操作该围栏");
            }
        }
        else if (zone.MerchantId is not null)
        {
            throw AppException.Forbidden("商家电子围栏请使用围栏接口维护");
        }

        zone.IsActive = false;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<AirspaceZoneDto> MockAtsSyncAsync(CancellationToken ct = default)
    {
        var now = _clock.UtcNow;
        var zone = new AirspaceZone
        {
            Code = GenerateCode("TMP"),
            Name = $"临时管制区（模拟空管 {now.LocalDateTime:HH:mm}）",
            Type = AirspaceZoneType.TemporaryControl,
            Source = AirspaceZoneSource.MockAts,
            MerchantId = null,
            CenterLat = _options.MockAtsCenterLat,
            CenterLng = _options.MockAtsCenterLng,
            RadiusKm = _options.MockAtsRadiusKm,
            MinAltitudeM = null,
            MaxAltitudeM = null,
            EffectiveFrom = now,
            EffectiveTo = now.AddHours(_options.MockAtsValidHours),
            Reason = "模拟空管部门下发的临时管制指令",
            IsActive = true
        };

        _db.AirspaceZones.Add(zone);
        await _db.SaveChangesAsync(ct);
        return Map(zone);
    }

    private static void Validate(CreateAirspaceZoneRequest request, bool isFence)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw AppException.Validation("空域名称不能为空");
        }

        var allowed = isFence
            ? new[] { AirspaceZoneType.NoFly, AirspaceZoneType.Restricted }
            : new[] { AirspaceZoneType.NoFly, AirspaceZoneType.Restricted, AirspaceZoneType.TemporaryControl };
        if (!allowed.Contains((AirspaceZoneType)request.Type))
        {
            throw AppException.Validation(isFence ? "围栏类型仅支持禁飞或限飞" : "空域类型不合法");
        }

        if (request.CenterLat is < -90 or > 90 || request.CenterLng is < -180 or > 180
            || (request.CenterLat == 0 && request.CenterLng == 0))
        {
            throw AppException.Validation("中心坐标不合法");
        }

        if (request.RadiusKm is <= 0 or > 200)
        {
            throw AppException.Validation("半径需在 0-200 公里之间");
        }

        if (request.MinAltitudeM is < 0 || request.MaxAltitudeM is < 0)
        {
            throw AppException.Validation("高度限制不能为负");
        }

        if (request.MinAltitudeM is { } min && request.MaxAltitudeM is { } max && min >= max)
        {
            throw AppException.Validation("最低高度必须小于最高高度");
        }

        if (request.EffectiveFrom is { } from && request.EffectiveTo is { } to && to <= from)
        {
            throw AppException.Validation("生效结束时间必须晚于开始时间");
        }
    }

    private static void Apply(AirspaceZone zone, UpdateAirspaceZoneRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            zone.Name = request.Name.Trim();
        }

        if (request.Type is not null)
        {
            if (!Enum.IsDefined(typeof(AirspaceZoneType), request.Type.Value))
            {
                throw AppException.Validation("空域类型不合法");
            }

            zone.Type = (AirspaceZoneType)request.Type.Value;
        }

        if (request.CenterLat is not null || request.CenterLng is not null)
        {
            var lat = request.CenterLat ?? zone.CenterLat;
            var lng = request.CenterLng ?? zone.CenterLng;
            if (lat is < -90 or > 90 || lng is < -180 or > 180 || (lat == 0 && lng == 0))
            {
                throw AppException.Validation("中心坐标不合法");
            }

            zone.CenterLat = lat;
            zone.CenterLng = lng;
        }

        if (request.RadiusKm is <= 0 or > 200)
        {
            throw AppException.Validation("半径需在 0-200 公里之间");
        }

        if (request.RadiusKm is not null)
        {
            zone.RadiusKm = request.RadiusKm.Value;
        }

        if (request.MinAltitudeM is not null)
        {
            zone.MinAltitudeM = request.MinAltitudeM;
        }

        if (request.MaxAltitudeM is not null)
        {
            zone.MaxAltitudeM = request.MaxAltitudeM;
        }

        if (request.EffectiveFrom is not null)
        {
            zone.EffectiveFrom = request.EffectiveFrom.Value.ToUniversalTime();
        }

        if (request.EffectiveTo is not null)
        {
            zone.EffectiveTo = request.EffectiveTo.Value.ToUniversalTime();
        }

        if (request.Reason is not null)
        {
            zone.Reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim();
        }

        if (request.IsActive is not null)
        {
            zone.IsActive = request.IsActive.Value;
        }
    }

    private static string GenerateCode(string prefix) =>
        $"{prefix}{DateTimeOffset.UtcNow:yyyyMMdd}{Guid.NewGuid():N}"[..16].ToUpperInvariant();

    private static AirspaceZoneDto Map(AirspaceZone zone) => new(
        zone.Id,
        zone.Code,
        zone.Name,
        zone.Type.ToString(),
        zone.Source.ToString(),
        zone.MerchantId,
        zone.CenterLat,
        zone.CenterLng,
        zone.RadiusKm,
        zone.MinAltitudeM,
        zone.MaxAltitudeM,
        zone.EffectiveFrom,
        zone.EffectiveTo,
        zone.Reason,
        zone.IsActive,
        zone.CreatedAt);
}
