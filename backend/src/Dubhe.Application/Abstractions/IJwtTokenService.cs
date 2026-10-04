using Dubhe.Domain.Auth;

namespace Dubhe.Application.Abstractions;

public sealed record AccessTokenResult(string AccessToken, DateTimeOffset ExpiresAt);

public interface IJwtTokenService
{
    AccessTokenResult CreateAccessToken(
        User user,
        IReadOnlyCollection<string> roles,
        IReadOnlyCollection<string> permissions,
        DeviceType deviceType);
}
