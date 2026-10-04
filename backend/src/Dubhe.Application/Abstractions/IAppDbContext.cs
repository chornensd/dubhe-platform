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

namespace Dubhe.Application.Abstractions;

public interface IAppDbContext
{
    DbSet<User> Users { get; }
    DbSet<Role> Roles { get; }
    DbSet<Permission> Permissions { get; }
    DbSet<UserRole> UserRoles { get; }
    DbSet<RolePermission> RolePermissions { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<Order> Orders { get; }
    DbSet<OrderStatusHistory> OrderStatusHistories { get; }
    DbSet<ServiceArea> ServiceAreas { get; }
    DbSet<AutoAcceptRule> AutoAcceptRules { get; }
    DbSet<Payment> Payments { get; }
    DbSet<SettlementStatement> SettlementStatements { get; }
    DbSet<SettlementStatementItem> SettlementStatementItems { get; }
    DbSet<InvoiceApplication> InvoiceApplications { get; }
    DbSet<Drone> Drones { get; }
    DbSet<AirspaceZone> AirspaceZones { get; }
    DbSet<FlightPlan> FlightPlans { get; }
    DbSet<ViolationRecord> ViolationRecords { get; }
    DbSet<PenaltyRecord> PenaltyRecords { get; }
    DbSet<KnowledgeDoc> KnowledgeDocs { get; }
    DbSet<AgentTask> AgentTasks { get; }
    DbSet<AgentProtocol> AgentProtocols { get; }
    DbSet<ReportTemplate> ReportTemplates { get; }
    DbSet<ReportShare> ReportShares { get; }
    DbSet<EmergencyAlert> EmergencyAlerts { get; }
    DbSet<EmergencyTimelineEntry> EmergencyTimelineEntries { get; }
    DbSet<ServiceTicket> ServiceTickets { get; }
    DbSet<TicketReply> TicketReplies { get; }
    DbSet<CannedResponse> CannedResponses { get; }
    DbSet<HelpArticle> HelpArticles { get; }
    DbSet<SystemConfigItem> SystemConfigItems { get; }
    DbSet<ExternalEndpoint> ExternalEndpoints { get; }
    DbSet<InterfaceCallLog> InterfaceCallLogs { get; }
    DbSet<BackupRecord> BackupRecords { get; }
    DbSet<Station> Stations { get; }
    DbSet<StationReservation> StationReservations { get; }
    DbSet<CrewMember> CrewMembers { get; }
    DbSet<CrewQualification> CrewQualifications { get; }
    DbSet<CrewSchedule> CrewSchedules { get; }
    DbSet<CrewAttendance> CrewAttendances { get; }
    DbSet<MaintenancePlan> MaintenancePlans { get; }
    DbSet<MaintenanceRecord> MaintenanceRecords { get; }
    DbSet<DroneFault> DroneFaults { get; }
    DbSet<Notification> Notifications { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
