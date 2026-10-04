using Dubhe.Application.Abstractions;
using Dubhe.Domain.Admin;
using Dubhe.Domain.Agent;
using Dubhe.Domain.Airspace;
using Dubhe.Domain.Auth;
using Dubhe.Domain.Config;
using Dubhe.Domain.Order;
using Dubhe.Domain.Report;
using Dubhe.Domain.Resource;
using Dubhe.Domain.Support;
using Microsoft.EntityFrameworkCore;

namespace Dubhe.Infrastructure.Persistence;

public sealed class DubheDbContext : DbContext, IAppDbContext
{
    public DubheDbContext(DbContextOptions<DubheDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderStatusHistory> OrderStatusHistories => Set<OrderStatusHistory>();
    public DbSet<ServiceArea> ServiceAreas => Set<ServiceArea>();
    public DbSet<AutoAcceptRule> AutoAcceptRules => Set<AutoAcceptRule>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<SettlementStatement> SettlementStatements => Set<SettlementStatement>();
    public DbSet<SettlementStatementItem> SettlementStatementItems => Set<SettlementStatementItem>();
    public DbSet<InvoiceApplication> InvoiceApplications => Set<InvoiceApplication>();
    public DbSet<Drone> Drones => Set<Drone>();
    public DbSet<Station> Stations => Set<Station>();
    public DbSet<StationReservation> StationReservations => Set<StationReservation>();
    public DbSet<CrewMember> CrewMembers => Set<CrewMember>();
    public DbSet<CrewQualification> CrewQualifications => Set<CrewQualification>();
    public DbSet<CrewSchedule> CrewSchedules => Set<CrewSchedule>();
    public DbSet<CrewAttendance> CrewAttendances => Set<CrewAttendance>();
    public DbSet<MaintenancePlan> MaintenancePlans => Set<MaintenancePlan>();
    public DbSet<MaintenanceRecord> MaintenanceRecords => Set<MaintenanceRecord>();
    public DbSet<DroneFault> DroneFaults => Set<DroneFault>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AirspaceZone> AirspaceZones => Set<AirspaceZone>();
    public DbSet<FlightPlan> FlightPlans => Set<FlightPlan>();
    public DbSet<ViolationRecord> ViolationRecords => Set<ViolationRecord>();
    public DbSet<PenaltyRecord> PenaltyRecords => Set<PenaltyRecord>();
    public DbSet<KnowledgeDoc> KnowledgeDocs => Set<KnowledgeDoc>();
    public DbSet<AgentTask> AgentTasks => Set<AgentTask>();
    public DbSet<AgentProtocol> AgentProtocols => Set<AgentProtocol>();
    public DbSet<ReportTemplate> ReportTemplates => Set<ReportTemplate>();
    public DbSet<ReportShare> ReportShares => Set<ReportShare>();
    public DbSet<EmergencyAlert> EmergencyAlerts => Set<EmergencyAlert>();
    public DbSet<EmergencyTimelineEntry> EmergencyTimelineEntries => Set<EmergencyTimelineEntry>();
    public DbSet<ServiceTicket> ServiceTickets => Set<ServiceTicket>();
    public DbSet<TicketReply> TicketReplies => Set<TicketReply>();
    public DbSet<CannedResponse> CannedResponses => Set<CannedResponse>();
    public DbSet<HelpArticle> HelpArticles => Set<HelpArticle>();
    public DbSet<SystemConfigItem> SystemConfigItems => Set<SystemConfigItem>();
    public DbSet<ExternalEndpoint> ExternalEndpoints => Set<ExternalEndpoint>();
    public DbSet<InterfaceCallLog> InterfaceCallLogs => Set<InterfaceCallLog>();
    public DbSet<BackupRecord> BackupRecords => Set<BackupRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(DubheDbContext).Assembly);
        modelBuilder.UseSnakeCaseNames();
        base.OnModelCreating(modelBuilder);
    }
}
