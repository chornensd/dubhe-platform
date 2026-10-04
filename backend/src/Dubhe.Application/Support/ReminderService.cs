using Dubhe.Application.Abstractions;
using Dubhe.Domain.Support;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Support;

public sealed record ReminderRunResultDto(int QualificationReminders, int MaintenanceReminders);

public interface IReminderService
{
    Task<ReminderRunResultDto> RunAsync(CancellationToken ct = default);
}

public sealed class ReminderService : IReminderService
{
    private const int QualificationWindowDays = 15;
    private const int MaintenanceWindowDays = 7;
    private const int RemainingFlightMinutes = 60;

    private readonly IAppDbContext _db;
    private readonly IDateTime _clock;

    public ReminderService(IAppDbContext db, IDateTime clock)
    {
        _db = db;
        _clock = clock;
    }

    public async Task<ReminderRunResultDto> RunAsync(CancellationToken ct = default)
    {
        var now = _clock.UtcNow;
        var dayKey = now.UtcDateTime.ToString("yyyyMMdd");
        var qualificationCount = await CreateQualificationRemindersAsync(now, dayKey, ct);
        var maintenanceCount = await CreateMaintenanceRemindersAsync(now, dayKey, ct);

        if (qualificationCount + maintenanceCount > 0)
        {
            await _db.SaveChangesAsync(ct);
        }

        return new ReminderRunResultDto(qualificationCount, maintenanceCount);
    }

    private async Task<int> CreateQualificationRemindersAsync(
        DateTimeOffset now,
        string dayKey,
        CancellationToken ct)
    {
        var windowEnd = now.AddDays(QualificationWindowDays);
        var expiring = await _db.CrewQualifications.AsNoTracking()
            .Where(q => q.ExpiresAt >= now && q.ExpiresAt <= windowEnd)
            .ToListAsync(ct);

        if (expiring.Count == 0)
        {
            return 0;
        }

        var crewIds = expiring.Select(q => q.CrewMemberId).Distinct().ToList();
        var crewMap = await _db.CrewMembers.AsNoTracking()
            .Where(c => crewIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, ct);

        var created = 0;
        foreach (var qualification in expiring)
        {
            if (!crewMap.TryGetValue(qualification.CrewMemberId, out var crew))
            {
                continue;
            }

            var dedupeKey = $"qual:{qualification.Id}:{dayKey}";
            if (await _db.Notifications.AnyAsync(n => n.DedupeKey == dedupeKey, ct))
            {
                continue;
            }

            _db.Notifications.Add(new Notification
            {
                UserId = crew.MerchantId,
                Type = NotificationType.QualificationExpiry,
                Title = "资质到期提醒",
                Content = $"{crew.Name} 的 {qualification.Type}（{qualification.Number}）将于 {qualification.ExpiresAt.LocalDateTime:yyyy-MM-dd} 到期",
                RelatedId = qualification.Id,
                DedupeKey = dedupeKey
            });
            created++;
        }

        return created;
    }

    private async Task<int> CreateMaintenanceRemindersAsync(
        DateTimeOffset now,
        string dayKey,
        CancellationToken ct)
    {
        var plans = await _db.MaintenancePlans.AsNoTracking()
            .Where(p => p.Enabled)
            .ToListAsync(ct);

        if (plans.Count == 0)
        {
            return 0;
        }

        var droneIds = plans.Select(p => p.DroneId).Distinct().ToList();
        var droneMap = await _db.Drones.AsNoTracking()
            .Where(d => droneIds.Contains(d.Id))
            .ToDictionaryAsync(d => d.Id, ct);

        var created = 0;
        foreach (var plan in plans)
        {
            if (!droneMap.TryGetValue(plan.DroneId, out var drone))
            {
                continue;
            }

            if (!plan.IsDueSoon(drone.CumulativeFlightMinutes, now, TimeSpan.FromDays(MaintenanceWindowDays), RemainingFlightMinutes))
            {
                continue;
            }

            var dedupeKey = $"maint:{plan.Id}:{dayKey}";
            if (await _db.Notifications.AnyAsync(n => n.DedupeKey == dedupeKey, ct))
            {
                continue;
            }

            var overdue = plan.IsOverdue(drone.CumulativeFlightMinutes, now);
            _db.Notifications.Add(new Notification
            {
                UserId = drone.MerchantId,
                Type = NotificationType.MaintenanceDue,
                Title = "维保到期提醒",
                Content = overdue
                    ? $"飞行器 {drone.SerialNo} 已超期未维保，请尽快处理"
                    : $"飞行器 {drone.SerialNo} 即将到期维保，请安排计划",
                RelatedId = plan.Id,
                DedupeKey = dedupeKey
            });
            created++;
        }

        return created;
    }
}
