using Dubhe.Domain.Order;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dubhe.Infrastructure.Persistence.Configurations;

public sealed class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("Payments", "biz");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Amount).HasPrecision(12, 2);
        builder.Property(x => x.TransactionNo).HasMaxLength(64);
        builder.Property(x => x.FailureReason).HasMaxLength(256);
        builder.Property(x => x.RefundReason).HasMaxLength(256);
        builder.HasIndex(x => x.OrderId);
        builder.HasIndex(x => x.Status);
    }
}

public sealed class SettlementStatementConfiguration : IEntityTypeConfiguration<SettlementStatement>
{
    public void Configure(EntityTypeBuilder<SettlementStatement> builder)
    {
        builder.ToTable("SettlementStatements", "biz");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.StatementNo).HasMaxLength(32).IsRequired();
        builder.Property(x => x.TotalAmount).HasPrecision(14, 2);
        builder.Property(x => x.CommissionRate).HasPrecision(6, 4);
        builder.Property(x => x.CommissionAmount).HasPrecision(14, 2);
        builder.Property(x => x.NetAmount).HasPrecision(14, 2);
        builder.Property(x => x.Remark).HasMaxLength(256);
        builder.HasIndex(x => x.StatementNo).IsUnique();
        builder.HasIndex(x => x.MerchantId);
        builder.HasIndex(x => x.Status);
    }
}

public sealed class SettlementStatementItemConfiguration : IEntityTypeConfiguration<SettlementStatementItem>
{
    public void Configure(EntityTypeBuilder<SettlementStatementItem> builder)
    {
        builder.ToTable("SettlementStatementItems", "biz");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.OrderNo).HasMaxLength(32).IsRequired();
        builder.Property(x => x.TotalAmount).HasPrecision(12, 2);
        builder.Property(x => x.CommissionAmount).HasPrecision(12, 2);
        builder.Property(x => x.NetAmount).HasPrecision(12, 2);
        builder.HasIndex(x => x.StatementId);
        builder.HasIndex(x => x.OrderId);
        builder.HasOne<SettlementStatement>()
            .WithMany()
            .HasForeignKey(x => x.StatementId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class InvoiceApplicationConfiguration : IEntityTypeConfiguration<InvoiceApplication>
{
    public void Configure(EntityTypeBuilder<InvoiceApplication> builder)
    {
        builder.ToTable("InvoiceApplications", "biz");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).HasMaxLength(128).IsRequired();
        builder.Property(x => x.TaxNo).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Amount).HasPrecision(14, 2);
        builder.Property(x => x.OrderIds).HasColumnType("jsonb").IsRequired();
        builder.Property(x => x.InvoiceNo).HasMaxLength(64);
        builder.Property(x => x.FileUrl).HasMaxLength(512);
        builder.Property(x => x.RejectedReason).HasMaxLength(256);
        builder.Property(x => x.Remark).HasMaxLength(256);
        builder.HasIndex(x => x.ApplicantUserId);
        builder.HasIndex(x => x.MerchantId);
        builder.HasIndex(x => x.Status);
    }
}
