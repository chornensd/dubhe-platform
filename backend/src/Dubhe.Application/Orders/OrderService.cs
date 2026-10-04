using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Dubhe.Application.Abstractions;
using Dubhe.Application.Common;
using Dubhe.Application.Orders.Dtos;
using Dubhe.Application.Resource.Dtos;
using Dubhe.Domain.Auth;
using Dubhe.Domain.Common;
using Dubhe.Domain.Order;
using Dubhe.Domain.Resource;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Orders;

public sealed class OrderService : IOrderService
{
    private static readonly Regex PhonePattern = new("^1[3-9]\\d{9}$", RegexOptions.Compiled);

    private readonly IAppDbContext _db;
    private readonly MerchantContext _merchant;
    private readonly FeeCalculator _feeCalculator;
    private readonly IDateTime _clock;
    private readonly IOrderExcelParser _excelParser;

    public OrderService(
        IAppDbContext db,
        MerchantContext merchant,
        FeeCalculator feeCalculator,
        IDateTime clock,
        IOrderExcelParser excelParser)
    {
        _db = db;
        _merchant = merchant;
        _feeCalculator = feeCalculator;
        _clock = clock;
        _excelParser = excelParser;
    }

    public async Task<OrderEstimateDto> EstimateAsync(OrderCreateRequest request, CancellationToken ct = default)
    {
        await ValidateDraftAsync(request, ct);
        NormalizeCategory(request.ItemCategory);
        var areaChecked = await ValidateServiceAreaAsync(request, ct);
        var fee = _feeCalculator.Calculate(
            request.SenderLat,
            request.SenderLng,
            request.ReceiverLat,
            request.ReceiverLng,
            request.WeightKg,
            request.IsUrgent,
            request.CouponAmount);

        return new OrderEstimateDto(fee.DistanceKm, areaChecked, ToFeeDto(fee));
    }

    public async Task<OrderDto> CreateAsync(OrderCreateRequest request, CancellationToken ct = default)
    {
        var me = await _merchant.GetCurrentUserAsync(ct);
        var order = await BuildOrderAsync(request, me, ct);
        await TryApplyAutoAcceptAsync(order, ct);
        await _db.SaveChangesAsync(ct);

        return await GetAsync(order.Id, ct);
    }

    public async Task<IReadOnlyList<MerchantOptionDto>> AvailableMerchantsAsync(
        string? keyword,
        CancellationToken ct = default)
    {
        var query = _db.Users.AsNoTracking()
            .Where(u => u.UserType == UserType.Merchant && u.Status == AccountStatus.Active);

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var key = keyword.Trim();
            query = query.Where(u =>
                u.DisplayName.Contains(key) ||
                (u.CompanyName != null && u.CompanyName.Contains(key)));
        }

        var merchants = await query
            .OrderBy(u => u.DisplayName)
            .Take(50)
            .ToListAsync(ct);

        if (merchants.Count == 0)
        {
            return Array.Empty<MerchantOptionDto>();
        }

        var ids = merchants.Select(m => m.Id).ToList();
        var areas = await _db.ServiceAreas.AsNoTracking()
            .Where(a => ids.Contains(a.MerchantId) && a.IsActive)
            .ToListAsync(ct);

