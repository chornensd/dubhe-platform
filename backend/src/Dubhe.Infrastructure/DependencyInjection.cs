using Dubhe.Application.Abstractions;
using Dubhe.Application.Common;
using Dubhe.Application.Config.Dtos;
using Dubhe.Application.Orders;
using Dubhe.Application.Orders.Dtos;
using Dubhe.Application.Report.Dtos;
using Dubhe.Infrastructure.Auth;
using Dubhe.Infrastructure.BackgroundJobs;
using Dubhe.Infrastructure.Excel;
using Dubhe.Infrastructure.Http;
using Dubhe.Infrastructure.Identity;
using Dubhe.Infrastructure.Persistence;
using Dubhe.Infrastructure.Persistence.Interceptors;
using Dubhe.Infrastructure.Time;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Dubhe.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Postgres")
            ?? throw new InvalidOperationException("缺少 ConnectionStrings:Postgres 配置");

        services.AddScoped<AuditableEntityInterceptor>();
        services.AddDbContext<DubheDbContext>((serviceProvider, options) =>
        {
            options.UseNpgsql(connectionString, npgsql =>
                npgsql.MigrationsHistoryTable("__ef_migrations_history"));
            options.AddInterceptors(serviceProvider.GetRequiredService<AuditableEntityInterceptor>());
        });
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<DubheDbContext>());

        services.AddOptions<JwtOptions>()
            .Bind(configuration.GetSection(JwtOptions.SectionName))
            .Validate(o => !string.IsNullOrWhiteSpace(o.SigningKey) && o.SigningKey.Length >= 32,
                "Jwt:SigningKey 长度至少 32 字符")
            .ValidateOnStart();

        services.AddOptions<PricingOptions>()
            .Bind(configuration.GetSection(PricingOptions.SectionName));

        services.AddOptions<SettlementOptions>()
            .Bind(configuration.GetSection(SettlementOptions.SectionName));

        services.AddOptions<AirspaceOptions>()
            .Bind(configuration.GetSection(AirspaceOptions.SectionName));

        services.AddOptions<BackupOptions>()
            .Bind(configuration.GetSection(BackupOptions.SectionName));

        services.AddHttpClient();
        services.AddSingleton<IEndpointTester, EndpointTester>();

        services.AddHttpContextAccessor();
        services.AddSingleton<IDateTime, SystemClock>();
        services.AddSingleton<IPasswordHasher, PasswordHasher>();
        services.AddSingleton<IJwtTokenService, JwtTokenService>();
        services.AddSingleton<IOrderExcelParser, OrderExcelParser>();
        services.AddSingleton<ISettlementExporter, SettlementExporter>();
        services.AddSingleton<IReportExporter, ReportExporter>();
        services.AddScoped<ICurrentUser, HttpContextCurrentUser>();
        services.AddScoped<IClientContext, HttpClientContext>();
        services.AddHostedService<ReminderBackgroundService>();

        return services;
    }
}
