using Dubhe.Domain.Common;

namespace Dubhe.Domain.Agent;

public enum AgentTaskType
{
    RequirementParse = 1,
    CodeGeneration = 2,
    QualityCheck = 3,
    Troubleshooting = 4,
    DocGeneration = 5
}

public enum AgentTaskStatus
{
    Pending = 0,
    Running = 1,
    Succeeded = 2,
    Failed = 3
}

public class KnowledgeDoc : BaseEntity
{
    public string Title { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Tags { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Version { get; set; } = "v1";
    public bool IsPublished { get; set; } = true;
    public Guid CreatedBy { get; set; }
}

public class AgentTask : BaseEntity
{
    public AgentTaskType Type { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Input { get; set; } = string.Empty;
    public string? Output { get; set; }
    public AgentTaskStatus Status { get; set; } = AgentTaskStatus.Pending;
    public string? Error { get; set; }
    public Guid CreatedBy { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? FinishedAt { get; set; }
    public int DurationMs { get; set; }
}

public class AgentProtocol : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string Version { get; set; } = "v1";
    public string? Description { get; set; }
    public string Content { get; set; } = "{}";
    public bool IsActive { get; set; } = true;
}

public static class AgentStub
{
    public const string Implementation = "stub";

    public static string BuildOutput(AgentTaskType type, string title) => type switch
    {
        AgentTaskType.RequirementParse =>
            $"# 需求解析任务：{title}\n\n- 已提取任务标题与输入摘要\n- 建议按模块拆分功能点并标注优先级\n\n（骨架实现：后续可接入 LLM 完成真实解析）",
        AgentTaskType.CodeGeneration =>
            $"# 代码生成任务：{title}\n\n```csharp\n// TODO: 根据需求生成实现\npublic sealed class GeneratedFeature\n{{\n    public string Name => \"{title}\";\n}}\n```\n\n（骨架实现：后续可接入 LLM 生成真实代码）",
        AgentTaskType.QualityCheck =>
            $"# 规范校验任务：{title}\n\n- [ ] 命名规范\n- [ ] 接口返回统一格式\n- [ ] 权限校验\n\n（骨架实现：后续可接入静态分析与 LLM 复核）",
        AgentTaskType.Troubleshooting =>
            $"# 问题排查任务：{title}\n\n1. 收集报错信息与复现步骤\n2. 定位日志与请求链路\n3. 给出修复建议\n\n（骨架实现：后续可接入 LLM 与日志检索）",
        AgentTaskType.DocGeneration =>
            $"# 文档生成任务：{title}\n\n- 接口清单：待补充\n- 变更记录：待补充\n\n（骨架实现：后续可接入 LLM 与知识库同步）",
        _ => $"# 任务：{title}\n\n（骨架实现）"
    };
}
