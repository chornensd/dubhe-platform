using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Dubhe.Application.Abstractions;
using Dubhe.Application.Auth.Dtos;
using Dubhe.Application.Common;
using Dubhe.Application.Users;
using Dubhe.Domain.Auth;
using Dubhe.Domain.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Dubhe.Application.Auth;

public sealed class AuthService : IAuthService
{
    private const int MaxFailedAttempts = 5;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);
    private static readonly Regex UsernamePattern = new("^[A-Za-z0-9_]{3,32}$", RegexOptions.Compiled);
    private static readonly Regex PhonePattern = new("^1[3-9]\\d{9}$", RegexOptions.Compiled);

    private readonly IAppDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly IClientContext _client;
    private readonly IDateTime _clock;
    private readonly JwtOptions _jwtOptions;
    private readonly UserMapper _userMapper;

    public AuthService(
        IAppDbContext db,
        IPasswordHasher passwordHasher,
        IJwtTokenService jwtTokenService,
        IClientContext client,
        IDateTime clock,
        IOptions<JwtOptions> jwtOptions,
        UserMapper userMapper)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _jwtTokenService = jwtTokenService;
        _client = client;
        _clock = clock;
        _jwtOptions = jwtOptions.Value;
        _userMapper = userMapper;
    }

    public async Task<AuthUserDto> RegisterAsync(RegisterRequest request, CancellationToken ct = default)
    {
        ValidateRegistration(request);

        var username = request.Username.Trim();
        var phone = request.Phone.Trim();

        var exists = await _db.Users.AnyAsync(u => u.Username == username || u.Phone == phone, ct);
        if (exists)
        {
            throw new AppException(ErrorCodes.UserExists, "账号或手机号已被注册");
        }

        var userType = (UserType)request.UserType;
        var roleCode = userType == UserType.Merchant ? RoleCodes.Merchant : RoleCodes.Customer;
        var role = await _db.Roles.FirstOrDefaultAsync(r => r.Code == roleCode, ct)
            ?? throw new AppException(ErrorCodes.InternalError, $"默认角色 {roleCode} 未初始化");

        var user = new User
        {
            Username = username,
            Phone = phone,
            PasswordHash = _passwordHasher.Hash(request.Password),
            DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? username : request.DisplayName.Trim(),
            UserType = userType,
            Status = userType is UserType.Merchant or UserType.EnterpriseCustomer
                ? AccountStatus.PendingReview
                : AccountStatus.Active,
            CompanyName = string.IsNullOrWhiteSpace(request.CompanyName) ? null : request.CompanyName.Trim()
        };

        _db.Users.Add(user);
        _db.UserRoles.Add(new UserRole { User = user, Role = role });
        await _db.SaveChangesAsync(ct);

        return await _userMapper.ToAuthUserAsync(user, ct);
    }

    public async Task<AuthResultDto> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Account) || string.IsNullOrEmpty(request.Password))
        {
            throw AppException.Validation("账号和密码不能为空");
        }

        var account = request.Account.Trim();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == account || u.Phone == account, ct);
        if (user is null)
        {
            throw new AppException(ErrorCodes.InvalidCredentials, "账号或密码错误");
        }

        var now = _clock.UtcNow;
        if (user.LockoutEndAt is { } lockoutEnd && lockoutEnd > now)
        {
            throw new AppException(ErrorCodes.AccountLocked, $"账号已锁定，请于 {lockoutEnd.LocalDateTime:HH:mm} 后重试");
        }

        EnsureActive(user);

        if (!_passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            user.FailedLoginCount++;
            if (user.FailedLoginCount >= MaxFailedAttempts)
            {
                user.LockoutEndAt = now.Add(LockoutDuration);
                user.FailedLoginCount = 0;
                await _db.SaveChangesAsync(ct);
                throw new AppException(ErrorCodes.AccountLocked, "密码连续错误 5 次，账号已锁定 15 分钟");
            }

            await _db.SaveChangesAsync(ct);
            throw new AppException(ErrorCodes.InvalidCredentials, "账号或密码错误");
        }

        user.FailedLoginCount = 0;
        user.LockoutEndAt = null;
        user.LastLoginAt = now;

        var result = await IssueTokensAsync(user, ct);
        await _db.SaveChangesAsync(ct);
        return result;
    }

    public async Task<AuthResultDto> RefreshAsync(RefreshRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            throw AppException.Validation("refreshToken 不能为空");
        }

        var hash = HashToken(request.RefreshToken);
        var token = await _db.RefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == hash, ct);

        if (token is null || token.RevokedAt is not null || token.ExpiresAt <= _clock.UtcNow)
        {
            throw new AppException(ErrorCodes.RefreshTokenInvalid, "刷新令牌无效或已过期");
        }

        EnsureActive(token.User);

        token.RevokedAt = _clock.UtcNow;
        var result = await IssueTokensAsync(token.User, ct);
        token.ReplacedByTokenHash = HashToken(result.RefreshToken);
        await _db.SaveChangesAsync(ct);
        return result;
    }

    public async Task LogoutAsync(LogoutRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return;
        }

        var hash = HashToken(request.RefreshToken);
        var token = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (token is not null && token.RevokedAt is null)
        {
            token.RevokedAt = _clock.UtcNow;
            await _db.SaveChangesAsync(ct);
        }
    }

    public async Task<AuthUserDto> GetCurrentUserAsync(Guid userId, CancellationToken ct = default)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw AppException.NotFound("用户不存在");
        return await _userMapper.ToAuthUserAsync(user, ct);
    }

    private async Task<AuthResultDto> IssueTokensAsync(User user, CancellationToken ct)
    {
        var (roles, permissions) = await _userMapper.LoadAsync(user.Id, ct);
        var device = _client.DeviceType == DeviceType.Unknown ? DeviceType.Pc : _client.DeviceType;

        var access = _jwtTokenService.CreateAccessToken(user, roles, permissions, device);
        var refreshRaw = GenerateRefreshToken();
        var refreshExpiresAt = _clock.UtcNow.AddDays(_jwtOptions.RefreshTokenDays);

        _db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = HashToken(refreshRaw),
            DeviceType = device,
            ExpiresAt = refreshExpiresAt,
            CreatedByIp = _client.Ip
        });

        var userDto = _userMapper.Map(user, roles, permissions);
        return new AuthResultDto(access.AccessToken, access.ExpiresAt, refreshRaw, refreshExpiresAt, userDto);
    }

    private static void ValidateRegistration(RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || !UsernamePattern.IsMatch(request.Username.Trim()))
        {
            throw AppException.Validation("用户名需为 3-32 位字母、数字或下划线");
        }

        if (string.IsNullOrWhiteSpace(request.Phone) || !PhonePattern.IsMatch(request.Phone.Trim()))
        {
            throw AppException.Validation("手机号格式不正确");
        }

        if (!IsStrongPassword(request.Password))
        {
            throw AppException.Validation("密码至少 8 位且需同时包含字母和数字");
        }

        if (!Enum.IsDefined(typeof(UserType), request.UserType) ||
            request.UserType is not ((int)UserType.IndividualCustomer) and not ((int)UserType.EnterpriseCustomer) and not ((int)UserType.Merchant))
        {
            throw AppException.Validation("仅支持注册个人客户、企业客户或商家账号");
        }

        if ((request.UserType == (int)UserType.Merchant || request.UserType == (int)UserType.EnterpriseCustomer)
            && string.IsNullOrWhiteSpace(request.CompanyName))
        {
            throw AppException.Validation("企业客户/商家必须填写企业名称");
        }
    }

    private static bool IsStrongPassword(string password)
    {
        if (string.IsNullOrEmpty(password) || password.Length < 8)
        {
            return false;
        }

        var hasLetter = password.Any(char.IsLetter);
        var hasDigit = password.Any(char.IsDigit);
        return hasLetter && hasDigit;
    }

    private static void EnsureActive(User user)
    {
        switch (user.Status)
        {
            case AccountStatus.Active:
                return;
            case AccountStatus.PendingReview:
                throw new AppException(ErrorCodes.AccountPendingReview, "账号正在审核中，请等待审核通过");
            case AccountStatus.Rejected:
                throw new AppException(ErrorCodes.AccountRejected, "账号审核未通过，请联系管理员");
            default:
                throw new AppException(ErrorCodes.AccountFrozen, "账号已被冻结，请联系管理员");
        }
    }

    private static string GenerateRefreshToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(48);
        return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").TrimEnd('=');
    }

    private static string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
