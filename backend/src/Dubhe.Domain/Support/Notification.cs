using Dubhe.Domain.Common;

namespace Dubhe.Domain.Support;

public enum NotificationType
{
    System = 0,
    QualificationExpiry = 1,
    MaintenanceDue = 2,
    OrderStatus = 3,
    Alert = 4,
    FlightPlanApproved = 5,
    FlightPlanRejected = 6,
    Violation = 7,
    TicketUpdated = 8,
    EmergencyAlert = 9
}

public class Notification : BaseEntity
{
    public Guid UserId { get; set; }
    public NotificationType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public Guid? RelatedId { get; set; }
    public string? DedupeKey { get; set; }
    public bool IsRead { get; set; }
    public DateTimeOffset? ReadAt { get; set; }
}
