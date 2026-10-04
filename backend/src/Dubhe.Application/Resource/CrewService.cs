using Dubhe.Application.Abstractions;
using Dubhe.Application.Common;
using Dubhe.Application.Resource.Dtos;
using Dubhe.Domain.Common;
using Dubhe.Domain.Resource;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Resource;

public interface ICrewService
{
    Task<CrewDto> CreateAsync(CreateCrewRequest request, CancellationToken ct = default);
    Task<CrewDto> UpdateAsync(Guid id, UpdateCrewRequest request, CancellationToken ct = default);
    Task<PagedResult<CrewDto>> SearchAsync(CrewQuery query, CancellationToken ct = default);
    Task<CrewDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<QualificationDto> AddQualificationAsync(Guid crewId, AddQualificationRequest request, CancellationToken ct = default);
    Task<QualificationDto> UpdateQualificationAsync(Guid crewId, Guid qualificationId, AddQualificationRequest request, CancellationToken ct = default);
    Task<ScheduleDto> CreateScheduleAsync(Guid crewId, CreateScheduleRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<ScheduleDto>> ListSchedulesAsync(Guid crewId, DateTimeOffset? from, DateTimeOffset? to, CancellationToken ct = default);
    Task<AttendanceDto> RecordAttendanceAsync(Guid crewId, RecordAttendanceRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<AttendanceDto>> ListAttendancesAsync(Guid crewId, DateOnly? from, DateOnly? to, CancellationToken ct = default);
}

public sealed class CrewService : ICrewService
{
    private readonly IAppDbContext _db;
    private readonly MerchantContext _merchant;
    private readonly IDateTime _clock;

    public CrewService(IAppDbContext db, MerchantContext merchant, IDateTime clock)
    {
        _db = db;
        _merchant = merchant;
        _clock = clock;
    }

    public async Task<CrewDto> CreateAsync(CreateCrewRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw AppException.Validation("人员姓名不能为空");
        }

        if (string.IsNullOrWhiteSpace(request.Phone))
        {
            throw AppException.Validation("联系电话不能为空");
        }

        if (!Enum.IsDefined(typeof(CrewRole), request.Role))
        {
            throw AppException.Validation("人员角色不合法");
        }

        var merchantId = await _merchant.ResolveMerchantIdAsync(request.MerchantId, ct);

        if (request.UserId is not null && !await _db.Users.AnyAsync(u => u.Id == request.UserId, ct))
        {
            throw AppException.Validation("关联账号不存在");
        }

        var crew = new CrewMember
        {
            MerchantId = merchantId,
            UserId = request.UserId,
            Name = request.Name.Trim(),
            Gender = request.Gender,
            Phone = request.Phone.Trim(),
            Role = (CrewRole)request.Role,
            Region = request.Region,
            Status = CrewStatus.Active
        };

        _db.CrewMembers.Add(crew);
        await _db.SaveChangesAsync(ct);
        return Map(crew, 0, null);
    }

    public async Task<CrewDto> UpdateAsync(Guid id, UpdateCrewRequest request, CancellationToken ct = default)
    {
        var crew = await _db.CrewMembers.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw AppException.NotFound("人员不存在");

        await EnsureOperatorAsync(crew.MerchantId, ct);

        if (!string.IsNullOrWhiteSpace(request.Name))
        {
            crew.Name = request.Name.Trim();
        }

        if (request.Gender is not null)
        {
            crew.Gender = string.IsNullOrWhiteSpace(request.Gender) ? null : request.Gender.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Phone))
        {
            crew.Phone = request.Phone.Trim();
        }

        if (request.Role is not null)
        {
            if (!Enum.IsDefined(typeof(CrewRole), request.Role.Value))
            {
                throw AppException.Validation("人员角色不合法");
            }

            crew.Role = (CrewRole)request.Role.Value;
        }

        if (request.Region is not null)
        {
            crew.Region = string.IsNullOrWhiteSpace(request.Region) ? null : request.Region.Trim();
        }

        if (request.Status is not null)
        {
            if (!Enum.IsDefined(typeof(CrewStatus), request.Status.Value))
            {
                throw AppException.Validation("人员状态不合法");
            }

            crew.Status = (CrewStatus)request.Status.Value;
        }

        await _db.SaveChangesAsync(ct);
        var count = await _db.CrewQualifications.CountAsync(q => q.CrewMemberId == crew.Id, ct);
        return Map(crew, count, null);
    }

