using Dubhe.Application.Abstractions;
using Dubhe.Application.Common;
using Dubhe.Application.Resource.Dtos;
using Dubhe.Domain.Common;
using Dubhe.Domain.Resource;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Resource;

public interface IStationService
{
    Task<StationDto> CreateAsync(CreateStationRequest request, CancellationToken ct = default);
    Task<StationDto> UpdateAsync(Guid id, UpdateStationRequest request, CancellationToken ct = default);
    Task<PagedResult<StationDto>> SearchAsync(StationQuery query, CancellationToken ct = default);
    Task<StationDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<ReservationDto> CreateReservationAsync(Guid stationId, CreateReservationRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<ReservationDto>> ListReservationsAsync(
        Guid stationId,
        DateTimeOffset? from,
        DateTimeOffset? to,
        CancellationToken ct = default);
    Task<ReservationDto> CancelReservationAsync(Guid reservationId, CancellationToken ct = default);
}

public sealed class StationService : IStationService
{
    private const int MaxReservationHours = 24;

    private readonly IAppDbContext _db;
    private readonly MerchantContext _merchant;
    private readonly IDateTime _clock;

    public StationService(IAppDbContext db, MerchantContext merchant, IDateTime clock)
    {
        _db = db;
        _merchant = merchant;
        _clock = clock;
    }

    public async Task<StationDto> CreateAsync(CreateStationRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw AppException.Validation("场站名称不能为空");
        }

        if (string.IsNullOrWhiteSpace(request.Address))
        {
            throw AppException.Validation("场站地址不能为空");
        }

        if (!Enum.IsDefined(typeof(StationType), request.Type))
        {
            throw AppException.Validation("场站类型不合法");
        }

        if (!IsValidCoordinates(request.Lat, request.Lng))
        {
            throw AppException.Validation("坐标不合法");
        }

        if (request.Capacity <= 0)
        {
            throw AppException.Validation("容量必须大于 0");
        }

        if (request.ChargerCount < 0)
        {
            throw AppException.Validation("充电桩数量不能为负");
        }

        var merchantId = await _merchant.ResolveMerchantIdAsync(request.MerchantId, ct);
        var name = request.Name.Trim();

        var exists = await _db.Stations.AnyAsync(s => s.MerchantId == merchantId && s.Name == name, ct);
        if (exists)
        {
            throw AppException.Conflict("同名场站已存在");
        }

        var station = new Station
        {
            MerchantId = merchantId,
            Name = name,
            Type = (StationType)request.Type,
            Address = request.Address.Trim(),
            Lat = request.Lat,
            Lng = request.Lng,
            Capacity = request.Capacity,
            ChargerCount = request.ChargerCount,
            Status = StationStatus.Idle,
            Remark = request.Remark
        };

        _db.Stations.Add(station);
        await _db.SaveChangesAsync(ct);
        return Map(station);
    }

    public async Task<StationDto> UpdateAsync(Guid id, UpdateStationRequest request, CancellationToken ct = default)
    {
        var station = await _db.Stations.FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw AppException.NotFound("场站不存在");

        if (!_merchant.CanOverseeResources && !await _merchant.CanOperateMerchantAsync(station.MerchantId, ct))
        {
            throw AppException.Forbidden("无权操作该场站");
        }

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            var name = request.Name.Trim();
            if (name != station.Name)
            {
                var exists = await _db.Stations.AnyAsync(
                    s => s.MerchantId == station.MerchantId && s.Name == name && s.Id != station.Id, ct);
                if (exists)
                {
                    throw AppException.Conflict("同名场站已存在");
                }

                station.Name = name;
            }
        }

        if (!string.IsNullOrWhiteSpace(request.Address))
        {
            station.Address = request.Address.Trim();
        }

        if (request.Lat is not null || request.Lng is not null)
        {
            var lat = request.Lat ?? station.Lat;
            var lng = request.Lng ?? station.Lng;
            if (!IsValidCoordinates(lat, lng))
            {
                throw AppException.Validation("坐标不合法");
            }

            station.Lat = lat;
            station.Lng = lng;
        }

        if (request.Capacity is <= 0)
        {
            throw AppException.Validation("容量必须大于 0");
        }

        if (request.ChargerCount is < 0)
        {
            throw AppException.Validation("充电桩数量不能为负");
        }

        if (request.Capacity is not null)
        {
            station.Capacity = request.Capacity.Value;
        }

        if (request.ChargerCount is not null)
        {
            station.ChargerCount = request.ChargerCount.Value;
        }

        if (request.Status is not null)
        {
            if (!Enum.IsDefined(typeof(StationStatus), request.Status.Value))
            {
                throw AppException.Validation("场站状态不合法");
            }

            station.Status = (StationStatus)request.Status.Value;
        }

        if (request.Remark is not null)
        {
            station.Remark = string.IsNullOrWhiteSpace(request.Remark) ? null : request.Remark.Trim();
        }

