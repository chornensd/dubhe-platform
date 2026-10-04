using Dubhe.Api.Common;
using Dubhe.Domain.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dubhe.Api.Controllers;

/// <summary>通用文件上传（故障照片、凭证等）。文件落盘到 wwwroot/uploads 并返回可访问 URL。</summary>
[Route("api/files")]
[Authorize]
public sealed class FilesController : ApiControllerBase
{
    private const long MaxFileSize = 8 * 1024 * 1024;

    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"
    };

    private readonly IWebHostEnvironment _environment;

    public FilesController(IWebHostEnvironment environment)
    {
        _environment = environment;
    }

    [HttpPost("upload")]
    [RequestSizeLimit(MaxFileSize)]
    public async Task<IActionResult> Upload(IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            throw AppException.Validation("请选择要上传的文件");
        }

        if (file.Length > MaxFileSize)
        {
            throw AppException.Validation("文件大小不能超过 8MB");
        }

        var extension = Path.GetExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(extension) || !AllowedExtensions.Contains(extension))
        {
            throw AppException.Validation("仅支持图片（jpg/png/webp/gif）或 PDF 文件");
        }

        var root = string.IsNullOrWhiteSpace(_environment.WebRootPath)
            ? Path.Combine(_environment.ContentRootPath, "wwwroot")
            : _environment.WebRootPath;
        var folder = Path.Combine(root, "uploads", DateTime.UtcNow.ToString("yyyyMM"));
        Directory.CreateDirectory(folder);

        var fileName = $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        var fullPath = Path.Combine(folder, fileName);

        await using (var stream = System.IO.File.Create(fullPath))
        {
            await file.CopyToAsync(stream, ct);
        }

        var url = $"/uploads/{DateTime.UtcNow:yyyyMM}/{fileName}";
        return Success(new { url });
    }
}
