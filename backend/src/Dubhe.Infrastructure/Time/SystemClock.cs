using Dubhe.Application.Abstractions;

namespace Dubhe.Infrastructure.Time;

public sealed class SystemClock : IDateTime
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
