using Dubhe.Infrastructure.Persistence;

namespace Dubhe.Tests.Persistence;

public class ModelBuilderExtensionsTests
{
    [Theory]
    [InlineData("Users", "users")]
    [InlineData("RefreshTokens", "refresh_tokens")]
    [InlineData("UserRoles", "user_roles")]
    [InlineData("RolePermissions", "role_permissions")]
    [InlineData("CreatedAt", "created_at")]
    [InlineData("UserId", "user_id")]
    [InlineData("CreatedByIp", "created_by_ip")]
    [InlineData("ReplacedByTokenHash", "replaced_by_token_hash")]
    [InlineData("IX_Users_Username", "ix_users_username")]
    [InlineData("AuditLogs", "audit_logs")]
    public void ToSnakeCase_Should_Convert_PascalCase(string input, string expected)
    {
        Assert.Equal(expected, ModelBuilderExtensions.ToSnakeCase(input));
    }
}
