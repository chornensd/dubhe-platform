using Dubhe.Application.Abstractions;
using Dubhe.Application.Agent.Dtos;
using Dubhe.Application.Common;
using Dubhe.Domain.Agent;
using Dubhe.Domain.Common;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Agent;

public interface IAgentService
{
    AgentInfoDto GetInfo();
    Task<KnowledgeDocDto> CreateKnowledgeDocAsync(CreateKnowledgeDocRequest request, CancellationToken ct = default);
    Task<KnowledgeDocDto> UpdateKnowledgeDocAsync(Guid id, UpdateKnowledgeDocRequest request, CancellationToken ct = default);
    Task<PagedResult<KnowledgeDocDto>> SearchKnowledgeDocsAsync(KnowledgeDocQuery query, CancellationToken ct = default);
    Task<KnowledgeDocDto> GetKnowledgeDocAsync(Guid id, CancellationToken ct = default);
    Task<KnowledgeDocDto> PublishKnowledgeDocAsync(Guid id, CancellationToken ct = default);
    Task<AgentTaskDto> CreateTaskAsync(CreateAgentTaskRequest request, CancellationToken ct = default);
    Task<PagedResult<AgentTaskDto>> SearchTasksAsync(AgentTaskQuery query, CancellationToken ct = default);
    Task<AgentTaskDto> GetTaskAsync(Guid id, CancellationToken ct = default);
    Task<AgentProtocolDto> CreateProtocolAsync(CreateAgentProtocolRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<AgentProtocolDto>> ListProtocolsAsync(CancellationToken ct = default);
}

public sealed class AgentService : IAgentService
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;
    private readonly IDateTime _clock;

    public AgentService(IAppDbContext db, ICurrentUser currentUser, IDateTime clock)
    {
        _db = db;
        _currentUser = currentUser;
        _clock = clock;
    }

    public AgentInfoDto GetInfo() => new(
        AgentStub.Implementation,
        "智能体为骨架实现：提供知识库/任务/协定的持久化与 API 形态，未接入真实 LLM 与向量检索。",
        Enum.GetNames<AgentTaskType>().ToList(),
        new[]
        {
            "接入 LLM（如通义/DeepSeek）完成真实任务执行",
            "pgvector 向量检索 + 中文全文检索（zhparser/pg_trgm）",
            "与开发流水线（需求文档/代码库/测试报告）打通"
        });

    public async Task<KnowledgeDocDto> CreateKnowledgeDocAsync(
        CreateKnowledgeDocRequest request,
        CancellationToken ct = default)
    {
        ValidateKnowledgeDoc(request.Title, request.Category, request.Content);
        var userId = _currentUser.UserId ?? throw new AppException(ErrorCodes.Forbidden, "未登录");

        var doc = new KnowledgeDoc
        {
            Title = request.Title.Trim(),
            Category = request.Category.Trim(),
            Tags = request.Tags?.Trim() ?? string.Empty,
            Content = request.Content,
            Version = string.IsNullOrWhiteSpace(request.Version) ? "v1" : request.Version.Trim(),
            IsPublished = request.IsPublished,
            CreatedBy = userId
        };

        _db.KnowledgeDocs.Add(doc);
        await _db.SaveChangesAsync(ct);
        return Map(doc);
    }

    public async Task<KnowledgeDocDto> UpdateKnowledgeDocAsync(
        Guid id,
        UpdateKnowledgeDocRequest request,
        CancellationToken ct = default)
    {
        var doc = await _db.KnowledgeDocs.FirstOrDefaultAsync(d => d.Id == id, ct)
            ?? throw AppException.NotFound("知识文档不存在");

        if (!string.IsNullOrWhiteSpace(request.Title))
        {
            doc.Title = request.Title.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Category))
        {
            doc.Category = request.Category.Trim();
        }

