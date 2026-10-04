using Dubhe.Application.Support;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Dubhe.Infrastructure.BackgroundJobs;

public sealed class ReminderBackgroundService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<ReminderBackgroundService> _logger;

    public ReminderBackgroundService(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILogger<ReminderBackgroundService> logger)
    {
        _scopeFactory = scopeFactory;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var initialDelaySeconds = Math.Clamp(_configuration.GetValue("Reminders:InitialDelaySeconds", 15), 0, 600);
        var intervalHours = Math.Clamp(_configuration.GetValue("Reminders:IntervalHours", 6), 1, 72);

        try
        {
            await Task.Delay(TimeSpan.FromSeconds(initialDelaySeconds), stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        using var timer = new PeriodicTimer(TimeSpan.FromHours(intervalHours));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var reminderService = scope.ServiceProvider.GetRequiredService<IReminderService>();
                var result = await reminderService.RunAsync(stoppingToken);
                _logger.LogInformation(
                    "到期提醒扫描完成：资质 {Qualification} 条，维保 {Maintenance} 条",
                    result.QualificationReminders,
                    result.MaintenanceReminders);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "到期提醒扫描失败");
            }

            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken))
                {
                    break;
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }
}
