using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dubhe.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ReportModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "report");

            migrationBuilder.CreateTable(
                name: "report_shares",
                schema: "report",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    recipient_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    business_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    fields = table.Column<string>(type: "jsonb", nullable: false),
                    filters = table.Column<string>(type: "jsonb", nullable: false),
                    expire_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    can_export = table.Column<bool>(type: "boolean", nullable: false),
                    is_revoked = table.Column<bool>(type: "boolean", nullable: false),
                    access_count = table.Column<int>(type: "integer", nullable: false),
                    last_accessed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_report_shares", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "report_templates",
                schema: "report",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    business_type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    fields = table.Column<string>(type: "jsonb", nullable: false),
                    filters = table.Column<string>(type: "jsonb", nullable: false),
                    owner_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_shared = table.Column<bool>(type: "boolean", nullable: false),
                    remark = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_report_templates", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_report_shares_expire_at",
                schema: "report",
                table: "report_shares",
                column: "expire_at");

            migrationBuilder.CreateIndex(
                name: "ix_report_shares_owner_user_id",
                schema: "report",
                table: "report_shares",
                column: "owner_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_report_shares_recipient_user_id",
                schema: "report",
                table: "report_shares",
                column: "recipient_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_report_templates_merchant_id",
                schema: "report",
                table: "report_templates",
                column: "merchant_id");

            migrationBuilder.CreateIndex(
                name: "ix_report_templates_owner_user_id",
                schema: "report",
                table: "report_templates",
                column: "owner_user_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "report_shares",
                schema: "report");

            migrationBuilder.DropTable(
                name: "report_templates",
                schema: "report");
        }
    }
}
