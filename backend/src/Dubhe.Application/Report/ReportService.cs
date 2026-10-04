using Dubhe.Application.Abstractions;
using Dubhe.Application.Common;
using Dubhe.Application.Report.Dtos;
using Dubhe.Domain.Airspace;
using Dubhe.Domain.Auth;
using Dubhe.Domain.Common;
using Dubhe.Domain.Order;
using Dubhe.Domain.Report;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Report;

public interface IReportService
{
    Task<AdminDashboardDto> GetAdminDashboardAsync(CancellationToken ct = default);
    Task<MerchantDashboardDto> GetMerchantDashboardAsync(Guid? merchantId, CancellationToken ct = default);
    Task<AirTrafficDashboardDto> GetAirTrafficDashboardAsync(CancellationToken ct = default);
    IReadOnlyList<ReportFieldDefDto> GetFields(string businessType);
    Task<ReportRunResultDto> RunAsync(ReportRunRequest request, CancellationToken ct = default);
}

public sealed class ReportService : IReportService
{
    private const int MaxRows = 5000;
    private const int TrendDays = 7;
    private const int AirspaceWindowDays = 30;

    private readonly IAppDbContext _db;
    private readonly MerchantContext _merchant;
    private readonly IDateTime _clock;

    public ReportService(IAppDbContext db, MerchantContext merchant, IDateTime clock)
    {
        _db = db;
        _merchant = merchant;
        _clock = clock;
    }

    public async Task<AdminDashboardDto> GetAdminDashboardAsync(CancellationToken ct = default)
    {
        var me = await _merchant.GetCurrentUserAsync(ct);
        if (!_merchant.IsAdmin)
        {
            throw AppException.Forbidden("仅平台管理员可查看全局看板");
        }

        var now = _clock.UtcNow;
        var todayStart = new DateTimeOffset(now.UtcDateTime.Date, TimeSpan.Zero);
        var windowStart = now.AddDays(-AirspaceWindowDays);
        var trendStart = now.AddDays(-(TrendDays - 1));

        var totalOrders = await _db.Orders.CountAsync(ct);
        var todayOrders = await _db.Orders.CountAsync(o => o.CreatedAt >= todayStart, ct);
        var totalRevenue = await _db.Orders
            .Where(o => o.PaymentStatus == OrderPaymentStatus.Paid)
            .SumAsync(o => (decimal?)o.TotalAmount, ct) ?? 0m;

        var activeMerchants = await _db.Users.CountAsync(
            u => u.UserType == UserType.Merchant && u.Status == AccountStatus.Active, ct);

        var activeCustomers = await _db.Orders
            .Where(o => o.CreatedAt >= windowStart)
            .Select(o => o.CustomerId)
            .Distinct()
            .CountAsync(ct);

        var approvedPlans = await _db.FlightPlans.AsNoTracking()
            .Where(p => (p.Status == FlightPlanStatus.Approved || p.Status == FlightPlanStatus.Completed)
                        && p.StartAt >= windowStart)
            .Select(p => new { p.StartAt, p.EndAt })
            .ToListAsync(ct);

        var totalPlanHours = approvedPlans.Sum(p => (p.EndAt - p.StartAt).TotalHours);
        var airspaceUtilization = Math.Min(1d, totalPlanHours / (AirspaceWindowDays * 24d));

        var violations30 = await _db.ViolationRecords.CountAsync(v => v.OccurredAt >= windowStart, ct);
        var orders30 = await _db.Orders.CountAsync(o => o.CreatedAt >= windowStart, ct);
        var violationRate = orders30 == 0 ? 0d : (double)violations30 / orders30;

        var openViolations = await _db.ViolationRecords.AsNoTracking()
            .Where(v => v.Status != ViolationStatus.Resolved)
            .OrderByDescending(v => v.OccurredAt)
            .Take(10)
            .ToListAsync(ct);

        var alerts = openViolations.Select(v => new AlertItemDto(
            v.Type.ToString(),
            v.Type == ViolationType.NoFlyIntrusion ? "Critical" : v.Type == ViolationType.RouteDeviation ? "Serious" : "Normal",
            v.Description,
            v.OccurredAt)).ToList();

        var orderDates = await _db.Orders.AsNoTracking()
            .Where(o => o.CreatedAt >= trendStart)
            .Select(o => o.CreatedAt)
            .ToListAsync(ct);

        var violationDates = await _db.ViolationRecords.AsNoTracking()
            .Where(v => v.OccurredAt >= trendStart)
            .Select(v => v.OccurredAt)
            .ToListAsync(ct);

        return new AdminDashboardDto(
            totalOrders,
            todayOrders,
            totalRevenue,
            activeMerchants,
            activeCustomers,
            Math.Round(airspaceUtilization, 4),
            Math.Round(violationRate, 4),
            alerts,
            BuildTrend(orderDates, now),
            BuildTrend(violationDates, now));
    }

