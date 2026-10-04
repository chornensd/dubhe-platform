using Dubhe.Domain.Airspace;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dubhe.Infrastructure.Persistence.Configurations;

public sealed class AirspaceZoneConfiguration : IEntityTypeConfiguration<AirspaceZone>
{
    public void Configure(EntityTypeBuilder<AirspaceZone> builder)
    {
        builder.ToTable("AirspaceZones", "airspace");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Code).HasMaxLength(32).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Reason).HasMaxLength(256);
        builder.HasIndex(x => x.Code).IsUnique();
        builder.HasIndex(x => x.Type);
        builder.HasIndex(x => x.IsActive);
        builder.HasIndex(x => x.MerchantId);
    }
}

public sealed class FlightPlanConfiguration : IEntityTypeConfiguration<FlightPlan>
{
    public void Configure(EntityTypeBuilder<FlightPlan> builder)
    {
        builder.ToTable("FlightPlans", "airspace");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.PlanNo).HasMaxLength(32);
        builder.Property(x => x.Purpose).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Waypoints).HasColumnType("jsonb").IsRequired();
        builder.Property(x => x.CheckResult).HasColumnType("jsonb");
        builder.Property(x => x.ApprovalComment).HasMaxLength(256);
        builder.Property(x => x.RejectReason).HasMaxLength(256);
        builder.HasIndex(x => x.PlanNo).IsUnique().HasFilter("plan_no IS NOT NULL");
        builder.HasIndex(x => x.MerchantId);
        builder.HasIndex(x => x.DroneId);
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.StartAt);
    }
}

public sealed class ViolationRecordConfiguration : IEntityTypeConfiguration<ViolationRecord>
{
    public void Configure(EntityTypeBuilder<ViolationRecord> builder)
    {
        builder.ToTable("ViolationRecords", "airspace");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Description).HasMaxLength(1024).IsRequired();
        builder.Property(x => x.Resolution).HasMaxLength(1024);
        builder.HasIndex(x => x.MerchantId);
        builder.HasIndex(x => x.DroneId);
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.Type);
        builder.HasIndex(x => x.OccurredAt);
    }
}

public sealed class PenaltyRecordConfiguration : IEntityTypeConfiguration<PenaltyRecord>
{
    public void Configure(EntityTypeBuilder<PenaltyRecord> builder)
    {
        builder.ToTable("PenaltyRecords", "airspace");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Reason).HasMaxLength(256).IsRequired();
        builder.Property(x => x.FineAmount).HasPrecision(12, 2);
        builder.HasIndex(x => x.ViolationId);
        builder.HasIndex(x => x.MerchantId);
    }
}
