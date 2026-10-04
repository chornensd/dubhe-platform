using Dubhe.Domain.Common;

namespace Dubhe.Domain.Admin;

public class AuditLog : BaseEntity
{
    public Guid? UserId { get; set; }
    public string? Username { get; set; }
    public string Module { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string? Detail { get; set; }
    public string? Ip { get; set; }
    public bool Succeeded { get; set; }
    public int DurationMs { get; set; }
}