        if (request.Tags is not null)
        {
            doc.Tags = request.Tags.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Content))
        {
            doc.Content = request.Content;
        }

        if (!string.IsNullOrWhiteSpace(request.Version))
        {
            doc.Version = request.Version.Trim();
        }

        if (request.IsPublished is not null)
        {
            doc.IsPublished = request.IsPublished.Value;
        }

        await _db.SaveChangesAsync(ct);
        return Map(doc);
    }

    public async Task<PagedResult<KnowledgeDocDto>> SearchKnowledgeDocsAsync(
        KnowledgeDocQuery query,
        CancellationToken ct = default)
    {
        var pageNum = Math.Max(1, query.PageNum);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var q = _db.KnowledgeDocs.AsNoTracking();

        if (query.PublishedOnly == true)
        {
            q = q.Where(d => d.IsPublished);
        }

        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            var category = query.Category.Trim();
            q = q.Where(d => d.Category == category);
        }

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var keyword = query.Keyword.Trim();
            q = q.Where(d => d.Title.Contains(keyword) || d.Tags.Contains(keyword) || d.Content.Contains(keyword));
        }

        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(d => d.UpdatedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<KnowledgeDocDto>
        {
            Items = rows.Select(Map).ToList(),
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task<KnowledgeDocDto> GetKnowledgeDocAsync(Guid id, CancellationToken ct = default)
    {
        var doc = await _db.KnowledgeDocs.AsNoTracking().FirstOrDefaultAsync(d => d.Id == id, ct)
            ?? throw AppException.NotFound("知识文档不存在");
        return Map(doc);
    }

    public async Task<KnowledgeDocDto> PublishKnowledgeDocAsync(Guid id, CancellationToken ct = default)
    {
        var doc = await _db.KnowledgeDocs.FirstOrDefaultAsync(d => d.Id == id, ct)
            ?? throw AppException.NotFound("知识文档不存在");

        doc.IsPublished = true;
        await _db.SaveChangesAsync(ct);
        return Map(doc);
    }

    public async Task<AgentTaskDto> CreateTaskAsync(CreateAgentTaskRequest request, CancellationToken ct = default)
    {
        if (!Enum.IsDefined(typeof(AgentTaskType), request.Type))
        {
            throw AppException.Validation("任务类型不合法");
        }

        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Input))
        {
            throw AppException.Validation("任务标题与输入不能为空");
        }

        var userId = _currentUser.UserId ?? throw new AppException(ErrorCodes.Forbidden, "未登录");
        var now = _clock.UtcNow;
        var type = (AgentTaskType)request.Type;

        var task = new AgentTask
        {
            Type = type,
            Title = request.Title.Trim(),
            Input = request.Input,
            Output = AgentStub.BuildOutput(type, request.Title.Trim()),
            Status = AgentTaskStatus.Succeeded,
            CreatedBy = userId,
            StartedAt = now,
            FinishedAt = now,
            DurationMs = 1
        };

        _db.AgentTasks.Add(task);
        await _db.SaveChangesAsync(ct);
        return Map(task);
    }

    public async Task<PagedResult<AgentTaskDto>> SearchTasksAsync(
        AgentTaskQuery query,
        CancellationToken ct = default)
    {
        var pageNum = Math.Max(1, query.PageNum);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var q = _db.AgentTasks.AsNoTracking();

        if (query.Type is not null)
        {
            q = q.Where(t => t.Type == query.Type);
        }

        if (query.Status is not null)
        {
            q = q.Where(t => t.Status == query.Status);
        }

        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(t => t.CreatedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<AgentTaskDto>
        {
            Items = rows.Select(Map).ToList(),
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task<AgentTaskDto> GetTaskAsync(Guid id, CancellationToken ct = default)
    {
        var task = await _db.AgentTasks.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw AppException.NotFound("任务不存在");
        return Map(task);
    }

    public async Task<AgentProtocolDto> CreateProtocolAsync(
        CreateAgentProtocolRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Content))
        {
            throw AppException.Validation("协定名称与内容不能为空");
        }

        var protocol = new AgentProtocol
        {
            Name = request.Name.Trim(),
            Version = string.IsNullOrWhiteSpace(request.Version) ? "v1" : request.Version.Trim(),
            Description = request.Description,
            Content = request.Content
        };

        _db.AgentProtocols.Add(protocol);
        await _db.SaveChangesAsync(ct);
        return Map(protocol);
    }

    public async Task<IReadOnlyList<AgentProtocolDto>> ListProtocolsAsync(CancellationToken ct = default)
    {
        var rows = await _db.AgentProtocols.AsNoTracking()
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct);
        return rows.Select(Map).ToList();
    }

    private static void ValidateKnowledgeDoc(string title, string category, string content)
    {
        if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(category) || string.IsNullOrWhiteSpace(content))
        {
            throw AppException.Validation("标题、分类与内容不能为空");
        }
    }

    private static KnowledgeDocDto Map(KnowledgeDoc doc) => new(
        doc.Id, doc.Title, doc.Category, doc.Tags, doc.Content, doc.Version,
        doc.IsPublished, doc.CreatedBy, doc.CreatedAt, doc.UpdatedAt);

    private static AgentTaskDto Map(AgentTask task) => new(
        task.Id, task.Type.ToString(), task.Title, task.Input, task.Output, task.Status.ToString(),
        task.Error, task.CreatedBy, task.StartedAt, task.FinishedAt, task.DurationMs, task.CreatedAt);

    private static AgentProtocolDto Map(AgentProtocol protocol) => new(
        protocol.Id, protocol.Name, protocol.Version, protocol.Description, protocol.Content,
        protocol.IsActive, protocol.CreatedAt);
}
