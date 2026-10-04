using Dubhe.Domain.Common;

namespace Dubhe.Domain.Auth;

public class User : BaseEntity, ISoftDeletable
{
    public string Username { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string PasswordHash { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public UserType UserType { get; set; }
    public AccountStatus Status { get; set; } = AccountStatus.PendingReview;
    public string? CompanyName { get; set; }
    public string? AvatarUrl { get; set; }
    public int FailedLoginCount { get; set; }
    public DateTimeOffset? LockoutEndAt { get; set; }
    public DateTimeOffset? LastLoginAt { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }

    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
}
