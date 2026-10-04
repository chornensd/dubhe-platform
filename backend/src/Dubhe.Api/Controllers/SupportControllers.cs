using Dubhe.Api.Authorization;
using Dubhe.Api.Common;
using Dubhe.Application.Support;
using Dubhe.Application.Support.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dubhe.Api.Controllers;

[Route("api/support/emergency-alerts")]
[Authorize]
[RequirePermission("support.alert.handle")]
public sealed class EmergencyAlertsController : ApiControllerBase
{
    private readonly IEmergencyService _emergencyService;

    public EmergencyAlertsController(IEmergencyService emergencyService)
    {
        _emergencyService = emergencyService;
    }

    [HttpPost]
    public async Task<IActionResult> Report([FromBody] CreateEmergencyAlertRequest request, CancellationToken ct)
    {
        return Success(await _emergencyService.ReportAsync(request, ct));
    }

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] EmergencyQuery query, CancellationToken ct)
    {
        return Success(await _emergencyService.SearchAsync(query, ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        return Success(await _emergencyService.GetAsync(id, ct));
    }

    [HttpPost("{id:guid}/dispatch")]
    public async Task<IActionResult> Dispatch(Guid id, [FromBody] DispatchEmergencyRequest request, CancellationToken ct)
    {
        return Success(await _emergencyService.DispatchAsync(id, request, ct));
    }

    [HttpPost("{id:guid}/progress")]
    public async Task<IActionResult> Progress(Guid id, [FromBody] ProgressEmergencyRequest request, CancellationToken ct)
    {
        return Success(await _emergencyService.AddProgressAsync(id, request, ct));
    }

    [HttpPost("{id:guid}/close")]
    public async Task<IActionResult> Close(Guid id, [FromBody] CloseEmergencyRequest request, CancellationToken ct)
    {
        return Success(await _emergencyService.CloseAsync(id, request, ct));
    }
}

[Route("api/support/tickets")]
[Authorize]
public sealed class TicketsController : ApiControllerBase
{
    private readonly ITicketService _ticketService;

    public TicketsController(ITicketService ticketService)
    {
        _ticketService = ticketService;
    }

    [HttpPost]
    [RequirePermission("support.ticket.apply")]
    public async Task<IActionResult> Submit([FromBody] CreateTicketRequest request, CancellationToken ct)
    {
        return Success(await _ticketService.SubmitAsync(request, ct));
    }

    [HttpGet]
    public async Task<IActionResult> Search([FromQuery] TicketQuery query, CancellationToken ct)
    {
        return Success(await _ticketService.SearchAsync(query, ct));
    }

    [HttpGet("stats")]
    [RequirePermission("support.ticket.manage")]
    public async Task<IActionResult> Stats(CancellationToken ct)
    {
        return Success(await _ticketService.StatsAsync(ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        return Success(await _ticketService.GetAsync(id, ct));
    }

    [HttpPost("{id:guid}/assign")]
    [RequirePermission("support.ticket.manage")]
    public async Task<IActionResult> Assign(Guid id, [FromBody] AssignTicketRequest request, CancellationToken ct)
    {
        return Success(await _ticketService.AssignAsync(id, request, ct));
    }

    [HttpPost("{id:guid}/reply")]
    public async Task<IActionResult> Reply(Guid id, [FromBody] ReplyTicketRequest request, CancellationToken ct)
    {
        return Success(await _ticketService.ReplyAsync(id, request, ct));
    }

    [HttpPost("{id:guid}/complete")]
    [RequirePermission("support.ticket.manage")]
    public async Task<IActionResult> Complete(Guid id, CancellationToken ct)
    {
        return Success(await _ticketService.CompleteAsync(id, ct));
    }

    [HttpPost("{id:guid}/close")]
    public async Task<IActionResult> Close(Guid id, CancellationToken ct)
    {
        return Success(await _ticketService.CloseAsync(id, ct));
    }

    [HttpPost("{id:guid}/rate")]
    public async Task<IActionResult> Rate(Guid id, [FromBody] RateTicketRequest request, CancellationToken ct)
    {
        return Success(await _ticketService.RateAsync(id, request, ct));
    }

    [HttpGet("canned-responses")]
    [RequirePermission("support.ticket.manage")]
    public async Task<IActionResult> ListCannedResponses(CancellationToken ct)
    {
        return Success(await _ticketService.ListCannedResponsesAsync(ct));
    }

    [HttpPost("canned-responses")]
    [RequirePermission("support.ticket.manage")]
    public async Task<IActionResult> CreateCannedResponse(
        [FromBody] CreateCannedResponseRequest request,
        CancellationToken ct)
    {
        return Success(await _ticketService.CreateCannedResponseAsync(request, ct));
    }
}

[Route("api/help")]
[AllowAnonymous]
public sealed class HelpController : ApiControllerBase
{
    private readonly IHelpService _helpService;

    public HelpController(IHelpService helpService)
    {
        _helpService = helpService;
    }

    [HttpGet("articles")]
    public async Task<IActionResult> Search([FromQuery] HelpQuery query, CancellationToken ct)
    {
        return Success(await _helpService.SearchAsync(query, ct));
    }

    [HttpGet("articles/{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
    {
        return Success(await _helpService.GetAsync(id, ct));
    }

    [HttpGet("categories")]
    public async Task<IActionResult> Categories(CancellationToken ct)
    {
        return Success(await _helpService.CategoriesAsync(ct));
    }
}

[Route("api/support/help/articles")]
[Authorize]
[RequirePermission("support.help.manage")]
public sealed class HelpManageController : ApiControllerBase
{
    private readonly IHelpService _helpService;

    public HelpManageController(IHelpService helpService)
    {
        _helpService = helpService;
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateHelpArticleRequest request, CancellationToken ct)
    {
        return Success(await _helpService.CreateAsync(request, ct));
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateHelpArticleRequest request, CancellationToken ct)
    {
        return Success(await _helpService.UpdateAsync(id, request, ct));
    }

    [HttpPost("{id:guid}/publish")]
    public async Task<IActionResult> Publish(Guid id, CancellationToken ct)
    {
        return Success(await _helpService.PublishAsync(id, ct));
    }
}
