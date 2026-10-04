using Dubhe.Domain.Agent;

namespace Dubhe.Tests.Agent;

public class AgentStubTests
{
    [Theory]
    [InlineData(AgentTaskType.RequirementParse)]
    [InlineData(AgentTaskType.CodeGeneration)]
    [InlineData(AgentTaskType.QualityCheck)]
    [InlineData(AgentTaskType.Troubleshooting)]
    [InlineData(AgentTaskType.DocGeneration)]
    public void BuildOutput_Returns_Stub_Marker_For_All_Types(AgentTaskType type)
    {
        var output = AgentStub.BuildOutput(type, "测试任务");

        Assert.Contains("骨架实现", output);
        Assert.Contains("测试任务", output);
    }

    [Fact]
    public void BuildOutput_Unknown_Type_Falls_Back()
    {
        var output = AgentStub.BuildOutput((AgentTaskType)99, "未知任务");

        Assert.Contains("骨架实现", output);
    }
}
