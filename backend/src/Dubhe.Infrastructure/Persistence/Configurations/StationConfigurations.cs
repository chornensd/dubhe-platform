using Dubhe.Domain.Resource;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dubhe.Infrastructure.Persistence.Configurations;

public sealed class StationConfiguration : IEntityTypeConfiguration<Station>
{
    public void Configure(EntityTypeBuilder<Station> builder)
    {
        builder.ToTable("Stations", "resource");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Address).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Remark).HasMaxLength(512);
        builder.HasIndex(x => new { x.MerchantId, x.Name }).IsUnique();
        builder.HasIndex(x => x.Status);
    }
}

public sealed class StationReservationConfiguration : IEntityTypeConfiguration<StationReservation>
{
    public void Configure(EntityTypeBuilder<StationReservation> builder)
    {
        builder.ToTable("StationReservations", "resource");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Remark).HasMaxLength(512);
        builder.HasIndex(x => new { x.StationId, x.StartAt });
        builder.HasIndex(x => x.MerchantId);
        builder.HasOne<Station>()
            .WithMany()
            .HasForeignKey(x => x.StationId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
