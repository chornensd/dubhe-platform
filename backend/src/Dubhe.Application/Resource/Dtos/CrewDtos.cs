using Dubhe.Domain.Resource;

namespace Dubhe.Application.Resource.Dtos;

public sealed record CreateCrewRequest(
    Guid? MerchantId,
    Guid? UserId,
    string Name,
    string? Gender,
    string Phone,
    int Role,
    string? Region);

public sealed record UpdateCrewRequest(
    string? Name,
    string? Gender,
    string? Phone,
    int? Role,
    string? Region,
    int? Status);

public sealed class CrewQuery
{
    public int PageNum { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? Keyword { get; init; }
    public CrewRole? Role { get; init; }
    public CrewStatus? Status { get; init; }
    public Guid? MerchantId { get; init; }
}

public sealed record QualificationDto(
    Guid Id,
    string Type,
    string Number,
    DateTimeOffset IssuedAt,
    DateTimeOffset ExpiresAt,
    bool IsExpired,
    string? FileUrl);

public sealed record CrewDto(
    Guid Id,
    Guid MerchantId,
    Guid? UserId,
    string Name,
    string? Gender,
    string Phone,
    string Role,
    string? Region,
    string Status,
    int QualificationCount,
    DateTimeOffset CreatedAt,
    IReadOnlyList<QualificationDto>? Qualifications);

public sealed record AddQualificationRequest(
    string Type,
    string Number,
    DateTimeOffset IssuedAt,
    DateTimeOffset ExpiresAt,
    string? FileUrl);

public sealed record CreateScheduleRequest(
    DateTimeOffset StartAt,
    DateTimeOffset EndAt,
    string? Area,
    Guid? DroneId,
    string? Remark);

public sealed record ScheduleDto(
    Guid Id,
    Guid CrewMemberId,
    DateTimeOffset StartAt,
    DateTimeOffset EndAt,
    string? Area,
    Guid? DroneId,
    string? Remark);

public sealed record RecordAttendanceRequest(DateOnly Date, int Status, string? Remark);

public sealed record AttendanceDto(
    Guid Id,
    Guid CrewMemberId,
    DateOnly Date,
    string Status,
    string? Remark);
