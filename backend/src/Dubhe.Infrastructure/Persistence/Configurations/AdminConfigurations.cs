using Dubhe.Domain.Admin;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dubhe.Infrastructure.Persistence.Configurations;

public sealed class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("AuditLogs", "admin");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Username).HasMaxLength(64);
        builder.Property(x => x.Module).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Action).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Detail).HasColumnType("jsonb");
        builder.Property(x => x.Ip).HasMaxLength(64);
        builder.HasIndex(x => x.CreatedAt);
        builder.HasIndex(x => x.UserId);
    }
}
