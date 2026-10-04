using Dubhe.Domain.Common;

namespace Dubhe.Domain.Resource;

public enum CrewRole
{
    Pilot = 1,
    Maintenance = 2
}

public enum CrewStatus
{
    Active = 1,
    Suspended = 2,
    Departed = 3
}

public class CrewMember : BaseEntity
{
    public Guid MerchantId { get; set; }
    public Guid? UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Gender { get; set; }
    public string Phone { get; set; } = string.Empty;
    public CrewRole Role { get; set; }
    public string? Region { get; set; }
    public CrewStatus Status { get; set; } = CrewStatus.Active;
}

public class CrewQualification : BaseEntity
{
    public Guid CrewMemberId { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Number { get; set; } = string.Empty;
    public DateTimeOffset IssuedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public string? FileUrl { get; set; }
}

public class CrewSchedule : BaseEntity
{
    public Guid CrewMemberId { get; set; }
    public Guid MerchantId { get; set; }
    public DateTimeOffset StartAt { get; set; }
    public DateTimeOffset EndAt { get; set; }
    public string? Area { get; set; }
    public Guid? DroneId { get; set; }
    public string? Remark { get; set; }
}

public enum AttendanceStatus
{
    Normal = 1,
    Late = 2,
    EarlyLeave = 3,
    Leave = 4,
    Absent = 5
}

public class CrewAttendance : BaseEntity
{
    public Guid CrewMemberId { get; set; }
    public Guid MerchantId { get; set; }
    public DateOnly Date { get; set; }
    public AttendanceStatus Status { get; set; } = AttendanceStatus.Normal;
    public string? Remark { get; set; }
}
