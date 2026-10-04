using Dubhe.Domain.Common;

namespace Dubhe.Domain.Support;

public enum EmergencyAlertLevel
{
    Normal = 1,
    Serious = 2,
    Critical = 3
}

public enum EmergencyAlertStatus
{
    Open = 1,
    Handling = 2,
    Resolved = 3,
    Closed = 4
}

public class EmergencyAlert : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public EmergencyAlertLevel Level { get; set; } = EmergencyAlertLevel.Normal;
    public EmergencyAlertStatus Status { get; set; } = EmergencyAlertStatus.Open;
    public string Source { get; set; } = "Manual";
    public Guid? RelatedId { get; set; }
    public Guid? MerchantId { get; set; }
    public Guid ReportedBy { get; set; }
    public DateTimeOffset ReportedAt { get; set; }
    public string? Handlers { get; set; }
    public string? DisposalPlan { get; set; }
    public DateTimeOffset? DeadlineAt { get; set; }
    public string? Result { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }
}

public class EmergencyTimelineEntry : BaseEntity
{
    public Guid AlertId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string? Note { get; set; }
    public string? Attachments { get; set; }
    public Guid OperatorId { get; set; }
}

public enum TicketType
{
    Complaint = 1,
    Consult = 2,
    Advice = 3
}

public enum TicketStatus
{
    Pending = 1,
    Processing = 2,
    Completed = 3,
    Closed = 4
}

public class ServiceTicket : BaseEntity
{
    public string TicketNo { get; set; } = string.Empty;
    public TicketType Type { get; set; }
    public TicketStatus Status { get; set; } = TicketStatus.Pending;
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? Attachments { get; set; }
    public Guid SubmitterUserId { get; set; }
    public Guid? MerchantId { get; set; }
    public Guid? OrderId { get; set; }
    public Guid? AssigneeUserId { get; set; }
    public DateTimeOffset? AssignedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }
    public int? SatisfactionRating { get; set; }
    public string? SatisfactionComment { get; set; }

    public ICollection<TicketReply> Replies { get; set; } = new List<TicketReply>();
}

public class TicketReply : BaseEntity
{
    public Guid TicketId { get; set; }
    public Guid UserId { get; set; }
    public string Content { get; set; } = string.Empty;
    public bool IsStaff { get; set; }
}

public class CannedResponse : BaseEntity
{
    public Guid OwnerUserId { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? Category { get; set; }
}

public enum HelpContentType
{
    Article = 1,
    Video = 2
}

public class HelpArticle : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Tags { get; set; } = string.Empty;
    public HelpContentType ContentType { get; set; } = HelpContentType.Article;
    public string? VideoUrl { get; set; }
    public string Content { get; set; } = string.Empty;
    public bool IsPublished { get; set; } = true;
    public int ViewCount { get; set; }
    public Guid CreatedBy { get; set; }
}
