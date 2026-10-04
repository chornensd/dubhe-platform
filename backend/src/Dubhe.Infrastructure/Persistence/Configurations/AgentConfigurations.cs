using Dubhe.Domain.Agent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Dubhe.Infrastructure.Persistence.Configurations;

public sealed class KnowledgeDocConfiguration : IEntityTypeConfiguration<KnowledgeDoc>
{
    public void Configure(EntityTypeBuilder<KnowledgeDoc> builder)
    {
        builder.ToTable("KnowledgeDocs", "agent");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Category).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Tags).HasMaxLength(256);
        builder.Property(x => x.Content).IsRequired();
        builder.Property(x => x.Version).HasMaxLength(32);
        builder.HasIndex(x => x.Category);
        builder.HasIndex(x => x.Title);
    }
}

public sealed class AgentTaskConfiguration : IEntityTypeConfiguration<AgentTask>
{
    public void Configure(EntityTypeBuilder<AgentTask> builder)
    {
        builder.ToTable("AgentTasks", "agent");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Title).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Input).IsRequired();
        builder.Property(x => x.Error).HasMaxLength(512);
        builder.HasIndex(x => x.Type);
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.CreatedAt);
    }
}

public sealed class AgentProtocolConfiguration : IEntityTypeConfiguration<AgentProtocol>
{
    public void Configure(EntityTypeBuilder<AgentProtocol> builder)
    {
        builder.ToTable("AgentProtocols", "agent");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Version).HasMaxLength(32).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(256);
        builder.Property(x => x.Content).HasColumnType("jsonb").IsRequired();
        builder.HasIndex(x => new { x.Name, x.Version }).IsUnique();
    }
}
