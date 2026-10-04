using System.Text.Json;
using Dubhe.Application.Abstractions;
using Dubhe.Application.Common;
using Dubhe.Application.Config.Dtos;
using Dubhe.Application.Report.Dtos;
using Dubhe.Domain.Admin;
using Dubhe.Domain.Agent;
using Dubhe.Domain.Common;
using Dubhe.Domain.Config;
using Dubhe.Domain.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Dubhe.Application.Config;

public sealed record BackupSnapshot(
    DateTimeOffset CreatedAt,
    List<SystemConfigItem> Configs,
    List<KnowledgeDoc> KnowledgeDocs,
    List<HelpArticle> HelpArticles);

public interface IBackupService
{
    Task<BackupRecordDto> CreateAsync(CreateBackupRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<BackupRecordDto>> ListAsync(CancellationToken ct = default);
    Task<RestoreResultDto> RestoreAsync(Guid id, CancellationToken ct = default);
}

public sealed class BackupService : IBackupService
{
    private const string AllScope = "config,knowledge,help";
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = false };

    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly IDateTime _clock;
    private readonly BackupOptions _options;

    public BackupService(
        IAppDbContext db,
        ICurrentUser currentUser,
        IDateTime clock,
        IOptions<BackupOptions> options)
    {
        _db = db;
        _currentUser = currentUser;
        _clock = clock;
        _options = options.Value;
    }

    public async Task<BackupRecordDto> CreateAsync(CreateBackupRequest request, CancellationToken ct = default)
    {
        var scope = NormalizeScope(request.Scope);
        var userId = _currentUser.UserId ?? throw new AppException(ErrorCodes.Forbidden, "未登录");
        var now = _clock.UtcNow;

        var snapshot = new BackupSnapshot(
            now,
            scope.Contains("config") ? await _db.SystemConfigItems.AsNoTracking().ToListAsync(ct) : new List<SystemConfigItem>(),
            scope.Contains("knowledge") ? await _db.KnowledgeDocs.AsNoTracking().ToListAsync(ct) : new List<KnowledgeDoc>(),
            scope.Contains("help") ? await _db.HelpArticles.AsNoTracking().ToListAsync(ct) : new List<HelpArticle>());

        var fileName = $"backup-{now:yyyyMMddHHmmss}-{Guid.NewGuid():N}"[..31] + ".json";
        var directory = ResolveDirectory();
        Directory.CreateDirectory(directory);
        var path = Path.Combine(directory, fileName);

        var record = new BackupRecord
        {
            FileName = fileName,
            Scope = scope,
            CreatedBy = userId
        };

        try
        {
            var json = JsonSerializer.Serialize(snapshot, JsonOptions);
            await File.WriteAllTextAsync(path, json, ct);
            record.SizeBytes = new FileInfo(path).Length;
            record.Status = "Succeeded";
        }
        catch (Exception ex)
        {
            record.Status = "Failed";
            record.Error = ex.Message;
            _db.BackupRecords.Add(record);
            await _db.SaveChangesAsync(ct);
            throw new AppException(ErrorCodes.InternalError, $"备份失败：{ex.Message}");
        }

        _db.BackupRecords.Add(record);
        await _db.SaveChangesAsync(ct);
        return Map(record);
    }

    public async Task<IReadOnlyList<BackupRecordDto>> ListAsync(CancellationToken ct = default)
    {
        var rows = await _db.BackupRecords.AsNoTracking()
            .OrderByDescending(b => b.CreatedAt)
            .ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    public async Task<RestoreResultDto> RestoreAsync(Guid id, CancellationToken ct = default)
    {
        var record = await _db.BackupRecords.FirstOrDefaultAsync(b => b.Id == id, ct)
            ?? throw AppException.NotFound("备份记录不存在");

        if (record.Status != "Succeeded")
        {
            throw new AppException(ErrorCodes.ResourceConflict, "该备份未成功，无法恢复");
        }

        var path = Path.Combine(ResolveDirectory(), record.FileName);
        if (!File.Exists(path))
        {
            throw AppException.NotFound("备份文件不存在");
        }

        BackupSnapshot? snapshot;
        try
        {
            var json = await File.ReadAllTextAsync(path, ct);
            snapshot = JsonSerializer.Deserialize<BackupSnapshot>(json, JsonOptions);
        }
        catch (Exception ex)
        {
            throw AppException.Validation($"备份文件无法解析：{ex.Message}");
        }

        if (snapshot is null)
        {
            throw AppException.Validation("备份文件内容为空");
        }

        await _db.SystemConfigItems.ExecuteDeleteAsync(ct);
        await _db.KnowledgeDocs.ExecuteDeleteAsync(ct);
        await _db.HelpArticles.ExecuteDeleteAsync(ct);

        if (snapshot.Configs.Count > 0)
        {
            _db.SystemConfigItems.AddRange(snapshot.Configs);
        }

        if (snapshot.KnowledgeDocs.Count > 0)
        {
            _db.KnowledgeDocs.AddRange(snapshot.KnowledgeDocs);
        }

        if (snapshot.HelpArticles.Count > 0)
        {
            _db.HelpArticles.AddRange(snapshot.HelpArticles);
        }

        record.RestoredAt = _clock.UtcNow;
        await _db.SaveChangesAsync(ct);

        return new RestoreResultDto(
            record.Id,
            snapshot.Configs.Count,
            snapshot.KnowledgeDocs.Count,
            snapshot.HelpArticles.Count,
            record.RestoredAt.Value);
    }

    private static string NormalizeScope(string? scope)
    {
        if (string.IsNullOrWhiteSpace(scope) || scope.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            return AllScope;
        }

        var parts = scope.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(p => p.ToLowerInvariant())
            .Distinct()
            .ToList();

        if (parts.Count == 0 || parts.Any(p => !AllScope.Contains(p)))
        {
            throw AppException.Validation("备份范围仅支持 config,knowledge,help 或其组合");
        }

        return string.Join(",", parts);
    }

    private string ResolveDirectory()
    {
        var directory = string.IsNullOrWhiteSpace(_options.Directory) ? "backups" : _options.Directory;
        return Path.IsPathRooted(directory)
            ? directory
            : Path.Combine(Directory.GetCurrentDirectory(), directory);
    }

    private static BackupRecordDto Map(BackupRecord record) => new(
        record.Id,
        record.FileName,
        record.Scope,
        record.SizeBytes,
        record.Status,
        record.Error,
        record.RestoredAt,
        record.CreatedBy,
        record.CreatedAt);
}

public interface ILogQueryService
{
    Task<PagedResult<AuditLogDto>> SearchAsync(AuditLogQuery query, CancellationToken ct = default);
    Task<byte[]> ExportAsync(AuditLogQuery query, CancellationToken ct = default);
    Task<CleanupLogsResultDto> CleanupAsync(int retentionDays, CancellationToken ct = default);
}

public sealed class LogQueryService : ILogQueryService
{
    private const int ExportMaxRows = 10000;

