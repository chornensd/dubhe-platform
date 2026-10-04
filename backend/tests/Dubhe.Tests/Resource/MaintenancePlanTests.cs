using Dubhe.Domain.Resource;

namespace Dubhe.Tests.Resource;

public class MaintenancePlanTests
{
    private static readonly DateTimeOffset Now = new(2026, 10, 1, 0, 0, 0, TimeSpan.Zero);
    private static readonly TimeSpan Window = TimeSpan.FromDays(7);

    [Fact]
    public void Overdue_When_Time_Due_Passed()
    {
        var plan = new MaintenancePlan { Enabled = true, NextDueAt = Now.AddHours(-1) };

        Assert.True(plan.IsOverdue(0, Now));
    }

    [Fact]
    public void Overdue_When_Flight_Minutes_Reached()
    {
        var plan = new MaintenancePlan { Enabled = true, NextDueFlightMinutes = 100 };

        Assert.True(plan.IsOverdue(120, Now));
        Assert.False(plan.IsOverdue(50, Now));
    }

    [Fact]
    public void Disabled_Plan_Never_Overdue_Or_DueSoon()
    {
        var plan = new MaintenancePlan
        {
            Enabled = false,
            NextDueAt = Now.AddDays(-10),
            NextDueFlightMinutes = 1
        };

        Assert.False(plan.IsOverdue(9999, Now));
        Assert.False(plan.IsDueSoon(9999, Now, Window, 60));
    }

    [Fact]
    public void DueSoon_Within_Time_Window()
    {
        var plan = new MaintenancePlan { Enabled = true, NextDueAt = Now.AddDays(3) };

        Assert.True(plan.IsDueSoon(0, Now, Window, 60));
        Assert.False(plan.IsDueSoon(0, Now, TimeSpan.FromDays(1), 60));
    }

    [Fact]
    public void DueSoon_Within_Flight_Minute_Buffer()
    {
        var plan = new MaintenancePlan { Enabled = true, NextDueFlightMinutes = 100 };

        Assert.True(plan.IsDueSoon(50, Now, Window, 60));
        Assert.False(plan.IsDueSoon(0, Now, Window, 60));
    }
}
