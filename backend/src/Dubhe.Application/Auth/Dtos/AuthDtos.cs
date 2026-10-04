namespace Dubhe.Application.Auth.Dtos;

public sealed record RegisterRequest(
    string Username,
    string Phone,
    string Password,
    string DisplayName,
    int UserType,
    string? CompanyName);

public sealed record LoginRequest(string Account, string Password);

public sealed record RefreshRequest(string RefreshToken);

public sealed record LogoutRequest(string RefreshToken);

public sealed record AuthUserDto(
    Guid Id,
    string Username,
    string DisplayName,
    string Phone,
    string? Email,
    string UserType,
    string Status,
    string? CompanyName,
    IReadOnlyList<string> Roles,
    IReadOnlyList<string>? Permissions,
    DateTimeOffset? LastLoginAt);

public sealed record AuthResultDto(
    string AccessToken,
    DateTimeOffset AccessTokenExpiresAt,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAt,
    AuthUserDto User);