        return merchants
            .Select(m => new MerchantOptionDto(
                m.Id,
                m.DisplayName,
                m.CompanyName,
                areas.Where(a => a.MerchantId == m.Id)
                    .Select(a => new ServiceAreaDto(
                        a.Id, a.MerchantId, a.Name, a.CenterLat, a.CenterLng,
                        a.RadiusKm, a.IsActive, a.CreatedAt))
                    .ToList()))
            .ToList();
    }

    public async Task<OrderImportResultDto> ImportAsync(Guid merchantId, Stream stream, CancellationToken ct = default)
    {
        var rows = _excelParser.Parse(stream);
        if (rows.Count == 0)
        {
            throw AppException.Validation("Excel 中没有可导入的数据行");
        }

        if (rows.Count > 500)
        {
            throw AppException.Validation("单次最多导入 500 行");
        }

        var me = await _merchant.GetCurrentUserAsync(ct);
        var errors = new List<OrderImportRowErrorDto>();
        var orderIds = new List<Guid>();

        foreach (var row in rows)
        {
            try
            {
                var request = MapImportRow(row, merchantId);
                var order = await BuildOrderAsync(request, me, ct);
                await TryApplyAutoAcceptAsync(order, ct);
                orderIds.Add(order.Id);
            }
            catch (AppException ex)
            {
                errors.Add(new OrderImportRowErrorDto(row.RowNumber, ex.Message));
            }
        }

        if (orderIds.Count > 0)
        {
            await _db.SaveChangesAsync(ct);
        }

        return new OrderImportResultDto(rows.Count, orderIds.Count, errors.Count, errors, orderIds);
    }

    private async Task<Order> BuildOrderAsync(OrderCreateRequest request, User customer, CancellationToken ct)
    {
        await ValidateDraftAsync(request, ct);
        var category = NormalizeCategory(request.ItemCategory);
        await ValidateServiceAreaAsync(request, ct);

        var fee = _feeCalculator.Calculate(
            request.SenderLat,
            request.SenderLng,
            request.ReceiverLat,
            request.ReceiverLng,
            request.WeightKg,
            request.IsUrgent,
            request.CouponAmount);

        var order = new Order
        {
            OrderNo = GenerateOrderNo(),
            CustomerId = customer.Id,
            MerchantId = request.MerchantId,
            Status = OrderStatus.PendingAccept,
            SenderName = request.SenderName.Trim(),
            SenderPhone = request.SenderPhone.Trim(),
            SenderAddress = request.SenderAddress.Trim(),
            SenderLat = request.SenderLat,
            SenderLng = request.SenderLng,
            ReceiverName = request.ReceiverName.Trim(),
            ReceiverPhone = request.ReceiverPhone.Trim(),
            ReceiverAddress = request.ReceiverAddress.Trim(),
            ReceiverLat = request.ReceiverLat,
            ReceiverLng = request.ReceiverLng,
            ItemCategory = category,
            ItemName = request.ItemName.Trim(),
            WeightKg = request.WeightKg,
            VolumeM3 = request.VolumeM3,
            Quantity = request.Quantity,
            IsUrgent = request.IsUrgent,
            ScheduledAt = request.ScheduledAt,
            ComplianceProofUrl = request.ComplianceProofUrl,
            Remark = request.Remark,
            DistanceKm = fee.DistanceKm,
            BaseFee = fee.BaseFee,
            DistanceFee = fee.DistanceFee,
            WeightFee = fee.WeightFee,
            AirspaceFee = fee.AirspaceFee,
            UrgentFee = fee.UrgentFee,
            DiscountAmount = fee.Discount,
            TotalAmount = fee.Total
        };

        _db.Orders.Add(order);
        AddHistory(order, null, OrderStatus.PendingAccept, customer.Id, "客户下单");
        return order;
    }

    private async Task TryApplyAutoAcceptAsync(Order order, CancellationToken ct)
    {
        var rule = await _db.AutoAcceptRules.AsNoTracking()
            .FirstOrDefaultAsync(r => r.MerchantId == order.MerchantId, ct);
        if (rule is null || !rule.Matches(order.WeightKg, order.DistanceKm))
        {
            return;
        }

        order.Status = OrderStatus.PendingDispatch;
        order.AcceptedAt = _clock.UtcNow;
        order.AcceptedBy = order.MerchantId;
        AddHistory(order, OrderStatus.PendingAccept, OrderStatus.PendingDispatch, null, "系统自动接单（规则匹配）");
    }

    public async Task<PagedResult<OrderListItemDto>> SearchAsync(OrderQuery query, CancellationToken ct = default)
    {
        var me = await _merchant.GetCurrentUserAsync(ct);
        var pageNum = Math.Max(1, query.PageNum);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);

        var q = _db.Orders.AsNoTracking();

        if (!_merchant.IsAdmin)
        {
            if (me.UserType == UserType.Pilot || _merchant.IsPilotRole)
            {
                q = q.Where(o => o.PilotId == me.Id);
            }
            else
            {
                switch (me.UserType)
                {
                    case UserType.IndividualCustomer:
                    case UserType.EnterpriseCustomer:
                        q = q.Where(o => o.CustomerId == me.Id);
                        break;
                    case UserType.MerchantStaff when !string.IsNullOrWhiteSpace(me.CompanyName):
                        var company = me.CompanyName;
                        q = q.Where(o => o.MerchantId == me.Id
                                         || _db.Users.Any(u => u.Id == o.MerchantId
                                                               && u.UserType == UserType.Merchant
                                                               && u.CompanyName == company));
                        break;
                    default:
                        q = q.Where(o => o.MerchantId == me.Id);
                        break;
                }
            }
        }

        if (query.Status is not null)
        {
            q = q.Where(o => o.Status == query.Status);
        }

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var keyword = query.Keyword.Trim();
            q = q.Where(o => o.OrderNo.Contains(keyword)
                             || o.ReceiverName.Contains(keyword)
                             || o.ReceiverPhone.Contains(keyword)
                             || o.ItemName.Contains(keyword));
        }

        if (query.CreatedFrom is not null)
        {
            q = q.Where(o => o.CreatedAt >= query.CreatedFrom);
        }

        if (query.CreatedTo is not null)
        {
            q = q.Where(o => o.CreatedAt <= query.CreatedTo);
        }

        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(o => o.CreatedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var userIds = rows.SelectMany(o => new[] { o.CustomerId, o.MerchantId }).Distinct().ToList();
        var names = await _db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName })
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName, ct);

        var items = rows.Select(o => new OrderListItemDto(
            o.Id,
            o.OrderNo,
            o.Status.ToString(),
            o.MerchantId,
            names.GetValueOrDefault(o.MerchantId),
            o.CustomerId,
            names.GetValueOrDefault(o.CustomerId),
            o.ReceiverName,
            o.ReceiverAddress,
            o.ItemName,
            o.WeightKg,
            o.IsUrgent,
            o.TotalAmount,
            o.DroneId,
            o.CreatedAt,
            o.DeliveredAt)).ToList();

        return new PagedResult<OrderListItemDto>
        {
            Items = items,
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task<OrderDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var order = await _db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == id, ct)
            ?? throw AppException.NotFound("订单不存在");

        var me = await _merchant.GetCurrentUserAsync(ct);
        await EnsureCanViewAsync(order, me, ct);
        return await MapDetailAsync(order, ct);
    }

    public async Task<OrderDto> AcceptAsync(Guid id, CancellationToken ct = default)
    {
        var order = await GetTrackedOrderAsync(id, ct);
        await EnsureMerchantOperatorAsync(order, ct);
        EnsureStatus(order, OrderStatus.PendingAccept, "仅待接单订单可接单");

        var me = await _merchant.GetCurrentUserAsync(ct);
        order.Status = OrderStatus.PendingDispatch;
        order.AcceptedAt = _clock.UtcNow;
        order.AcceptedBy = me.Id;
        AddHistory(order, OrderStatus.PendingAccept, OrderStatus.PendingDispatch, me.Id, "商家接单");

        await _db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<OrderDto> RejectAsync(Guid id, RejectOrderRequest request, CancellationToken ct = default)
    {
        var order = await GetTrackedOrderAsync(id, ct);
        await EnsureMerchantOperatorAsync(order, ct);
        EnsureStatus(order, OrderStatus.PendingAccept, "仅待接单订单可拒单");

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw AppException.Validation("拒单原因不能为空");
        }

        var me = await _merchant.GetCurrentUserAsync(ct);
        var from = order.Status;
        order.Status = OrderStatus.Cancelled;
        order.CancelReason = $"商家拒单：{request.Reason.Trim()}";
        order.CancelledAt = _clock.UtcNow;
        order.CancelledBy = me.Id;
        AddHistory(order, from, OrderStatus.Cancelled, me.Id, order.CancelReason);

        await _db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<OrderDto> CancelAsync(Guid id, CancelOrderRequest request, CancellationToken ct = default)
    {
        var order = await GetTrackedOrderAsync(id, ct);
        var me = await _merchant.GetCurrentUserAsync(ct);
        var isCustomerOwner = order.CustomerId == me.Id;

        if (!isCustomerOwner && !_merchant.IsAdmin)
        {
            throw AppException.Forbidden("仅下单客户或平台管理员可取消订单");
        }

        if (order.Status is OrderStatus.Delivered or OrderStatus.Cancelled)
        {
            throw new AppException(ErrorCodes.OrderStateInvalid, "订单已结束，无法取消");
        }

        if (_merchant.IsAdmin && !isCustomerOwner && string.IsNullOrWhiteSpace(request.Reason))
        {
            throw AppException.Validation("管理员强制终止订单需填写原因");
        }

        var from = order.Status;
        order.Status = OrderStatus.Cancelled;
        order.CancelReason = string.IsNullOrWhiteSpace(request.Reason) ? "客户取消订单" : request.Reason.Trim();
        order.CancelledAt = _clock.UtcNow;
        order.CancelledBy = me.Id;
        AddHistory(order, from, OrderStatus.Cancelled, me.Id, order.CancelReason);

        await _db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<OrderDto> DispatchAsync(Guid id, DispatchOrderRequest request, CancellationToken ct = default)
    {
        var order = await GetTrackedOrderAsync(id, ct);
        await EnsureMerchantOperatorAsync(order, ct);
        EnsureStatus(order, OrderStatus.PendingDispatch, "仅待调度订单可调度");

        var drone = await _db.Drones.FirstOrDefaultAsync(d => d.Id == request.DroneId, ct)
            ?? throw AppException.NotFound("飞行器不存在");

        if (drone.MerchantId != order.MerchantId)
        {
            throw AppException.Forbidden("飞行器不属于该商家");
        }

        if (drone.Status != DroneStatus.Idle)
        {
            throw new AppException(ErrorCodes.DroneUnavailable, "飞行器当前不可调度");
        }

        if (drone.MaxPayloadKg < order.WeightKg)
        {
            throw new AppException(
                ErrorCodes.DroneUnavailable,
                $"飞行器载重不足（订单 {order.WeightKg}kg，飞行器最大 {drone.MaxPayloadKg}kg）");
        }

        var estimatedMinutes = _feeCalculator.EstimateFlightMinutes(order.DistanceKm);
        if (drone.EnduranceMinutes < estimatedMinutes)
        {
            throw new AppException(
                ErrorCodes.DroneUnavailable,
                $"飞行器续航不足（预计需 {estimatedMinutes} 分钟，最大 {drone.EnduranceMinutes} 分钟）");
        }

        var now = _clock.UtcNow;
        var maintenancePlan = await _db.MaintenancePlans.AsNoTracking()
            .FirstOrDefaultAsync(p => p.DroneId == drone.Id && p.Enabled, ct);
        if (maintenancePlan is not null && maintenancePlan.IsOverdue(drone.CumulativeFlightMinutes, now))
        {
            throw new AppException(ErrorCodes.DroneUnavailable, "飞行器已超期未维保，请先完成维保");
        }

        if (request.PilotId is { } pilotUserId)
        {
            var pilot = await _db.CrewMembers.AsNoTracking().FirstOrDefaultAsync(
                c => c.MerchantId == order.MerchantId && c.UserId == pilotUserId && c.Status == CrewStatus.Active,
                ct);
            if (pilot is not null)
            {
                var hasExpiredQualification = await _db.CrewQualifications.AsNoTracking()
                    .AnyAsync(q => q.CrewMemberId == pilot.Id && q.ExpiresAt <= now, ct);
                if (hasExpiredQualification)
                {
                    throw new AppException(ErrorCodes.ResourceConflict, "机长存在已过期资质，禁止调度");
                }
            }
        }

        var me = await _merchant.GetCurrentUserAsync(ct);
        order.DroneId = drone.Id;
        order.PilotId = request.PilotId;
        order.DispatcherId = me.Id;
        order.DispatchedAt = _clock.UtcNow;
        order.DispatchRemark = request.Remark;
        order.PlannedRoute = request.Waypoints is { Count: > 0 }
            ? JsonSerializer.Serialize(request.Waypoints)
            : null;
        AddHistory(order, order.Status, order.Status, me.Id, $"调度飞行器 {drone.SerialNo}");

        await _db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<OrderDto> StartFlightAsync(Guid id, CancellationToken ct = default)
    {
        var order = await GetTrackedOrderAsync(id, ct);
        await EnsureCanExecuteAsync(order, ct);
        EnsureStatus(order, OrderStatus.PendingDispatch, "仅待调度订单可开始飞行");

        if (order.DroneId is null)
        {
            throw new AppException(ErrorCodes.OrderStateInvalid, "请先完成调度再开始飞行");
        }

        var drone = await _db.Drones.FirstOrDefaultAsync(d => d.Id == order.DroneId, ct)
            ?? throw AppException.NotFound("飞行器不存在");

        if (drone.Status != DroneStatus.Idle)
        {
            throw new AppException(ErrorCodes.DroneUnavailable, "飞行器当前不可用");
        }

        var me = await _merchant.GetCurrentUserAsync(ct);
        drone.Status = DroneStatus.InFlight;
        order.Status = OrderStatus.InFlight;
        order.InFlightAt = _clock.UtcNow;
        AddHistory(order, OrderStatus.PendingDispatch, OrderStatus.InFlight, me.Id, "飞行任务开始");

        await _db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<OrderDto> CompleteAsync(Guid id, CompleteOrderRequest request, CancellationToken ct = default)
    {
        var order = await GetTrackedOrderAsync(id, ct);
        await EnsureCanExecuteAsync(order, ct);
        EnsureStatus(order, OrderStatus.InFlight, "仅飞行中订单可完成");

        if (order.DroneId is not null)
        {
            var drone = await _db.Drones.FirstOrDefaultAsync(d => d.Id == order.DroneId, ct);
            if (drone is not null && drone.Status == DroneStatus.InFlight)
            {
                drone.Status = DroneStatus.Idle;
                drone.CumulativeFlightMinutes += _feeCalculator.EstimateFlightMinutes(order.DistanceKm);
            }
        }

        var me = await _merchant.GetCurrentUserAsync(ct);
        order.Status = OrderStatus.Delivered;
        order.DeliveredAt = _clock.UtcNow;
        AddHistory(order, OrderStatus.InFlight, OrderStatus.Delivered, me.Id, request.Remark ?? "订单已送达");

        await _db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    /// <summary>机长拒绝调度指派：退回待调度并清空飞行器/机长/航线。</summary>
    public async Task<OrderDto> DeclineAsync(Guid id, RejectOrderRequest request, CancellationToken ct = default)
    {
        var order = await GetTrackedOrderAsync(id, ct);
        var me = await _merchant.GetCurrentUserAsync(ct);

        if (order.PilotId != me.Id && !_merchant.IsAdmin)
        {
            throw AppException.Forbidden("仅被指派的机长可拒绝任务");
        }

        EnsureStatus(order, OrderStatus.PendingDispatch, "仅待调度订单可拒绝任务");

        if (order.PilotId is null)
        {
            throw new AppException(ErrorCodes.OrderStateInvalid, "该订单尚未指派机长");
        }

        var reason = string.IsNullOrWhiteSpace(request.Reason) ? "未填写原因" : request.Reason.Trim();
        var from = order.Status;

        order.DroneId = null;
        order.PilotId = null;
        order.DispatcherId = null;
        order.DispatchedAt = null;
        order.PlannedRoute = null;
        order.DispatchRemark = $"机长拒绝任务：{reason}";

        AddHistory(order, from, OrderStatus.PendingDispatch, me.Id, $"机长拒绝任务：{reason}");

        await _db.SaveChangesAsync(ct);
        // 指派关系已清空，不能再走 GetAsync 的可见性校验，直接映射返回
        return await MapDetailAsync(order, ct);
    }

    public async Task<OrderDto> ReviewAsync(Guid id, ReviewOrderRequest request, CancellationToken ct = default)
    {
        var order = await GetTrackedOrderAsync(id, ct);
        var me = await _merchant.GetCurrentUserAsync(ct);

        if (order.CustomerId != me.Id)
        {
            throw AppException.Forbidden("仅下单客户可评价订单");
        }

        EnsureStatus(order, OrderStatus.Delivered, "仅已送达订单可评价");

        if (order.ReviewedAt is not null)
        {
            throw new AppException(ErrorCodes.OrderStateInvalid, "该订单已评价");
        }

        if (request.Rating is < 1 or > 5)
        {
            throw AppException.Validation("评分需在 1-5 之间");
        }

        order.Rating = request.Rating;
        order.ReviewComment = request.Comment;
        order.ReviewedAt = _clock.UtcNow;

        await _db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    private async Task<Order> GetTrackedOrderAsync(Guid id, CancellationToken ct) =>
        await _db.Orders.FirstOrDefaultAsync(o => o.Id == id, ct)
        ?? throw AppException.NotFound("订单不存在");

    private async Task EnsureMerchantOperatorAsync(Order order, CancellationToken ct)
    {
        if (!await _merchant.CanOperateMerchantAsync(order.MerchantId, ct))
        {
            throw AppException.Forbidden("无权操作该订单");
        }
    }

    /// <summary>允许商家操作员或被指派的机长执行该订单（开始飞行/完成送达）。</summary>
    private async Task EnsureCanExecuteAsync(Order order, CancellationToken ct)
    {
        var me = await _merchant.GetCurrentUserAsync(ct);
        if (order.PilotId == me.Id)
        {
            return;
        }

        if (await _merchant.CanOperateMerchantAsync(order.MerchantId, ct))
        {
            return;
        }

        throw AppException.Forbidden("无权操作该订单");
    }

    private async Task EnsureCanViewAsync(Order order, User me, CancellationToken ct)
    {
        if (_merchant.IsAdmin || order.CustomerId == me.Id || order.PilotId == me.Id)
        {
            return;
        }

        if (await _merchant.CanOperateMerchantAsync(order.MerchantId, ct))
        {
            return;
        }

        throw AppException.Forbidden("无权查看该订单");
    }

    private async Task<OrderDto> MapDetailAsync(Order order, CancellationToken ct)
    {
        var ids = new[] { order.CustomerId, order.MerchantId }.Distinct().ToList();
        var names = await _db.Users.AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName })
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName, ct);

        var history = await _db.OrderStatusHistories.AsNoTracking()
            .Where(h => h.OrderId == order.Id)
            .OrderBy(h => h.CreatedAt)
            .ToListAsync(ct);

        var route = string.IsNullOrWhiteSpace(order.PlannedRoute)
            ? null
            : JsonSerializer.Deserialize<List<WaypointDto>>(order.PlannedRoute);

        return new OrderDto(
            order.Id,
            order.OrderNo,
            order.CustomerId,
            names.GetValueOrDefault(order.CustomerId),
            order.MerchantId,
            names.GetValueOrDefault(order.MerchantId),
            order.Status.ToString(),
            new SenderInfo(order.SenderName, order.SenderPhone, order.SenderAddress, order.SenderLat, order.SenderLng),
            new ReceiverInfo(order.ReceiverName, order.ReceiverPhone, order.ReceiverAddress, order.ReceiverLat, order.ReceiverLng),
            order.ItemCategory,
            order.ItemName,
            order.WeightKg,
            order.VolumeM3,
            order.Quantity,
            order.IsUrgent,
            order.ComplianceProofUrl,
            order.Remark,
            order.ScheduledAt,
            new FeeBreakdownDto(
                order.DistanceKm, order.BaseFee, order.DistanceFee, order.WeightFee,
                order.AirspaceFee, order.UrgentFee, order.DiscountAmount, order.TotalAmount),
            order.DroneId,
            order.PilotId,
            order.DispatchedAt,
            route,
            order.DispatchRemark,
            order.AcceptedAt,
            order.InFlightAt,
            order.DeliveredAt,
            order.CancelReason,
            order.CancelledAt,
            order.Rating,
            order.ReviewComment,
            order.ReviewedAt,
            order.CreatedAt,
            history.Select(h => new OrderStatusHistoryDto(
                h.FromStatus?.ToString(),
                h.ToStatus.ToString(),
                h.OperatorId,
                h.Remark,
                h.CreatedAt)).ToList(),
            order.PaymentStatus.ToString(),
            order.PaidAt);
    }

    private async Task ValidateDraftAsync(OrderCreateRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.SenderName)
            || string.IsNullOrWhiteSpace(request.SenderPhone)
            || string.IsNullOrWhiteSpace(request.SenderAddress))
        {
            throw AppException.Validation("寄件人信息不完整");
        }

        if (!PhonePattern.IsMatch(request.SenderPhone.Trim()))
        {
            throw AppException.Validation("寄件人电话格式不正确");
        }

        if (string.IsNullOrWhiteSpace(request.ReceiverName)
            || string.IsNullOrWhiteSpace(request.ReceiverPhone)
            || string.IsNullOrWhiteSpace(request.ReceiverAddress))
        {
            throw AppException.Validation("收件人信息不完整");
        }

        if (!PhonePattern.IsMatch(request.ReceiverPhone.Trim()))
        {
            throw AppException.Validation("收件人电话格式不正确");
        }

        if (request.WeightKg <= 0)
        {
            throw AppException.Validation("物品重量必须大于 0");
        }

        if (request.Quantity <= 0)
        {
            throw AppException.Validation("物品数量必须大于 0");
        }

        if (request.CouponAmount < 0)
        {
            throw AppException.Validation("优惠金额不能为负");
        }

        if (!IsValidCoordinates(request.SenderLat, request.SenderLng)
            || !IsValidCoordinates(request.ReceiverLat, request.ReceiverLng))
        {
            throw AppException.Validation("坐标不合法");
        }

        if (request.ScheduledAt is { } scheduledAt && scheduledAt < _clock.UtcNow)
        {
            throw AppException.Validation("预约时间不能早于当前时间");
        }

        var merchantExists = await _db.Users.AnyAsync(
            u => u.Id == request.MerchantId && u.UserType == UserType.Merchant && u.Status == AccountStatus.Active,
            ct);
        if (!merchantExists)
        {
            throw AppException.Validation("商家不存在或未启用");
        }
    }

    private async Task<bool> ValidateServiceAreaAsync(OrderCreateRequest request, CancellationToken ct)
    {
        var areas = await _db.ServiceAreas.AsNoTracking()
            .Where(a => a.MerchantId == request.MerchantId && a.IsActive)
            .ToListAsync(ct);

        if (areas.Count == 0)
        {
            return false;
        }

        var points = new[]
        {
            (request.SenderLat, request.SenderLng, "寄件地址"),
            (request.ReceiverLat, request.ReceiverLng, "收件地址")
        };

        foreach (var (lat, lng, label) in points)
        {
            var inside = areas.Any(a => GeoUtils.IsWithinCircle(lat, lng, a.CenterLat, a.CenterLng, a.RadiusKm));
            if (!inside)
            {
                throw new AppException(ErrorCodes.OutOfServiceArea, $"{label}超出商家服务区域");
            }
        }

        return true;
    }

    private static OrderCreateRequest MapImportRow(OrderImportRow row, Guid merchantId) => new(
        merchantId,
        row.SenderName.Trim(),
        row.SenderPhone.Trim(),
        row.SenderAddress.Trim(),
        ParseCoordinate(row.SenderLat, "寄件纬度"),
        ParseCoordinate(row.SenderLng, "寄件经度"),
        row.ReceiverName.Trim(),
        row.ReceiverPhone.Trim(),
        row.ReceiverAddress.Trim(),
        ParseCoordinate(row.ReceiverLat, "收件纬度"),
        ParseCoordinate(row.ReceiverLng, "收件经度"),
        row.ItemCategory.Trim(),
        row.ItemName.Trim(),
        ParseDecimal(row.WeightKg, "重量", required: true),
        ParseDecimal(row.VolumeM3, "体积", required: false),
        (int)ParseDecimal(row.Quantity, "数量", required: false, defaultValue: 1m),
        ParseBool(row.IsUrgent),
        ParseScheduledAt(row.ScheduledAt),
        ParseDecimal(row.CouponAmount, "优惠金额", required: false),
        null,
        string.IsNullOrWhiteSpace(row.Remark) ? null : row.Remark.Trim());

    private static decimal ParseDecimal(string raw, string field, bool required, decimal defaultValue = 0m)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            if (required)
            {
                throw AppException.Validation($"{field}不能为空");
            }

            return defaultValue;
        }

        if (!decimal.TryParse(raw.Trim(), NumberStyles.Number, CultureInfo.InvariantCulture, out var value))
        {
            throw AppException.Validation($"{field}格式不正确");
        }

        return value;
    }

    private static double ParseCoordinate(string raw, string field)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            throw AppException.Validation($"{field}不能为空");
        }

        if (!double.TryParse(raw.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var value))
        {
            throw AppException.Validation($"{field}格式不正确");
        }

        return value;
    }

    private static bool ParseBool(string raw) =>
        !string.IsNullOrWhiteSpace(raw)
        && raw.Trim() is "是" or "true" or "TRUE" or "True" or "1" or "Y" or "y";

    private static DateTimeOffset? ParseScheduledAt(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        if (!DateTimeOffset.TryParse(raw.Trim(), CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var value))
        {
            throw AppException.Validation("预约时间格式不正确（示例：2026-10-01 10:00）");
        }

        return value.ToUniversalTime();
    }

    private static string NormalizeCategory(string raw)
    {
        if (!ItemCategoryCatalog.TryResolve(raw, out var code))
        {
            throw AppException.Validation("物品类型不存在");
        }

        if (ItemCategoryCatalog.IsProhibited(code))
        {
            throw new AppException(ErrorCodes.ProhibitedItem, "禁运品不可承运");
        }

        return code;
    }

    private void AddHistory(Order order, OrderStatus? from, OrderStatus to, Guid? operatorId, string? remark)
    {
        _db.OrderStatusHistories.Add(new OrderStatusHistory
        {
            OrderId = order.Id,
            FromStatus = from,
            ToStatus = to,
            OperatorId = operatorId,
            Remark = remark
        });
    }

    private static void EnsureStatus(Order order, OrderStatus expected, string message)
    {
        if (order.Status != expected)
        {
            throw new AppException(ErrorCodes.OrderStateInvalid, message);
        }
    }

    private static bool IsValidCoordinates(double lat, double lng) =>
        lat is >= -90 and <= 90
        && lng is >= -180 and <= 180
        && !(lat == 0 && lng == 0);

    private static FeeBreakdownDto ToFeeDto(FeeCalculation fee) => new(
        fee.DistanceKm,
        fee.BaseFee,
        fee.DistanceFee,
        fee.WeightFee,
        fee.AirspaceFee,
        fee.UrgentFee,
        fee.Discount,
        fee.Total);

    private static string GenerateOrderNo()
    {
        var date = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(8)).ToString("yyyyMMdd");
        return $"DBH{date}{Guid.NewGuid():N}"[..22].ToUpperInvariant();
    }
}