        await _db.SaveChangesAsync(ct);
        return Map(station);
    }

    public async Task<PagedResult<StationDto>> SearchAsync(StationQuery query, CancellationToken ct = default)
    {
        var pageNum = Math.Max(1, query.PageNum);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var q = _db.Stations.AsNoTracking();

        if (_merchant.CanOverseeResources)
        {
            if (query.MerchantId is not null)
            {
                q = q.Where(s => s.MerchantId == query.MerchantId);
            }
        }
        else
        {
            var merchantId = await _merchant.ResolveMerchantIdAsync(query.MerchantId, ct);
            q = q.Where(s => s.MerchantId == merchantId);
        }

        if (query.Type is not null)
        {
            q = q.Where(s => s.Type == query.Type);
        }

        if (query.Status is not null)
        {
            q = q.Where(s => s.Status == query.Status);
        }

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var keyword = query.Keyword.Trim();
            q = q.Where(s => s.Name.Contains(keyword) || s.Address.Contains(keyword));
        }

        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(s => s.CreatedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<StationDto>
        {
            Items = rows.Select(Map).ToList(),
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task<StationDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var station = await _db.Stations.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw AppException.NotFound("场站不存在");

        await EnsureCanViewAsync(station.MerchantId, ct);
        return Map(station);
    }

    public async Task<ReservationDto> CreateReservationAsync(
        Guid stationId,
        CreateReservationRequest request,
        CancellationToken ct = default)
    {
        if (!Enum.IsDefined(typeof(ReservationPurpose), request.Purpose))
        {
            throw AppException.Validation("预约用途不合法");
        }

        if (request.EndAt <= request.StartAt)
        {
            throw AppException.Validation("结束时间必须晚于开始时间");
        }

        if (request.EndAt <= _clock.UtcNow)
        {
            throw AppException.Validation("预约时间已过期");
        }

        if (request.EndAt - request.StartAt > TimeSpan.FromHours(MaxReservationHours))
        {
            throw AppException.Validation($"单次预约不能超过 {MaxReservationHours} 小时");
        }

        var station = await _db.Stations.FirstOrDefaultAsync(s => s.Id == stationId, ct)
            ?? throw AppException.NotFound("场站不存在");

        if (!_merchant.CanOverseeResources && !await _merchant.CanOperateMerchantAsync(station.MerchantId, ct))
        {
            throw AppException.Forbidden("无权操作该场站");
        }

        if (request.OrderId is not null)
        {
            var orderExists = await _db.Orders.AnyAsync(o => o.Id == request.OrderId, ct);
            if (!orderExists)
            {
                throw AppException.Validation("关联订单不存在");
            }
        }

        var startAt = request.StartAt.ToUniversalTime();
        var endAt = request.EndAt.ToUniversalTime();

        var overlapping = await _db.StationReservations.CountAsync(
            r => r.StationId == stationId
                 && r.Status == ReservationStatus.Reserved
                 && r.StartAt < endAt
                 && startAt < r.EndAt,
            ct);

        if (overlapping >= station.Capacity)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "预约时段已满，请调整时间或选择其他场站");
        }

        var me = await _merchant.GetCurrentUserAsync(ct);
        var reservation = new StationReservation
        {
            StationId = stationId,
            MerchantId = station.MerchantId,
            OrderId = request.OrderId,
            StartAt = startAt,
            EndAt = endAt,
            Purpose = (ReservationPurpose)request.Purpose,
            Status = ReservationStatus.Reserved,
            CreatedBy = me.Id,
            Remark = request.Remark
        };

        _db.StationReservations.Add(reservation);
        await _db.SaveChangesAsync(ct);
        return Map(reservation);
    }

    public async Task<IReadOnlyList<ReservationDto>> ListReservationsAsync(
        Guid stationId,
        DateTimeOffset? from,
        DateTimeOffset? to,
        CancellationToken ct = default)
    {
        var station = await _db.Stations.AsNoTracking().FirstOrDefaultAsync(s => s.Id == stationId, ct)
            ?? throw AppException.NotFound("场站不存在");

        await EnsureCanViewAsync(station.MerchantId, ct);

        var q = _db.StationReservations.AsNoTracking().Where(r => r.StationId == stationId);
        if (from is not null)
        {
            q = q.Where(r => r.EndAt >= from);
        }

        if (to is not null)
        {
            q = q.Where(r => r.StartAt <= to);
        }

        var rows = await q.OrderBy(r => r.StartAt).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<ReservationDto> CancelReservationAsync(Guid reservationId, CancellationToken ct = default)
    {
        var reservation = await _db.StationReservations.FirstOrDefaultAsync(r => r.Id == reservationId, ct)
            ?? throw AppException.NotFound("预约不存在");

        if (!_merchant.CanOverseeResources && !await _merchant.CanOperateMerchantAsync(reservation.MerchantId, ct))
        {
            throw AppException.Forbidden("无权操作该预约");
        }

        if (reservation.Status != ReservationStatus.Reserved)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "该预约已结束或已取消");
        }

        reservation.Status = ReservationStatus.Cancelled;
        await _db.SaveChangesAsync(ct);
        return Map(reservation);
    }

    private async Task EnsureCanViewAsync(Guid merchantId, CancellationToken ct)
    {
        if (_merchant.CanOverseeResources || await _merchant.CanOperateMerchantAsync(merchantId, ct))
        {
            return;
        }

        throw AppException.Forbidden("无权查看该场站");
    }

    private static bool IsValidCoordinates(double lat, double lng) =>
        lat is >= -90 and <= 90
        && lng is >= -180 and <= 180
        && !(lat == 0 && lng == 0);

    private static StationDto Map(Station station) => new(
        station.Id,
        station.MerchantId,
        station.Name,
        station.Type.ToString(),
        station.Address,
        station.Lat,
        station.Lng,
        station.Capacity,
        station.ChargerCount,
        station.Status.ToString(),
        station.Remark,
        station.CreatedAt);

    private static ReservationDto Map(StationReservation reservation) => new(
        reservation.Id,
        reservation.StationId,
        reservation.MerchantId,
        reservation.OrderId,
        reservation.StartAt,
        reservation.EndAt,
        reservation.Purpose.ToString(),
        reservation.Status.ToString(),
        reservation.Remark,
        reservation.CreatedAt);
}