    public async Task<PagedResult<CrewDto>> SearchAsync(CrewQuery query, CancellationToken ct = default)
    {
        var pageNum = Math.Max(1, query.PageNum);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var q = _db.CrewMembers.AsNoTracking();

        if (_merchant.IsAdmin)
        {
            if (query.MerchantId is not null)
            {
                q = q.Where(c => c.MerchantId == query.MerchantId);
            }
        }
        else
        {
            var merchantId = await _merchant.ResolveMerchantIdAsync(query.MerchantId, ct);
            q = q.Where(c => c.MerchantId == merchantId);
        }

        if (query.Role is not null)
        {
            q = q.Where(c => c.Role == query.Role);
        }

        if (query.Status is not null)
        {
            q = q.Where(c => c.Status == query.Status);
        }

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var keyword = query.Keyword.Trim();
            q = q.Where(c => c.Name.Contains(keyword) || c.Phone.Contains(keyword));
        }

        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(c => c.CreatedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var ids = rows.Select(c => c.Id).ToList();
        var counts = await _db.CrewQualifications.AsNoTracking()
            .Where(x => ids.Contains(x.CrewMemberId))
            .GroupBy(x => x.CrewMemberId)
            .Select(g => new { CrewMemberId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CrewMemberId, x => x.Count, ct);

        return new PagedResult<CrewDto>
        {
            Items = rows.Select(c => Map(c, counts.GetValueOrDefault(c.Id), null)).ToList(),
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task<CrewDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var crew = await _db.CrewMembers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw AppException.NotFound("人员不存在");

        if (!_merchant.IsAdmin && !await _merchant.CanOperateMerchantAsync(crew.MerchantId, ct))
        {
            throw AppException.Forbidden("无权查看该人员");
        }

        var qualifications = await _db.CrewQualifications.AsNoTracking()
            .Where(q => q.CrewMemberId == id)
            .OrderByDescending(q => q.ExpiresAt)
            .ToListAsync(ct);

        return Map(crew, qualifications.Count, qualifications.Select(Map).ToList());
    }

    public async Task<QualificationDto> AddQualificationAsync(
        Guid crewId,
        AddQualificationRequest request,
        CancellationToken ct = default)
    {
        var crew = await GetTrackedCrewAsync(crewId, ct);
        await EnsureOperatorAsync(crew.MerchantId, ct);
        ValidateQualification(request);

        var qualification = new CrewQualification
        {
            CrewMemberId = crewId,
            Type = request.Type.Trim(),
            Number = request.Number.Trim(),
            IssuedAt = request.IssuedAt.ToUniversalTime(),
            ExpiresAt = request.ExpiresAt.ToUniversalTime(),
            FileUrl = request.FileUrl
        };

        _db.CrewQualifications.Add(qualification);
        await _db.SaveChangesAsync(ct);
        return Map(qualification);
    }

    public async Task<QualificationDto> UpdateQualificationAsync(
        Guid crewId,
        Guid qualificationId,
        AddQualificationRequest request,
        CancellationToken ct = default)
    {
        var crew = await GetTrackedCrewAsync(crewId, ct);
        await EnsureOperatorAsync(crew.MerchantId, ct);
        ValidateQualification(request);

        var qualification = await _db.CrewQualifications
            .FirstOrDefaultAsync(q => q.Id == qualificationId && q.CrewMemberId == crewId, ct)
            ?? throw AppException.NotFound("资质不存在");

        qualification.Type = request.Type.Trim();
        qualification.Number = request.Number.Trim();
        qualification.IssuedAt = request.IssuedAt.ToUniversalTime();
        qualification.ExpiresAt = request.ExpiresAt.ToUniversalTime();
        qualification.FileUrl = request.FileUrl;

        await _db.SaveChangesAsync(ct);
        return Map(qualification);
    }

    public async Task<ScheduleDto> CreateScheduleAsync(
        Guid crewId,
        CreateScheduleRequest request,
        CancellationToken ct = default)
    {
        if (request.EndAt <= request.StartAt)
        {
            throw AppException.Validation("结束时间必须晚于开始时间");
        }

        var crew = await GetTrackedCrewAsync(crewId, ct);
        await EnsureOperatorAsync(crew.MerchantId, ct);

        var startAt = request.StartAt.ToUniversalTime();
        var endAt = request.EndAt.ToUniversalTime();

        var conflict = await _db.CrewSchedules.AnyAsync(
            s => s.CrewMemberId == crewId && s.StartAt < endAt && startAt < s.EndAt,
            ct);
        if (conflict)
        {
            throw new AppException(ErrorCodes.ResourceConflict, "该人员排班与已有排班冲突");
        }

        var schedule = new CrewSchedule
        {
            CrewMemberId = crewId,
            MerchantId = crew.MerchantId,
            StartAt = startAt,
            EndAt = endAt,
            Area = request.Area,
            DroneId = request.DroneId,
            Remark = request.Remark
        };

        _db.CrewSchedules.Add(schedule);
        await _db.SaveChangesAsync(ct);
        return Map(schedule);
    }

    public async Task<IReadOnlyList<ScheduleDto>> ListSchedulesAsync(
        Guid crewId,
        DateTimeOffset? from,
        DateTimeOffset? to,
        CancellationToken ct = default)
    {
        var crew = await _db.CrewMembers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == crewId, ct)
            ?? throw AppException.NotFound("人员不存在");

        if (!_merchant.IsAdmin && !await _merchant.CanOperateMerchantAsync(crew.MerchantId, ct))
        {
            throw AppException.Forbidden("无权查看该人员排班");
        }

        var q = _db.CrewSchedules.AsNoTracking().Where(s => s.CrewMemberId == crewId);
        if (from is not null)
        {
            q = q.Where(s => s.EndAt >= from);
        }

        if (to is not null)
        {
            q = q.Where(s => s.StartAt <= to);
        }

        var rows = await q.OrderBy(s => s.StartAt).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<AttendanceDto> RecordAttendanceAsync(
        Guid crewId,
        RecordAttendanceRequest request,
        CancellationToken ct = default)
    {
        if (!Enum.IsDefined(typeof(AttendanceStatus), request.Status))
        {
            throw AppException.Validation("考勤状态不合法");
        }

        var crew = await GetTrackedCrewAsync(crewId, ct);
        await EnsureOperatorAsync(crew.MerchantId, ct);

        var attendance = await _db.CrewAttendances
            .FirstOrDefaultAsync(a => a.CrewMemberId == crewId && a.Date == request.Date, ct);

        if (attendance is null)
        {
            attendance = new CrewAttendance
            {
                CrewMemberId = crewId,
                MerchantId = crew.MerchantId,
                Date = request.Date
            };
            _db.CrewAttendances.Add(attendance);
        }

        attendance.Status = (AttendanceStatus)request.Status;
        attendance.Remark = request.Remark;

        await _db.SaveChangesAsync(ct);
        return Map(attendance);
    }

    public async Task<IReadOnlyList<AttendanceDto>> ListAttendancesAsync(
        Guid crewId,
        DateOnly? from,
        DateOnly? to,
        CancellationToken ct = default)
    {
        var crew = await _db.CrewMembers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == crewId, ct)
            ?? throw AppException.NotFound("人员不存在");

        if (!_merchant.IsAdmin && !await _merchant.CanOperateMerchantAsync(crew.MerchantId, ct))
        {
            throw AppException.Forbidden("无权查看该人员考勤");
        }

        var q = _db.CrewAttendances.AsNoTracking().Where(a => a.CrewMemberId == crewId);
        if (from is not null)
        {
            q = q.Where(a => a.Date >= from.Value);
        }

        if (to is not null)
        {
            q = q.Where(a => a.Date <= to.Value);
        }

        var rows = await q.OrderByDescending(a => a.Date).ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    private async Task<CrewMember> GetTrackedCrewAsync(Guid crewId, CancellationToken ct) =>
        await _db.CrewMembers.FirstOrDefaultAsync(c => c.Id == crewId, ct)
        ?? throw AppException.NotFound("人员不存在");

    private async Task EnsureOperatorAsync(Guid merchantId, CancellationToken ct)
    {
        if (!await _merchant.CanOperateMerchantAsync(merchantId, ct))
        {
            throw AppException.Forbidden("无权操作该人员");
        }
    }

    private static void ValidateQualification(AddQualificationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Type) || string.IsNullOrWhiteSpace(request.Number))
        {
            throw AppException.Validation("资质类型与编号不能为空");
        }

        if (request.ExpiresAt <= request.IssuedAt)
        {
            throw AppException.Validation("到期时间必须晚于签发时间");
        }
    }

    private static CrewDto Map(CrewMember crew, int qualificationCount, IReadOnlyList<QualificationDto>? qualifications) => new(
        crew.Id,
        crew.MerchantId,
        crew.UserId,
        crew.Name,
        crew.Gender,
        crew.Phone,
        crew.Role.ToString(),
        crew.Region,
        crew.Status.ToString(),
        qualificationCount,
        crew.CreatedAt,
        qualifications);

    private QualificationDto Map(CrewQualification qualification) => new(
        qualification.Id,
        qualification.Type,
        qualification.Number,
        qualification.IssuedAt,
        qualification.ExpiresAt,
        qualification.ExpiresAt <= _clock.UtcNow,
        qualification.FileUrl);

    private static ScheduleDto Map(CrewSchedule schedule) => new(
        schedule.Id,
        schedule.CrewMemberId,
        schedule.StartAt,
        schedule.EndAt,
        schedule.Area,
        schedule.DroneId,
        schedule.Remark);

    private static AttendanceDto Map(CrewAttendance attendance) => new(
        attendance.Id,
        attendance.CrewMemberId,
        attendance.Date,
        attendance.Status.ToString(),
        attendance.Remark);
}
