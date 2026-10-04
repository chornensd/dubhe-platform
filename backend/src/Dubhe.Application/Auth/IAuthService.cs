using Dubhe.Application.Auth.Dtos;

namespace Dubhe.Application.Auth;

public interface IAuthService
{
    Task<AuthUserDto> RegisterAsync(RegisterRequest request, CancellationToken ct = default);
    Task<AuthResultDto> LoginAsync(LoginRequest request, CancellationToken ct = default);
    Task<AuthResultDto> RefreshAsync(RefreshRequest request, CancellationToken ct = default);
    Task LogoutAsync(LogoutRequest request, CancellationToken ct = default);
    Task<AuthUserDto> GetCurrentUserAsync(Guid userId, CancellationToken ct = default);
}
