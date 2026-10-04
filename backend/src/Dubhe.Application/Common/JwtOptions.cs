namespace Dubhe.Application.Common;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "Dubhe";
    public string Audience { get; set; } = "DubheClients";
    public string SigningKey { get; set; } = string.Empty;
    public int PcAccessTokenHours { get; set; } = 8;
    public int MobileAccessTokenHours { get; set; } = 2;
    public int RefreshTokenDays { get; set; } = 7;
}
