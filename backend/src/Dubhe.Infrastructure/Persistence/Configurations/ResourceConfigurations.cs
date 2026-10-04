using Dubhe.Domain.Resource;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dubhe.Infrastructure.Persistence.Configurations;

public sealed class DroneConfiguration : IEntityTypeConfiguration<Drone>
{
    public void Configure(EntityTypeBuilder<Drone> builder)
    {
        builder.ToTable("Drones", "resource");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.SerialNo).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Model).HasMaxLength(64).IsRequired();
        builder.Property(x => x.MaxPayloadKg).HasPrecision(10, 2);
        builder.HasIndex(x => x.SerialNo).IsUnique();
        builder.HasIndex(x => x.MerchantId);
        builder.HasIndex(x => x.Status);
    }
}