    public async Task<MerchantDashboardDto> GetMerchantDashboardAsync(
        Guid? merchantId,
        CancellationToken ct = default)
    {
        var effectiveMerchantId = await _merchant.ResolveMerchantIdAsync(merchantId, ct);
        var now = _clock.UtcNow;
        var windowStart = now.AddDays(-AirspaceWindowDays);
        var trendStart = now.AddDays(-(TrendDays - 1));

        var orders = await _db.Orders.AsNoTracking()
            .Where(o => o.MerchantId == effectiveMerchantId)
            .Select(o => new { o.Status, o.PaymentStatus, o.TotalAmount, o.CreatedAt, o.DeliveredAt })
            .ToListAsync(ct);

        var created = orders.Count;
        var delivered = orders.Where(o => o.Status == OrderStatus.Delivered).ToList();
        var completionRate = created == 0 ? 0d : (double)delivered.Count / created;
        var paidRevenue = orders.Where(o => o.PaymentStatus == OrderPaymentStatus.Paid).Sum(o => o.TotalAmount);

        var droneTotal = await _db.Drones.CountAsync(d => d.MerchantId == effectiveMerchantId, ct);
        var usedDrones = await _db.Orders.AsNoTracking()
            .Where(o => o.MerchantId == effectiveMerchantId && o.DroneId != null && o.CreatedAt >= windowStart)
            .Select(o => o.DroneId)
            .Distinct()
            .CountAsync(ct);
        var droneUtilization = droneTotal == 0 ? 0d : Math.Min(1d, (double)usedDrones / droneTotal);

        var bucketCounts = ReportBuckets.DeliveryBuckets.ToDictionary(b => b, _ => 0);
        foreach (var order in delivered.Where(o => o.DeliveredAt is not null))
        {
            var bucket = ReportBuckets.DeliveryDurationBucket(order.DeliveredAt!.Value - order.CreatedAt);
            bucketCounts[bucket]++;
        }

        var revenueDates = orders
            .Where(o => o.PaymentStatus == OrderPaymentStatus.Paid && o.CreatedAt >= trendStart)
            .Select(o => o.CreatedAt)
            .ToList();

        var revenueTrend = BuildTrend(revenueDates, now);

        return new MerchantDashboardDto(
            delivered.Count,
            created,
            paidRevenue,
            Math.Round(completionRate, 4),
            Math.Round(droneUtilization, 4),
            bucketCounts.Select(kv => new DistributionItemDto(kv.Key, kv.Value)).ToList(),
            revenueTrend);
    }

    public async Task<AirTrafficDashboardDto> GetAirTrafficDashboardAsync(CancellationToken ct = default)
    {
        var me = await _merchant.GetCurrentUserAsync(ct);
        if (!_merchant.IsAdmin && me.UserType != UserType.AirTrafficController)
        {
            throw AppException.Forbidden("仅空管监管人员或平台管理员可查看空管看板");
        }

        var totalPlans = await _db.FlightPlans.CountAsync(ct);
        var approvedPlans = await _db.FlightPlans.CountAsync(
            p => p.Status == FlightPlanStatus.Approved || p.Status == FlightPlanStatus.Completed, ct);
        var conflictPlans = await _db.FlightPlans.CountAsync(
            p => p.CheckResult != null && p.CheckResult != "[]", ct);
        var approvalRate = totalPlans == 0 ? 0d : (double)approvedPlans / totalPlans;
        var conflictRate = totalPlans == 0 ? 0d : (double)conflictPlans / totalPlans;

        var violationsByType = await _db.ViolationRecords.AsNoTracking()
            .GroupBy(v => v.Type)
            .Select(g => new { Type = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var densityPlans = await _db.FlightPlans.AsNoTracking()
            .Where(p => p.Status == FlightPlanStatus.Approved || p.Status == FlightPlanStatus.Completed)
            .OrderByDescending(p => p.ApprovedAt)
            .Take(200)
            .Select(p => p.Waypoints)
            .ToListAsync(ct);

        var density = new Dictionary<(int, int), int>();
        foreach (var json in densityPlans)
        {
            var first = ParseFirstWaypoint(json);
            if (first is null)
            {
                continue;
            }

            var key = ((int)Math.Floor(first.Value.Lat * 100), (int)Math.Floor(first.Value.Lng * 100));
            density[key] = density.GetValueOrDefault(key) + 1;
        }

        var cells = density
            .OrderByDescending(kv => kv.Value)
            .Take(20)
            .Select(kv => new DensityCellDto(kv.Key.Item1 / 100.0, kv.Key.Item2 / 100.0, kv.Value))
            .ToList();

        return new AirTrafficDashboardDto(
            totalPlans,
            approvedPlans,
            Math.Round(approvalRate, 4),
            conflictPlans,
            Math.Round(conflictRate, 4),
            violationsByType.Select(v => new DistributionItemDto(v.Type.ToString(), v.Count)).ToList(),
            cells);
    }

    public IReadOnlyList<ReportFieldDefDto> GetFields(string businessType) =>
        ReportFieldCatalog.For(businessType);

    public async Task<ReportRunResultDto> RunAsync(ReportRunRequest request, CancellationToken ct = default)
    {
        if (!string.Equals(request.BusinessType, "order", StringComparison.OrdinalIgnoreCase))
        {
            throw AppException.Validation("当前仅支持 order（订单）业务维度");
        }

        var catalog = ReportFieldCatalog.For("order");
        var requestedFields = request.Fields is { Count: > 0 }
            ? request.Fields.Distinct().ToList()
            : ReportFieldCatalog.DefaultFieldKeys.ToList();

        var columns = requestedFields
            .Select(key => catalog.FirstOrDefault(f => f.Key == key))
            .Where(f => f is not null)
            .Select(f => f!)
            .ToList();

        if (columns.Count == 0)
        {
            throw AppException.Validation("未选择有效的报表字段");
        }

        var me = await _merchant.GetCurrentUserAsync(ct);
        var q = _db.Orders.AsNoTracking();
        Guid? merchantScope = null;
        if (!_merchant.IsAdmin)
        {
            if (me.UserType is UserType.IndividualCustomer or UserType.EnterpriseCustomer)
            {
                throw AppException.Forbidden("当前角色无报表权限");
            }

            merchantScope = await _merchant.ResolveMerchantIdAsync(null, ct);
            q = q.Where(o => o.MerchantId == merchantScope);
        }

        if (request.Filters.From is { } from)
        {
            q = q.Where(o => o.CreatedAt >= from);
        }

        if (request.Filters.To is { } to)
        {
            q = q.Where(o => o.CreatedAt <= to);
        }

        if (!string.IsNullOrWhiteSpace(request.Filters.Status) &&
            Enum.TryParse<OrderStatus>(request.Filters.Status, true, out var status))
        {
            q = q.Where(o => o.Status == status);
        }

        var total = await q.LongCountAsync(ct);
        var orders = await q.OrderByDescending(o => o.CreatedAt).Take(MaxRows).ToListAsync(ct);

        var userIds = orders.SelectMany(o => new[] { o.CustomerId, o.MerchantId }).Distinct().ToList();
        var names = await _db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName })
            .ToDictionaryAsync(u => u.Id, u => u.DisplayName, ct);

        var rowDicts = orders.Select(o => BuildRow(o, names)).ToList();
        var projected = rowDicts
            .Select(row => (IReadOnlyDictionary<string, object?>)requestedFields
                .Where(key => catalog.Any(f => f.Key == key))
                .ToDictionary(key => key, key => row.GetValueOrDefault(key)))
            .ToList();

        return new ReportRunResultDto(
            "order",
            columns,
            projected,
            (int)total,
            orders.Sum(o => o.TotalAmount));
    }

