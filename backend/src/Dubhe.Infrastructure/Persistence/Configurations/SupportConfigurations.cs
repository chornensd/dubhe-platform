using Dubhe.Domain.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dubhe.Infrastructure.Persistence.Configurations;

public sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("Notifications", "support");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Content).HasMaxLength(1024).IsRequired();
        builder.Property(x => x.DedupeKey).HasMaxLength(128);
        builder.HasIndex(x => x.UserId);
        builder.HasIndex(x => x.DedupeKey).IsUnique().HasFilter("dedupe_key IS NOT NULL");
        builder.HasIndex(x => new { x.UserId, x.IsRead });
    }
}

public sealed class EmergencyAlertConfiguration : IEntityTypeConfiguration<EmergencyAlert>
{
    public void Configure(EntityTypeBuilder<EmergencyAlert> builder)
    {
        builder.ToTable("EmergencyAlerts", "support");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Content).HasMaxLength(2000).IsRequired();
        builder.Property(x => x.Source).HasMaxLength(32).IsRequired();
        builder.Property(x => x.Handlers).HasColumnType("jsonb");
        builder.Property(x => x.DisposalPlan).HasMaxLength(1000);
        builder.Property(x => x.Result).HasMaxLength(1000);
        builder.HasIndex(x => x.Level);
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.MerchantId);
        builder.HasIndex(x => x.ReportedAt);
    }
}

public sealed class EmergencyTimelineEntryConfiguration : IEntityTypeConfiguration<EmergencyTimelineEntry>
{
    public void Configure(EntityTypeBuilder<EmergencyTimelineEntry> builder)
    {
        builder.ToTable("EmergencyTimelineEntries", "support");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Action).HasMaxLength(32).IsRequired();
        builder.Property(x => x.Note).HasMaxLength(1000);
        builder.Property(x => x.Attachments).HasColumnType("jsonb");
        builder.HasIndex(x => x.AlertId);
        builder.HasOne<EmergencyAlert>()
            .WithMany()
            .HasForeignKey(x => x.AlertId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ServiceTicketConfiguration : IEntityTypeConfiguration<ServiceTicket>
{
    public void Configure(EntityTypeBuilder<ServiceTicket> builder)
    {
        builder.ToTable("ServiceTickets", "support");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.TicketNo).HasMaxLength(32).IsRequired();
        builder.Property(x => x.Title).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Content).HasMaxLength(2000).IsRequired();
        builder.Property(x => x.Attachments).HasColumnType("jsonb");
        builder.Property(x => x.SatisfactionComment).HasMaxLength(512);
        builder.HasIndex(x => x.TicketNo).IsUnique();
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.SubmitterUserId);
        builder.HasIndex(x => x.MerchantId);
        builder.HasIndex(x => x.AssigneeUserId);
        builder.HasMany(x => x.Replies)
            .WithOne()
            .HasForeignKey(x => x.TicketId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class TicketReplyConfiguration : IEntityTypeConfiguration<TicketReply>
{
    public void Configure(EntityTypeBuilder<TicketReply> builder)
    {
        builder.ToTable("TicketReplies", "support");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Content).HasMaxLength(2000).IsRequired();
        builder.HasIndex(x => x.TicketId);
    }
}

public sealed class CannedResponseConfiguration : IEntityTypeConfiguration<CannedResponse>
{
    public void Configure(EntityTypeBuilder<CannedResponse> builder)
    {
        builder.ToTable("CannedResponses", "support");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Content).HasMaxLength(1000).IsRequired();
        builder.Property(x => x.Category).HasMaxLength(64);
        builder.HasIndex(x => x.OwnerUserId);
    }
}

public sealed class HelpArticleConfiguration : IEntityTypeConfiguration<HelpArticle>
{
    public void Configure(EntityTypeBuilder<HelpArticle> builder)
    {
        builder.ToTable("HelpArticles", "support");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Category).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Tags).HasMaxLength(256);
        builder.Property(x => x.VideoUrl).HasMaxLength(512);
        builder.Property(x => x.Content).IsRequired();
        builder.HasIndex(x => x.Category);
        builder.HasIndex(x => x.IsPublished);
    }
}
