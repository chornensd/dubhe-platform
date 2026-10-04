using Dubhe.Application.Abstractions;
using Dubhe.Application.Common;
using Dubhe.Application.Support.Dtos;
using Dubhe.Domain.Common;
using Dubhe.Domain.Support;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Application.Support;

public interface IHelpService
{
    Task<PagedResult<HelpArticleDto>> SearchAsync(HelpQuery query, CancellationToken ct = default);
    Task<HelpArticleDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<string>> CategoriesAsync(CancellationToken ct = default);
    Task<HelpArticleDto> CreateAsync(CreateHelpArticleRequest request, CancellationToken ct = default);
    Task<HelpArticleDto> UpdateAsync(Guid id, UpdateHelpArticleRequest request, CancellationToken ct = default);
    Task<HelpArticleDto> PublishAsync(Guid id, CancellationToken ct = default);
}

public sealed class HelpService : IHelpService
{
    private readonly IAppDbContext _db;
    private readonly ICurrentUser _currentUser;

    public HelpService(IAppDbContext db, ICurrentUser currentUser)
    {
        _db = db;
        _currentUser = currentUser;
    }

    public async Task<PagedResult<HelpArticleDto>> SearchAsync(HelpQuery query, CancellationToken ct = default)
    {
        var pageNum = Math.Max(1, query.PageNum);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var q = _db.HelpArticles.AsNoTracking().Where(a => a.IsPublished);

        if (!string.IsNullOrWhiteSpace(query.Category))
        {
            var category = query.Category.Trim();
            q = q.Where(a => a.Category == category);
        }

        if (query.ContentType is not null)
        {
            q = q.Where(a => a.ContentType == query.ContentType);
        }

        if (!string.IsNullOrWhiteSpace(query.Keyword))
        {
            var keyword = query.Keyword.Trim();
            q = q.Where(a => a.Title.Contains(keyword) || a.Tags.Contains(keyword) || a.Content.Contains(keyword));
        }

        var total = await q.LongCountAsync(ct);
        var rows = await q.OrderByDescending(a => a.UpdatedAt)
            .Skip((pageNum - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<HelpArticleDto>
        {
            Items = rows.Select(Map).ToList(),
            Total = total,
            PageNum = pageNum,
            PageSize = pageSize
        };
    }

    public async Task<HelpArticleDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var article = await _db.HelpArticles.FirstOrDefaultAsync(a => a.Id == id && a.IsPublished, ct)
            ?? throw AppException.NotFound("帮助文档不存在");

        article.ViewCount++;
        await _db.SaveChangesAsync(ct);
        return Map(article);
    }

    public async Task<IReadOnlyList<string>> CategoriesAsync(CancellationToken ct = default)
    {
        return await _db.HelpArticles.AsNoTracking()
            .Where(a => a.IsPublished)
            .Select(a => a.Category)
            .Distinct()
            .OrderBy(c => c)
            .ToListAsync(ct);
    }

    public async Task<HelpArticleDto> CreateAsync(CreateHelpArticleRequest request, CancellationToken ct = default)
    {
        Validate(request.Title, request.Category, request.Content, request.ContentType, request.VideoUrl);
        var userId = _currentUser.UserId ?? throw new AppException(ErrorCodes.Forbidden, "未登录");

        var article = new HelpArticle
        {
            Title = request.Title.Trim(),
            Category = request.Category.Trim(),
            Tags = request.Tags?.Trim() ?? string.Empty,
            ContentType = (HelpContentType)request.ContentType,
            VideoUrl = request.VideoUrl,
            Content = request.Content,
            IsPublished = request.IsPublished,
            CreatedBy = userId
        };

        _db.HelpArticles.Add(article);
        await _db.SaveChangesAsync(ct);
        return Map(article);
    }

    public async Task<HelpArticleDto> UpdateAsync(
        Guid id,
        UpdateHelpArticleRequest request,
        CancellationToken ct = default)
    {
        var article = await _db.HelpArticles.FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw AppException.NotFound("帮助文档不存在");

        if (!string.IsNullOrWhiteSpace(request.Title))
        {
            article.Title = request.Title.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Category))
        {
            article.Category = request.Category.Trim();
        }

        if (request.Tags is not null)
        {
            article.Tags = request.Tags.Trim();
        }

        if (request.ContentType is not null)
        {
            article.ContentType = (HelpContentType)request.ContentType.Value;
        }

        if (request.VideoUrl is not null)
        {
            article.VideoUrl = string.IsNullOrWhiteSpace(request.VideoUrl) ? null : request.VideoUrl.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Content))
        {
            article.Content = request.Content;
        }

        if (request.IsPublished is not null)
        {
            article.IsPublished = request.IsPublished.Value;
        }

        await _db.SaveChangesAsync(ct);
        return Map(article);
    }

    public async Task<HelpArticleDto> PublishAsync(Guid id, CancellationToken ct = default)
    {
        var article = await _db.HelpArticles.FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw AppException.NotFound("帮助文档不存在");

        article.IsPublished = true;
        await _db.SaveChangesAsync(ct);
        return Map(article);
    }

    private static void Validate(string title, string category, string content, int contentType, string? videoUrl)
    {
        if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(category) || string.IsNullOrWhiteSpace(content))
        {
            throw AppException.Validation("标题、分类与内容不能为空");
        }

        if (!Enum.IsDefined(typeof(HelpContentType), contentType))
        {
            throw AppException.Validation("内容类型不合法");
        }

        if (contentType == (int)HelpContentType.Video && string.IsNullOrWhiteSpace(videoUrl))
        {
            throw AppException.Validation("视频教程必须提供视频地址");
        }
    }

    private static HelpArticleDto Map(HelpArticle article) => new(
        article.Id,
        article.Title,
        article.Category,
        article.Tags,
        article.ContentType.ToString(),
        article.VideoUrl,
        article.Content,
        article.IsPublished,
        article.ViewCount,
        article.CreatedAt,
        article.UpdatedAt);
}
