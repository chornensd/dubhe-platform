using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Dubhe.Application.Common;
using Dubhe.Domain.Auth;
using Dubhe.Infrastructure.Auth;
using Microsoft.Extensions.Options;

namespace Dubhe.Tests.Auth;

public class JwtTokenServiceTests
{
    private static JwtTokenService CreateService() => new(Options.Create(new JwtOptions
    {
        Issuer = "Dubhe",
        Audience = "DubheClients",
        SigningKey = "unit-test-signing-key-at-least-32-characters",
        PcAccessTokenHours = 8,
        MobileAccessTokenHours = 2,
        RefreshTokenDays = 7
    }));

    private static User CreateUser() => new()
    {
        Id = Guid.NewGuid(),
        Username = "tester",
        DisplayName = "Tester"
    };

    [Fact]
    public void PcToken_Should_Contain_Claims_And_Expire_In_8_Hours()
    {
        var service = CreateService();
        var result = service.CreateAccessToken(
            CreateUser(),
            new[] { RoleCodes.Customer },
            new[] { "order.read" },
            DeviceType.Pc);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(result.AccessToken);

        Assert.Equal("tester", jwt.Claims.First(c => c.Type == JwtRegisteredClaimNames.UniqueName).Value);
        Assert.Contains(jwt.Claims, c => c.Type == ClaimTypes.Role && c.Value == RoleCodes.Customer);
        Assert.Contains(jwt.Claims, c => c.Type == "perm" && c.Value == "order.read");
        Assert.Contains(jwt.Claims, c => c.Type == "device" && c.Value == nameof(DeviceType.Pc));

        var expected = DateTimeOffset.UtcNow.AddHours(8);
        Assert.True(Math.Abs((result.ExpiresAt - expected).TotalMinutes) < 2);
    }

    [Fact]
    public void MobileToken_Should_Expire_In_2_Hours()
    {
        var service = CreateService();
        var result = service.CreateAccessToken(
            CreateUser(),
            new[] { RoleCodes.Customer },
            Array.Empty<string>(),
            DeviceType.Mobile);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(result.AccessToken);

        Assert.Contains(jwt.Claims, c => c.Type == "device" && c.Value == nameof(DeviceType.Mobile));

        var expected = DateTimeOffset.UtcNow.AddHours(2);
        Assert.True(Math.Abs((result.ExpiresAt - expected).TotalMinutes) < 2);
    }
}
