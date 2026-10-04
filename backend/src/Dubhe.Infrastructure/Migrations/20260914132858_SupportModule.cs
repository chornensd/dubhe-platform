using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dubhe.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class SupportModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "canned_responses",
                schema: "support",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    content = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    category = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_canned_responses", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "emergency_alerts",
                schema: "support",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    content = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    level = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    source = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    related_id = table.Column<Guid>(type: "uuid", nullable: true),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reported_by = table.Column<Guid>(type: "uuid", nullable: false),
                    reported_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    handlers = table.Column<string>(type: "jsonb", nullable: true),
                    disposal_plan = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    deadline_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    result = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    closed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_emergency_alerts", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "help_articles",
                schema: "support",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    category = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    tags = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    content_type = table.Column<int>(type: "integer", nullable: false),
                    video_url = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    content = table.Column<string>(type: "text", nullable: false),
                    is_published = table.Column<bool>(type: "boolean", nullable: false),
                    view_count = table.Column<int>(type: "integer", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_help_articles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "service_tickets",
                schema: "support",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    ticket_no = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    title = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    content = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    attachments = table.Column<string>(type: "jsonb", nullable: true),
                    submitter_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    assignee_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    assigned_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    closed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    satisfaction_rating = table.Column<int>(type: "integer", nullable: true),
                    satisfaction_comment = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_service_tickets", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "emergency_timeline_entries",
                schema: "support",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    alert_id = table.Column<Guid>(type: "uuid", nullable: false),
                    action = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    attachments = table.Column<string>(type: "jsonb", nullable: true),
                    operator_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_emergency_timeline_entries", x => x.id);
                    table.ForeignKey(
                        name: "fk_emergency_timeline_entries_emergency_alerts_alert_id",
                        column: x => x.alert_id,
                        principalSchema: "support",
                        principalTable: "emergency_alerts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ticket_replies",
                schema: "support",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    ticket_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    content = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    is_staff = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ticket_replies", x => x.id);
                    table.ForeignKey(
                        name: "fk_ticket_replies_service_tickets_ticket_id",
                        column: x => x.ticket_id,
                        principalSchema: "support",
                        principalTable: "service_tickets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_canned_responses_owner_user_id",
                schema: "support",
                table: "canned_responses",
                column: "owner_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_emergency_alerts_level",
                schema: "support",
                table: "emergency_alerts",
                column: "level");

            migrationBuilder.CreateIndex(
                name: "ix_emergency_alerts_merchant_id",
                schema: "support",
                table: "emergency_alerts",
                column: "merchant_id");

            migrationBuilder.CreateIndex(
                name: "ix_emergency_alerts_reported_at",
                schema: "support",
                table: "emergency_alerts",
                column: "reported_at");

            migrationBuilder.CreateIndex(
                name: "ix_emergency_alerts_status",
                schema: "support",
                table: "emergency_alerts",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_emergency_timeline_entries_alert_id",
                schema: "support",
                table: "emergency_timeline_entries",
                column: "alert_id");

            migrationBuilder.CreateIndex(
                name: "ix_help_articles_category",
                schema: "support",
                table: "help_articles",
                column: "category");

            migrationBuilder.CreateIndex(
                name: "ix_help_articles_is_published",
                schema: "support",
                table: "help_articles",
                column: "is_published");

            migrationBuilder.CreateIndex(
                name: "ix_service_tickets_assignee_user_id",
                schema: "support",
                table: "service_tickets",
                column: "assignee_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_service_tickets_merchant_id",
                schema: "support",
                table: "service_tickets",
                column: "merchant_id");

            migrationBuilder.CreateIndex(
                name: "ix_service_tickets_status",
                schema: "support",
                table: "service_tickets",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_service_tickets_submitter_user_id",
                schema: "support",
                table: "service_tickets",
                column: "submitter_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_service_tickets_ticket_no",
                schema: "support",
                table: "service_tickets",
                column: "ticket_no",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_ticket_replies_ticket_id",
                schema: "support",
                table: "ticket_replies",
                column: "ticket_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "canned_responses",
                schema: "support");

            migrationBuilder.DropTable(
                name: "emergency_timeline_entries",
                schema: "support");

            migrationBuilder.DropTable(
                name: "help_articles",
                schema: "support");

            migrationBuilder.DropTable(
                name: "ticket_replies",
                schema: "support");

            migrationBuilder.DropTable(
                name: "emergency_alerts",
                schema: "support");

            migrationBuilder.DropTable(
                name: "service_tickets",
                schema: "support");
        }
    }
}
