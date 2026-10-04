using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dubhe.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ResourceCrewMaintenance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "support");

            migrationBuilder.CreateTable(
                name: "crew_members",
                schema: "resource",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    gender = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: true),
                    phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    role = table.Column<int>(type: "integer", nullable: false),
                    region = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_crew_members", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "drone_faults",
                schema: "resource",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    drone_id = table.Column<Guid>(type: "uuid", nullable: false),
                    fault_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    description = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    photo_urls = table.Column<string>(type: "jsonb", nullable: true),
                    lat = table.Column<double>(type: "double precision", nullable: true),
                    lng = table.Column<double>(type: "double precision", nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    handler_crew_id = table.Column<Guid>(type: "uuid", nullable: true),
                    resolution = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    reported_by = table.Column<Guid>(type: "uuid", nullable: false),
                    reported_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_drone_faults", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "maintenance_plans",
                schema: "resource",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    drone_id = table.Column<Guid>(type: "uuid", nullable: false),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    interval_days = table.Column<int>(type: "integer", nullable: true),
                    interval_flight_minutes = table.Column<int>(type: "integer", nullable: true),
                    last_maintained_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_maintained_flight_minutes = table.Column<int>(type: "integer", nullable: true),
                    next_due_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    next_due_flight_minutes = table.Column<int>(type: "integer", nullable: true),
                    remark = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_maintenance_plans", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "maintenance_records",
                schema: "resource",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    drone_id = table.Column<Guid>(type: "uuid", nullable: false),
                    plan_id = table.Column<Guid>(type: "uuid", nullable: true),
                    crew_member_id = table.Column<Guid>(type: "uuid", nullable: true),
                    type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    content = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    maintained_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    file_url = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_maintenance_records", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "notifications",
                schema: "support",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    title = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    content = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    related_id = table.Column<Guid>(type: "uuid", nullable: true),
                    dedupe_key = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    is_read = table.Column<bool>(type: "boolean", nullable: false),
                    read_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_notifications", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "crew_attendances",
                schema: "resource",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    crew_member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    date = table.Column<DateOnly>(type: "date", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    remark = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_crew_attendances", x => x.id);
                    table.ForeignKey(
                        name: "fk_crew_attendances_crew_members_crew_member_id",
                        column: x => x.crew_member_id,
                        principalSchema: "resource",
                        principalTable: "crew_members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "crew_qualifications",
                schema: "resource",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    crew_member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    number = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    issued_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    file_url = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_crew_qualifications", x => x.id);
                    table.ForeignKey(
                        name: "fk_crew_qualifications_crew_members_crew_member_id",
                        column: x => x.crew_member_id,
                        principalSchema: "resource",
                        principalTable: "crew_members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "crew_schedules",
                schema: "resource",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    crew_member_id = table.Column<Guid>(type: "uuid", nullable: false),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    start_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    end_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    area = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    drone_id = table.Column<Guid>(type: "uuid", nullable: true),
                    remark = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_crew_schedules", x => x.id);
                    table.ForeignKey(
                        name: "fk_crew_schedules_crew_members_crew_member_id",
                        column: x => x.crew_member_id,
                        principalSchema: "resource",
                        principalTable: "crew_members",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_crew_attendances_crew_member_id_date",
                schema: "resource",
                table: "crew_attendances",
                columns: new[] { "crew_member_id", "date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_crew_attendances_merchant_id",
                schema: "resource",
                table: "crew_attendances",
                column: "merchant_id");

            migrationBuilder.CreateIndex(
                name: "ix_crew_members_merchant_id",
                schema: "resource",
                table: "crew_members",
                column: "merchant_id");

            migrationBuilder.CreateIndex(
                name: "ix_crew_members_merchant_id_phone",
                schema: "resource",
                table: "crew_members",
                columns: new[] { "merchant_id", "phone" });

            migrationBuilder.CreateIndex(
                name: "ix_crew_qualifications_crew_member_id",
                schema: "resource",
                table: "crew_qualifications",
                column: "crew_member_id");

            migrationBuilder.CreateIndex(
                name: "ix_crew_qualifications_expires_at",
                schema: "resource",
                table: "crew_qualifications",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_crew_schedules_crew_member_id_start_at",
                schema: "resource",
                table: "crew_schedules",
                columns: new[] { "crew_member_id", "start_at" });

            migrationBuilder.CreateIndex(
                name: "ix_crew_schedules_merchant_id",
                schema: "resource",
                table: "crew_schedules",
                column: "merchant_id");

            migrationBuilder.CreateIndex(
                name: "ix_drone_faults_drone_id",
                schema: "resource",
                table: "drone_faults",
                column: "drone_id");

            migrationBuilder.CreateIndex(
                name: "ix_drone_faults_merchant_id",
                schema: "resource",
                table: "drone_faults",
                column: "merchant_id");

            migrationBuilder.CreateIndex(
                name: "ix_drone_faults_status",
                schema: "resource",
                table: "drone_faults",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_maintenance_plans_drone_id",
                schema: "resource",
                table: "maintenance_plans",
                column: "drone_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_maintenance_plans_merchant_id",
                schema: "resource",
                table: "maintenance_plans",
                column: "merchant_id");

            migrationBuilder.CreateIndex(
                name: "ix_maintenance_records_drone_id",
                schema: "resource",
                table: "maintenance_records",
                column: "drone_id");

            migrationBuilder.CreateIndex(
                name: "ix_maintenance_records_maintained_at",
                schema: "resource",
                table: "maintenance_records",
                column: "maintained_at");

            migrationBuilder.CreateIndex(
                name: "ix_maintenance_records_merchant_id",
                schema: "resource",
                table: "maintenance_records",
                column: "merchant_id");

            migrationBuilder.CreateIndex(
                name: "ix_notifications_dedupe_key",
                schema: "support",
                table: "notifications",
                column: "dedupe_key",
                unique: true,
                filter: "dedupe_key IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_notifications_user_id",
                schema: "support",
                table: "notifications",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_notifications_user_id_is_read",
                schema: "support",
                table: "notifications",
                columns: new[] { "user_id", "is_read" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "crew_attendances",
                schema: "resource");

            migrationBuilder.DropTable(
                name: "crew_qualifications",
                schema: "resource");

            migrationBuilder.DropTable(
                name: "crew_schedules",
                schema: "resource");

            migrationBuilder.DropTable(
                name: "drone_faults",
                schema: "resource");

            migrationBuilder.DropTable(
                name: "maintenance_plans",
                schema: "resource");

            migrationBuilder.DropTable(
                name: "maintenance_records",
                schema: "resource");

            migrationBuilder.DropTable(
                name: "notifications",
                schema: "support");

            migrationBuilder.DropTable(
                name: "crew_members",
                schema: "resource");
        }
    }
}