    private static Dictionary<string, object?> BuildRow(
        Order order,
        IReadOnlyDictionary<Guid, string> names) => new()
    {
        ["orderNo"] = order.OrderNo,
        ["status"] = order.Status.ToString(),
        ["merchantName"] = names.GetValueOrDefault(order.MerchantId),
        ["customerName"] = names.GetValueOrDefault(order.CustomerId),
        ["itemName"] = order.ItemName,
        ["weightKg"] = order.WeightKg,
        ["quantity"] = order.Quantity,
        ["isUrgent"] = order.IsUrgent,
        ["totalAmount"] = order.TotalAmount,
        ["paymentStatus"] = order.PaymentStatus.ToString(),
        ["receiverName"] = order.ReceiverName,
        ["receiverAddress"] = order.ReceiverAddress,
        ["createdAt"] = order.CreatedAt.LocalDateTime.ToString("yyyy-MM-dd HH:mm"),
        ["deliveredAt"] = order.DeliveredAt?.LocalDateTime.ToString("yyyy-MM-dd HH:mm")
    };

    private static List<TrendPointDto> BuildTrend(IEnumerable<DateTimeOffset> dates, DateTimeOffset now)
    {
        var start = now.UtcDateTime.Date.AddDays(-(TrendDays - 1));
        var buckets = Enumerable.Range(0, TrendDays)
            .ToDictionary(i => start.AddDays(i), _ => 0);

        foreach (var date in dates)
        {
            var day = date.UtcDateTime.Date;
            if (buckets.ContainsKey(day))
            {
                buckets[day]++;
            }
        }

        return buckets.Select(kv => new TrendPointDto(kv.Key.ToString("yyyy-MM-dd"), kv.Value)).ToList();
    }

    private static (double Lat, double Lng)? ParseFirstWaypoint(string json)
    {
        try
        {
            using var document = System.Text.Json.JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != System.Text.Json.JsonValueKind.Array ||
                document.RootElement.GetArrayLength() == 0)
            {
                return null;
            }

            var first = document.RootElement[0];
            var lat = first.TryGetProperty("lat", out var latElement) ? latElement.GetDouble()
                : first.TryGetProperty("Lat", out var latElement2) ? latElement2.GetDouble() : double.NaN;
            var lng = first.TryGetProperty("lng", out var lngElement) ? lngElement.GetDouble()
                : first.TryGetProperty("Lng", out var lngElement2) ? lngElement2.GetDouble() : double.NaN;

            return double.IsNaN(lat) || double.IsNaN(lng) ? null : (lat, lng);
        }
        catch
        {
            return null;
        }
    }
}
