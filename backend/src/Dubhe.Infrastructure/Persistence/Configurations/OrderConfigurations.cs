using Dubhe.Domain.Order;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dubhe.Infrastructure.Persistence.Configurations;

public sealed class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("Orders", "biz");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.OrderNo).HasMaxLength(32).IsRequired();
        builder.Property(x => x.SenderName).HasMaxLength(64).IsRequired();
        builder.Property(x => x.SenderPhone).HasMaxLength(20).IsRequired();
        builder.Property(x => x.SenderAddress).HasMaxLength(256).IsRequired();
        builder.Property(x => x.ReceiverName).HasMaxLength(64).IsRequired();
        builder.Property(x => x.ReceiverPhone).HasMaxLength(20).IsRequired();
        builder.Property(x => x.ReceiverAddress).HasMaxLength(256).IsRequired();
        builder.Property(x => x.ItemCategory).HasMaxLength(32).IsRequired();
        builder.Property(x => x.ItemName).HasMaxLength(128).IsRequired();
        builder.Property(x => x.WeightKg).HasPrecision(10, 2);
        builder.Property(x => x.VolumeM3).HasPrecision(10, 3);
        builder.Property(x => x.DistanceKm).HasPrecision(10, 2);
        builder.Property(x => x.BaseFee).HasPrecision(12, 2);
        builder.Property(x => x.DistanceFee).HasPrecision(12, 2);
        builder.Property(x => x.WeightFee).HasPrecision(12, 2);
        builder.Property(x => x.AirspaceFee).HasPrecision(12, 2);
        builder.Property(x => x.UrgentFee).HasPrecision(12, 2);
        builder.Property(x => x.DiscountAmount).HasPrecision(12, 2);
        builder.Property(x => x.TotalAmount).HasPrecision(12, 2);
        builder.Property(x => x.ComplianceProofUrl).HasMaxLength(512);
        builder.Property(x => x.Remark).HasMaxLength(512);
        builder.Property(x => x.CancelReason).HasMaxLength(256);
        builder.Property(x => x.DispatchRemark).HasMaxLength(256);
        builder.Property(x => x.PlannedRoute).HasColumnType("jsonb");
        builder.Property(x => x.ReviewComment).HasMaxLength(512);

        builder.HasIndex(x => x.OrderNo).IsUnique();
        builder.HasIndex(x => x.CustomerId);
        builder.HasIndex(x => x.MerchantId);
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.CreatedAt);
        builder.HasQueryFilter(x => !x.IsDeleted);
    }
}

public sealed class OrderStatusHistoryConfiguration : IEntityTypeConfiguration<OrderStatusHistory>
{
    public void Configure(EntityTypeBuilder<OrderStatusHistory> builder)
    {
        builder.ToTable("OrderStatusHistories", "biz");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Remark).HasMaxLength(256);
        builder.HasIndex(x => x.OrderId);
    }
}

public sealed class ServiceAreaConfiguration : IEntityTypeConfiguration<ServiceArea>
{
    public void Configure(EntityTypeBuilder<ServiceArea> builder)
    {
        builder.ToTable("ServiceAreas", "biz");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.HasIndex(x => x.MerchantId);
    }
}

public sealed class AutoAcceptRuleConfiguration : IEntityTypeConfiguration<AutoAcceptRule>
{
    public void Configure(EntityTypeBuilder<AutoAcceptRule> builder)
    {
        builder.ToTable("AutoAcceptRules", "biz");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.MaxWeightKg).HasPrecision(10, 2);
        builder.Property(x => x.MaxDistanceKm).HasPrecision(10, 2);
        builder.HasIndex(x => x.MerchantId).IsUnique();
    }
}
