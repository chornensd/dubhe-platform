using Dubhe.Api.Authorization;
using Dubhe.Api.Common;
using Dubhe.Application.Agent;
using Dubhe.Application.Agent.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Dubhe.Api.Controllers;

[Route("api/agent")]
[Authorize]
public sealed class AgentController : ApiControllerBase
{
    private readonly IAgentService _agentService;

    public AgentController(IAgentService agentService)
    {
        _agentService = agentService;
    }

    [HttpGet("info")]
    [RequirePermission("agent.use")]
    public IActionResult Info()
    {
        return Success(_agentService.GetInfo());
    }

    [HttpPost("knowledge-docs")]
    [RequirePermission("agent.manage")]
    public async Task<IActionResult> CreateKnowledgeDoc(
        [FromBody] CreateKnowledgeDocRequest request,
        CancellationToken ct)
    {
        return Success(await _agentService.CreateKnowledgeDocAsync(request, ct));
    }

    [HttpPut("knowledge-docs/{id:guid}")]
    [RequirePermission("agent.manage")]
    public async Task<IActionResult> UpdateKnowledgeDoc(
        Guid id,
        [FromBody] UpdateKnowledgeDocRequest request,
        CancellationToken ct)
    {
        return Success(await _agentService.UpdateKnowledgeDocAsync(id, request, ct));
    }

    [HttpGet("knowledge-docs")]
    [RequirePermission("agent.use")]
    public async Task<IActionResult> SearchKnowledgeDocs([FromQuery] KnowledgeDocQuery query, CancellationToken ct)
    {
        return Success(await _agentService.SearchKnowledgeDocsAsync(query, ct));
    }

    [HttpGet("knowledge-docs/{id:guid}")]
    [RequirePermission("agent.use")]
    public async Task<IActionResult> GetKnowledgeDoc(Guid id, CancellationToken ct)
    {
        return Success(await _agentService.GetKnowledgeDocAsync(id, ct));
    }

    [HttpPost("knowledge-docs/{id:guid}/publish")]
    [RequirePermission("agent.manage")]
    public async Task<IActionResult> PublishKnowledgeDoc(Guid id, CancellationToken ct)
    {
        return Success(await _agentService.PublishKnowledgeDocAsync(id, ct));
    }

    [HttpPost("tasks")]
    [RequirePermission("agent.use")]
    public async Task<IActionResult> CreateTask([FromBody] CreateAgentTaskRequest request, CancellationToken ct)
    {
        return Success(await _agentService.CreateTaskAsync(request, ct));
    }

    [HttpGet("tasks")]
    [RequirePermission("agent.use")]
    public async Task<IActionResult> SearchTasks([FromQuery] AgentTaskQuery query, CancellationToken ct)
    {
        return Success(await _agentService.SearchTasksAsync(query, ct));
    }

    [HttpGet("tasks/{id:guid}")]
    [RequirePermission("agent.use")]
    public async Task<IActionResult> GetTask(Guid id, CancellationToken ct)
    {
        return Success(await _agentService.GetTaskAsync(id, ct));
    }

    [HttpPost("protocols")]
    [RequirePermission("agent.manage")]
    public async Task<IActionResult> CreateProtocol([FromBody] CreateAgentProtocolRequest request, CancellationToken ct)
    {
        return Success(await _agentService.CreateProtocolAsync(request, ct));
    }

    [HttpGet("protocols")]
    [RequirePermission("agent.use")]
    public async Task<IActionResult> ListProtocols(CancellationToken ct)
    {
        return Success(await _agentService.ListProtocolsAsync(ct));
    }
}