    private readonly IAppDbContext _db;
    private readonly IDateTime _clock;
    private readonly IReportExporter _exporter;

    public LogQueryService(IAppDbContext db, IDateTime clock, IReportExporter exporter)
    {
        _db = db;
        _clock = clock;
        _exporter = exporter;
    }

    public async Task<PagedResult<AuditLogDto>> SearchAsync(AuditLogQuery query, CancellationToken ct = default)
    {
        var pageNum = Math.Max(1, query.PageNum);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var q = BuildQuery(query);

        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(l => l.CreatedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<AuditLogDto>
        {
            Items = rows.Select(Map).ToList(),
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task<byte[]> ExportAsync(AuditLogQuery query, CancellationToken ct = default)
    {
        var rows = await BuildQuery(query)
            .OrderByDescending(l => l.CreatedAt)
            .Take(ExportMaxRows)
            .ToListAsync(ct);

        var columns = new List<ReportFieldDefDto>
        {
            new("time", "时间", "datetime"),
            new("username", "用户", "string"),
            new("module", "模块", "string"),
            new("action", "操作", "string"),
            new("ip", "IP", "string"),
            new("succeeded", "结果", "bool"),
            new("durationMs", "耗时(ms)", "number")
        };

        var data = rows.Select(l => (IReadOnlyDictionary<string, object?>)new Dictionary<string, object?>
        {
            ["time"] = l.CreatedAt.LocalDateTime.ToString("yyyy-MM-dd HH:mm:ss"),
            ["username"] = l.Username,
            ["module"] = l.Module,
            ["action"] = l.Action,
            ["ip"] = l.Ip,
            ["succeeded"] = l.Succeeded,
            ["durationMs"] = l.DurationMs
        }).ToList();

        return _exporter.BuildReport("操作日志导出", columns, data);
    }

    public async Task<CleanupLogsResultDto> CleanupAsync(int retentionDays, CancellationToken ct = default)
    {
        if (retentionDays is < 1 or > 3650)
        {
            throw AppException.Validation("保留天数需在 1-3650 之间");
        }

        var threshold = _clock.UtcNow.AddDays(-retentionDays);
        var deleted = await _db.AuditLogs
            .Where(l => l.CreatedAt < threshold)
            .ExecuteDeleteAsync(ct);

        return new CleanupLogsResultDto(deleted);
    }

    private IQueryable<AuditLog> BuildQuery(AuditLogQuery query)
    {
        var q = _db.AuditLogs.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(query.Module))
        {
            var module = query.Module.Trim();
            q = q.Where(l => l.Module == module);
        }

        if (query.Succeeded is not null)
        {
            q = q.Where(l => l.Succeeded == query.Succeeded);
        }

        if (query.From is not null)
        {
            q = q.Where(l => l.CreatedAt >= query.From);
        }

        if (query.To is not null)
        {
            q = q.Where(l => l.CreatedAt <= query.To);
        }

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var keyword = query.Keyword.Trim();
            q = q.Where(l => (l.Username != null && l.Username.Contains(keyword))
                             || l.Action.Contains(keyword)
                             || (l.Detail != null && l.Detail.Contains(keyword)));
        }

        return q;
    }

    private static AuditLogDto Map(AuditLog log) => new(
        log.Id,
        log.UserId,
        log.Username,
        log.Module,
        log.Action,
        log.Detail,
        log.Ip,
        log.Succeeded,
        log.DurationMs,
        log.CreatedAt);
}
