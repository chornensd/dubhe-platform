using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dubhe.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ConfigModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "config");

            migrationBuilder.CreateTable(
                name: "backup_records",
                schema: "config",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    file_name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    scope = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    size_bytes = table.Column<long>(type: "bigint", nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    error = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    restored_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_backup_records", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "external_endpoints",
                schema: "config",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    url = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    method = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    is_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    timeout_seconds = table.Column<int>(type: "integer", nullable: false),
                    max_retries = table.Column<int>(type: "integer", nullable: false),
                    headers = table.Column<string>(type: "jsonb", nullable: true),
                    last_call_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_call_succeeded = table.Column<bool>(type: "boolean", nullable: true),
                    total_calls = table.Column<int>(type: "integer", nullable: false),
                    failed_calls = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_external_endpoints", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "interface_call_logs",
                schema: "config",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    endpoint_id = table.Column<Guid>(type: "uuid", nullable: true),
                    endpoint_name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    url = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    method = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    status_code = table.Column<int>(type: "integer", nullable: true),
                    succeeded = table.Column<bool>(type: "boolean", nullable: false),
                    duration_ms = table.Column<int>(type: "integer", nullable: false),
                    error = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_interface_call_logs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "system_configs",
                schema: "config",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    key = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    value = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                    group = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    description = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    value_type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    updated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_system_configs", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_backup_records_created_at",
                schema: "config",
                table: "backup_records",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_external_endpoints_name",
                schema: "config",
                table: "external_endpoints",
                column: "name");

            migrationBuilder.CreateIndex(
                name: "ix_interface_call_logs_created_at",
                schema: "config",
                table: "interface_call_logs",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_interface_call_logs_endpoint_id",
                schema: "config",
                table: "interface_call_logs",
                column: "endpoint_id");

            migrationBuilder.CreateIndex(
                name: "ix_system_configs_group",
                schema: "config",
                table: "system_configs",
                column: "group");

            migrationBuilder.CreateIndex(
                name: "ix_system_configs_key",
                schema: "config",
                table: "system_configs",
                column: "key",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "backup_records",
                schema: "config");

            migrationBuilder.DropTable(
                name: "external_endpoints",
                schema: "config");

            migrationBuilder.DropTable(
                name: "interface_call_logs",
                schema: "config");

            migrationBuilder.DropTable(
                name: "system_configs",
                schema: "config");
        }
    }
}
