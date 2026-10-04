using Dubhe.Domain.Config;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dubhe.Infrastructure.Persistence.Configurations;

public sealed class SystemConfigItemConfiguration : IEntityTypeConfiguration<SystemConfigItem>
{
    public void Configure(EntityTypeBuilder<SystemConfigItem> builder)
    {
        builder.ToTable("SystemConfigs", "config");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Key).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Value).HasMaxLength(512).IsRequired();
        builder.Property(x => x.Group).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(256);
        builder.Property(x => x.ValueType).HasMaxLength(16).IsRequired();
        builder.HasIndex(x => x.Key).IsUnique();
        builder.HasIndex(x => x.Group);
    }
}

public sealed class ExternalEndpointConfiguration : IEntityTypeConfiguration<ExternalEndpoint>
{
    public void Configure(EntityTypeBuilder<ExternalEndpoint> builder)
    {
        builder.ToTable("ExternalEndpoints", "config");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Url).HasMaxLength(512).IsRequired();
        builder.Property(x => x.Method).HasMaxLength(8).IsRequired();
        builder.Property(x => x.Headers).HasColumnType("jsonb");
        builder.HasIndex(x => x.Name);
    }
}

public sealed class InterfaceCallLogConfiguration : IEntityTypeConfiguration<InterfaceCallLog>
{
    public void Configure(EntityTypeBuilder<InterfaceCallLog> builder)
    {
        builder.ToTable("InterfaceCallLogs", "config");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.EndpointName).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Url).HasMaxLength(512).IsRequired();
        builder.Property(x => x.Method).HasMaxLength(8).IsRequired();
        builder.Property(x => x.Error).HasMaxLength(512);
        builder.HasIndex(x => x.EndpointId);
        builder.HasIndex(x => x.CreatedAt);
    }
}

public sealed class BackupRecordConfiguration : IEntityTypeConfiguration<BackupRecord>
{
    public void Configure(EntityTypeBuilder<BackupRecord> builder)
    {
        builder.ToTable("BackupRecords", "config");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.FileName).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Scope).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Status).HasMaxLength(16).IsRequired();
        builder.Property(x => x.Error).HasMaxLength(512);
        builder.HasIndex(x => x.CreatedAt);
    }
}
