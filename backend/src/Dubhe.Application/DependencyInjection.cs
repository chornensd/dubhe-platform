using Dubhe.Application.Admin;
using Dubhe.Application.Agent;
using Dubhe.Application.Airspace;
using Dubhe.Application.Auth;
using Dubhe.Application.Common;
using Dubhe.Application.Config;
using Dubhe.Application.Orders;
using Dubhe.Application.Report;
using Dubhe.Application.Resource;
using Dubhe.Application.Support;
using Dubhe.Application.Users;
using Microsoft.Extensions.DependencyInjection;

namespace Dubhe.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IRoleAdminService, RoleAdminService>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<IAutoAcceptService, AutoAcceptService>();
        services.AddScoped<IPaymentService, PaymentService>();
        services.AddScoped<ISettlementService, SettlementService>();
        services.AddScoped<IInvoiceService, InvoiceService>();
        services.AddScoped<IDroneService, DroneService>();
        services.AddScoped<IStationService, StationService>();
        services.AddScoped<ICrewService, CrewService>();
        services.AddScoped<IMaintenanceService, MaintenanceService>();
        services.AddScoped<IFaultService, FaultService>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<IReminderService, ReminderService>();
        services.AddScoped<IEmergencyService, EmergencyService>();
        services.AddScoped<ITicketService, TicketService>();
        services.AddScoped<IHelpService, HelpService>();
        services.AddScoped<IAirspaceCheckService, AirspaceCheckService>();
        services.AddScoped<IAirspaceZoneService, AirspaceZoneService>();
        services.AddScoped<IFlightPlanService, FlightPlanService>();
        services.AddScoped<IViolationService, ViolationService>();
        services.AddScoped<IMonitoringService, MonitoringService>();
        services.AddScoped<IAgentService, AgentService>();
        services.AddScoped<IReportService, ReportService>();
        services.AddScoped<IReportTemplateService, ReportTemplateService>();
        services.AddScoped<IReportShareService, ReportShareService>();
        services.AddScoped<IConfigService, ConfigService>();
        services.AddScoped<IEndpointService, EndpointService>();
        services.AddScoped<IBackupService, BackupService>();
        services.AddScoped<ILogQueryService, LogQueryService>();
        services.AddScoped<IServiceAreaService, ServiceAreaService>();
        services.AddScoped<MerchantContext>();
        services.AddScoped<FeeCalculator>();
        services.AddScoped<UserMapper>();
        return services;
    }
}
