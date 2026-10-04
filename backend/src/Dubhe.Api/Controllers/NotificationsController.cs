using Dubhe.Api.Authorization;
using Dubhe.Api.Common;
using Dubhe.Application.Support;
using Dubhe.Application.Support.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dubhe.Api.Controllers;

[Route("api/notifications")]
[Authorize]
public sealed class NotificationsController : ApiControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationsController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] NotificationQuery query, CancellationToken ct)
    {
        return Success(await _notificationService.SearchAsync(query, ct));
    }

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        await _notificationService.MarkReadAsync(id, ct);
        return Success();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
    {
        var count = await _notificationService.MarkAllReadAsync(ct);
        return Success(new { marked = count });
    }
}

[Route("api/admin/system")]
[Authorize]
public sealed class AdminSystemController : ApiControllerBase
{
    private readonly IReminderService _reminderService;

    public AdminSystemController(IReminderService reminderService)
    {
        _reminderService = reminderService;
    }

    [HttpPost("reminders/run")]
    [RequirePermission("config.param.manage")]
    public async Task<IActionResult> RunReminders(CancellationToken ct)
    {
        return Success(await _reminderService.RunAsync(ct));
    }
}
