using System.Security.Claims;
using Dubhe.Domain.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;

namespace Dubhe.Api.Authorization;

public sealed class RequirePermissionAttribute : AuthorizeAttribute
{
    public const string Prefix = "perm:";

    public RequirePermissionAttribute(string permission)
    {
        Policy = Prefix + permission;
    }
}

/// <summary>满足任意一个权限点即可（例如“订单调度”或“机长执行任务”都能开始飞行）。</summary>
public sealed class RequireAnyPermissionAttribute : AuthorizeAttribute
{
    public const string Prefix = "perm-any:";

    public RequireAnyPermissionAttribute(params string[] permissions)
    {
        Policy = Prefix + string.Join(",", permissions);
    }
}

public sealed class PermissionRequirement : IAuthorizationRequirement
{
    public string Permission { get; }

    public PermissionRequirement(string permission)
    {
        Permission = permission;
    }
}

public sealed class AnyPermissionRequirement : IAuthorizationRequirement
{
    public AnyPermissionRequirement(IReadOnlyList<string> permissions)
    {
        Permissions = permissions;
    }

    public IReadOnlyList<string> Permissions { get; }
}

public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        if (context.User.IsInRole(RoleCodes.Admin) || context.User.HasClaim("perm", requirement.Permission))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}

public sealed class AnyPermissionAuthorizationHandler : AuthorizationHandler<AnyPermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        AnyPermissionRequirement requirement)
    {
        if (context.User.IsInRole(RoleCodes.Admin) ||
            requirement.Permissions.Any(p => context.User.HasClaim("perm", p)))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}

public sealed class PermissionPolicyProvider : DefaultAuthorizationPolicyProvider
{
    public PermissionPolicyProvider(IOptions<AuthorizationOptions> options) : base(options)
    {
    }

    public override Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (policyName.StartsWith(RequirePermissionAttribute.Prefix, StringComparison.Ordinal))
        {
            var policy = new AuthorizationPolicyBuilder()
                .AddRequirements(new PermissionRequirement(
                    policyName[RequirePermissionAttribute.Prefix.Length..]))
                .Build();
            return Task.FromResult<AuthorizationPolicy?>(policy);
        }

        if (policyName.StartsWith(RequireAnyPermissionAttribute.Prefix, StringComparison.Ordinal))
        {
            var permissions = policyName[RequireAnyPermissionAttribute.Prefix.Length..]
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var policy = new AuthorizationPolicyBuilder()
                .AddRequirements(new AnyPermissionRequirement(permissions))
                .Build();
            return Task.FromResult<AuthorizationPolicy?>(policy);
        }

        return base.GetPolicyAsync(policyName);
    }
}

public sealed class SubUserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection)
    {
        return connection.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
               ?? connection.User?.FindFirst("sub")?.Value;
    }
}
