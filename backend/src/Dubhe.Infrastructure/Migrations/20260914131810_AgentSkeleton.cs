using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dubhe.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AgentSkeleton : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "agent");

            migrationBuilder.CreateTable(
                name: "agent_protocols",
                schema: "agent",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    version = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    description = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    content = table.Column<string>(type: "jsonb", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_agent_protocols", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "agent_tasks",
                schema: "agent",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    title = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    input = table.Column<string>(type: "text", nullable: false),
                    output = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    error = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    finished_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    duration_ms = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_agent_tasks", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "knowledge_docs",
                schema: "agent",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    category = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    tags = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    content = table.Column<string>(type: "text", nullable: false),
                    version = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    is_published = table.Column<bool>(type: "boolean", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_knowledge_docs", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_agent_protocols_name_version",
                schema: "agent",
                table: "agent_protocols",
                columns: new[] { "name", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_agent_tasks_created_at",
                schema: "agent",
                table: "agent_tasks",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_agent_tasks_status",
                schema: "agent",
                table: "agent_tasks",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_agent_tasks_type",
                schema: "agent",
                table: "agent_tasks",
                column: "type");

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_docs_category",
                schema: "agent",
                table: "knowledge_docs",
                column: "category");

            migrationBuilder.CreateIndex(
                name: "ix_knowledge_docs_title",
                schema: "agent",
                table: "knowledge_docs",
                column: "title");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "agent_protocols",
                schema: "agent");

            migrationBuilder.DropTable(
                name: "agent_tasks",
                schema: "agent");

            migrationBuilder.DropTable(
                name: "knowledge_docs",
                schema: "agent");
        }
    }
}
