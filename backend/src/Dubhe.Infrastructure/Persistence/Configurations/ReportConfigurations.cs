using Dubhe.Domain.Report;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dubhe.Infrastructure.Persistence.Configurations;

public sealed class ReportTemplateConfiguration : IEntityTypeConfiguration<ReportTemplate>
{
    public void Configure(EntityTypeBuilder<ReportTemplate> builder)
    {
        builder.ToTable("ReportTemplates", "report");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.BusinessType).HasMaxLength(32).IsRequired();
        builder.Property(x => x.Fields).HasColumnType("jsonb").IsRequired();
        builder.Property(x => x.Filters).HasColumnType("jsonb").IsRequired();
        builder.Property(x => x.Remark).HasMaxLength(256);
        builder.HasIndex(x => x.OwnerUserId);
        builder.HasIndex(x => x.MerchantId);
    }
}

public sealed class ReportShareConfiguration : IEntityTypeConfiguration<ReportShare>
{
    public void Configure(EntityTypeBuilder<ReportShare> builder)
    {
        builder.ToTable("ReportShares", "report");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).HasMaxLength(128).IsRequired();
        builder.Property(x => x.BusinessType).HasMaxLength(32).IsRequired();
        builder.Property(x => x.Fields).HasColumnType("jsonb").IsRequired();
        builder.Property(x => x.Filters).HasColumnType("jsonb").IsRequired();
        builder.HasIndex(x => x.OwnerUserId);
        builder.HasIndex(x => x.RecipientUserId);
        builder.HasIndex(x => x.ExpireAt);
    }
}
