namespace Dubhe.Application.Common;

public sealed class PagedResult<T>
{
    public IReadOnlyList<T> Items { get; init; } = Array.Empty<T>();
    public long Total { get; init; }
    public int PageNum { get; init; }
    public int PageSize { get; init; }
}
