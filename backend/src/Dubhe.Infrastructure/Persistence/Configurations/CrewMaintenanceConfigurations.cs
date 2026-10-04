using Dubhe.Domain.Resource;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dubhe.Infrastructure.Persistence.Configurations;

public sealed class CrewMemberConfiguration : IEntityTypeConfiguration<CrewMember>
{
    public void Configure(EntityTypeBuilder<CrewMember> builder)
    {
        builder.ToTable("CrewMembers", "resource");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Gender).HasMaxLength(8);
        builder.Property(x => x.Phone).HasMaxLength(20).IsRequired();
        builder.Property(x => x.Region).HasMaxLength(128);
        builder.HasIndex(x => x.MerchantId);
        builder.HasIndex(x => new { x.MerchantId, x.Phone });
    }
}

public sealed class CrewQualificationConfiguration : IEntityTypeConfiguration<CrewQualification>
{
    public void Configure(EntityTypeBuilder<CrewQualification> builder)
    {
        builder.ToTable("CrewQualifications", "resource");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Type).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Number).HasMaxLength(64).IsRequired();
        builder.Property(x => x.FileUrl).HasMaxLength(512);
        builder.HasIndex(x => x.CrewMemberId);
        builder.HasIndex(x => x.ExpiresAt);
        builder.HasOne<CrewMember>()
            .WithMany()
            .HasForeignKey(x => x.CrewMemberId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class CrewScheduleConfiguration : IEntityTypeConfiguration<CrewSchedule>
{
    public void Configure(EntityTypeBuilder<CrewSchedule> builder)
    {
        builder.ToTable("CrewSchedules", "resource");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Area).HasMaxLength(128);
        builder.Property(x => x.Remark).HasMaxLength(256);
        builder.HasIndex(x => new { x.CrewMemberId, x.StartAt });
        builder.HasIndex(x => x.MerchantId);
        builder.HasOne<CrewMember>()
            .WithMany()
            .HasForeignKey(x => x.CrewMemberId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class CrewAttendanceConfiguration : IEntityTypeConfiguration<CrewAttendance>
{
    public void Configure(EntityTypeBuilder<CrewAttendance> builder)
    {
        builder.ToTable("CrewAttendances", "resource");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Remark).HasMaxLength(256);
        builder.HasIndex(x => new { x.CrewMemberId, x.Date }).IsUnique();
        builder.HasIndex(x => x.MerchantId);
        builder.HasOne<CrewMember>()
            .WithMany()
            .HasForeignKey(x => x.CrewMemberId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class MaintenancePlanConfiguration : IEntityTypeConfiguration<MaintenancePlan>
{
    public void Configure(EntityTypeBuilder<MaintenancePlan> builder)
    {
        builder.ToTable("MaintenancePlans", "resource");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Remark).HasMaxLength(256);
        builder.HasIndex(x => x.DroneId).IsUnique();
        builder.HasIndex(x => x.MerchantId);
    }
}

public sealed class MaintenanceRecordConfiguration : IEntityTypeConfiguration<MaintenanceRecord>
{
    public void Configure(EntityTypeBuilder<MaintenanceRecord> builder)
    {
        builder.ToTable("MaintenanceRecords", "resource");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Type).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Content).HasMaxLength(1024).IsRequired();
        builder.Property(x => x.FileUrl).HasMaxLength(512);
        builder.HasIndex(x => x.DroneId);
        builder.HasIndex(x => x.MerchantId);
        builder.HasIndex(x => x.MaintainedAt);
    }
}

public sealed class DroneFaultConfiguration : IEntityTypeConfiguration<DroneFault>
{
    public void Configure(EntityTypeBuilder<DroneFault> builder)
    {
        builder.ToTable("DroneFaults", "resource");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.FaultType).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(1024).IsRequired();
        builder.Property(x => x.PhotoUrls).HasColumnType("jsonb");
        builder.Property(x => x.Resolution).HasMaxLength(1024);
        builder.HasIndex(x => x.DroneId);
        builder.HasIndex(x => x.MerchantId);
        builder.HasIndex(x => x.Status);
    }
}
