using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dubhe.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AirspaceModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "airspace");

            migrationBuilder.CreateTable(
                name: "airspace_zones",
                schema: "airspace",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    source = table.Column<int>(type: "integer", nullable: false),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    center_lat = table.Column<double>(type: "double precision", nullable: false),
                    center_lng = table.Column<double>(type: "double precision", nullable: false),
                    radius_km = table.Column<double>(type: "double precision", nullable: false),
                    min_altitude_m = table.Column<double>(type: "double precision", nullable: true),
                    max_altitude_m = table.Column<double>(type: "double precision", nullable: true),
                    effective_from = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    effective_to = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    reason = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_airspace_zones", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "flight_plans",
                schema: "airspace",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    plan_no = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    drone_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pilot_crew_id = table.Column<Guid>(type: "uuid", nullable: true),
                    purpose = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    start_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    end_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    max_altitude_m = table.Column<double>(type: "double precision", nullable: false),
                    waypoints = table.Column<string>(type: "jsonb", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    check_result = table.Column<string>(type: "jsonb", nullable: true),
                    submitted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    approved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    approver_id = table.Column<Guid>(type: "uuid", nullable: true),
                    approval_comment = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    reject_reason = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    cancelled_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_flight_plans", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "penalty_records",
                schema: "airspace",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    violation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    fine_amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: true),
                    suspend_days = table.Column<int>(type: "integer", nullable: true),
                    reason = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    issued_by = table.Column<Guid>(type: "uuid", nullable: false),
                    issued_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_penalty_records", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "violation_records",
                schema: "airspace",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    drone_id = table.Column<Guid>(type: "uuid", nullable: true),
                    order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    flight_plan_id = table.Column<Guid>(type: "uuid", nullable: true),
                    type = table.Column<int>(type: "integer", nullable: false),
                    description = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    lat = table.Column<double>(type: "double precision", nullable: true),
                    lng = table.Column<double>(type: "double precision", nullable: true),
                    altitude_m = table.Column<double>(type: "double precision", nullable: true),
                    status = table.Column<int>(type: "integer", nullable: false),
                    resolution = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    occurred_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_violation_records", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_airspace_zones_code",
                schema: "airspace",
                table: "airspace_zones",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_airspace_zones_is_active",
                schema: "airspace",
                table: "airspace_zones",
                column: "is_active");

            migrationBuilder.CreateIndex(
                name: "ix_airspace_zones_merchant_id",
                schema: "airspace",
                table: "airspace_zones",
                column: "merchant_id");

            migrationBuilder.CreateIndex(
                name: "ix_airspace_zones_type",
                schema: "airspace",
                table: "airspace_zones",
                column: "type");

            migrationBuilder.CreateIndex(
                name: "ix_flight_plans_drone_id",
                schema: "airspace",
                table: "flight_plans",
                column: "drone_id");

            migrationBuilder.CreateIndex(
                name: "ix_flight_plans_merchant_id",
                schema: "airspace",
                table: "flight_plans",
                column: "merchant_id");

            migrationBuilder.CreateIndex(
                name: "ix_flight_plans_plan_no",
                schema: "airspace",
                table: "flight_plans",
                column: "plan_no",
                unique: true,
                filter: "plan_no IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_flight_plans_start_at",
                schema: "airspace",
                table: "flight_plans",
                column: "start_at");

            migrationBuilder.CreateIndex(
                name: "ix_flight_plans_status",
                schema: "airspace",
                table: "flight_plans",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_penalty_records_merchant_id",
                schema: "airspace",
                table: "penalty_records",
                column: "merchant_id");

            migrationBuilder.CreateIndex(
                name: "ix_penalty_records_violation_id",
                schema: "airspace",
                table: "penalty_records",
                column: "violation_id");

            migrationBuilder.CreateIndex(
                name: "ix_violation_records_drone_id",
                schema: "airspace",
                table: "violation_records",
                column: "drone_id");

            migrationBuilder.CreateIndex(
                name: "ix_violation_records_merchant_id",
                schema: "airspace",
                table: "violation_records",
                column: "merchant_id");

            migrationBuilder.CreateIndex(
                name: "ix_violation_records_occurred_at",
                schema: "airspace",
                table: "violation_records",
                column: "occurred_at");

            migrationBuilder.CreateIndex(
                name: "ix_violation_records_status",
                schema: "airspace",
                table: "violation_records",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_violation_records_type",
                schema: "airspace",
                table: "violation_records",
                column: "type");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "airspace_zones",
                schema: "airspace");

            migrationBuilder.DropTable(
                name: "flight_plans",
                schema: "airspace");

            migrationBuilder.DropTable(
                name: "penalty_records",
                schema: "airspace");

            migrationBuilder.DropTable(
                name: "violation_records",
                schema: "airspace");
        }
    }
}
