namespace Dubhe.Application.Abstractions;

public interface IDateTime
{
    DateTimeOffset UtcNow { get; }
}
