using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dubhe.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class OrderResourceModules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "resource");

            migrationBuilder.EnsureSchema(
                name: "biz");

            migrationBuilder.CreateTable(
                name: "drones",
                schema: "resource",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    serial_no = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    model = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    max_payload_kg = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    endurance_minutes = table.Column<int>(type: "integer", nullable: false),
                    battery_percent = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_drones", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "order_status_histories",
                schema: "biz",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    from_status = table.Column<int>(type: "integer", nullable: true),
                    to_status = table.Column<int>(type: "integer", nullable: false),
                    operator_id = table.Column<Guid>(type: "uuid", nullable: true),
                    remark = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_order_status_histories", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "orders",
                schema: "biz",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_no = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    customer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    sender_name = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    sender_phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    sender_address = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    sender_lat = table.Column<double>(type: "double precision", nullable: false),
                    sender_lng = table.Column<double>(type: "double precision", nullable: false),
                    receiver_name = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    receiver_phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    receiver_address = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    receiver_lat = table.Column<double>(type: "double precision", nullable: false),
                    receiver_lng = table.Column<double>(type: "double precision", nullable: false),
                    item_category = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    item_name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    weight_kg = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    volume_m3 = table.Column<decimal>(type: "numeric(10,3)", precision: 10, scale: 3, nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    is_urgent = table.Column<bool>(type: "boolean", nullable: false),
                    compliance_proof_url = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    remark = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    scheduled_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    distance_km = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    base_fee = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    distance_fee = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    weight_fee = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    airspace_fee = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    urgent_fee = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    discount_amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    total_amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    accepted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    accepted_by = table.Column<Guid>(type: "uuid", nullable: true),
                    cancel_reason = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    cancelled_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    cancelled_by = table.Column<Guid>(type: "uuid", nullable: true),
                    drone_id = table.Column<Guid>(type: "uuid", nullable: true),
                    pilot_id = table.Column<Guid>(type: "uuid", nullable: true),
                    dispatcher_id = table.Column<Guid>(type: "uuid", nullable: true),
                    dispatched_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    planned_route = table.Column<string>(type: "jsonb", nullable: true),
                    dispatch_remark = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    in_flight_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    delivered_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    rating = table.Column<int>(type: "integer", nullable: true),
                    review_comment = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    reviewed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_orders", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "service_areas",
                schema: "biz",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    center_lat = table.Column<double>(type: "double precision", nullable: false),
                    center_lng = table.Column<double>(type: "double precision", nullable: false),
                    radius_km = table.Column<double>(type: "double precision", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_service_areas", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_drones_merchant_id",
                schema: "resource",
                table: "drones",
                column: "merchant_id");

            migrationBuilder.CreateIndex(
                name: "ix_drones_serial_no",
                schema: "resource",
                table: "drones",
                column: "serial_no",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_drones_status",
                schema: "resource",
                table: "drones",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_order_status_histories_order_id",
                schema: "biz",
                table: "order_status_histories",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_orders_created_at",
                schema: "biz",
                table: "orders",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "ix_orders_customer_id",
                schema: "biz",
                table: "orders",
                column: "customer_id");

            migrationBuilder.CreateIndex(
                name: "ix_orders_merchant_id",
                schema: "biz",
                table: "orders",
                column: "merchant_id");

            migrationBuilder.CreateIndex(
                name: "ix_orders_order_no",
                schema: "biz",
                table: "orders",
                column: "order_no",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_orders_status",
                schema: "biz",
                table: "orders",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_service_areas_merchant_id",
                schema: "biz",
                table: "service_areas",
                column: "merchant_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "drones",
                schema: "resource");

            migrationBuilder.DropTable(
                name: "order_status_histories",
                schema: "biz");

            migrationBuilder.DropTable(
                name: "orders",
                schema: "biz");

            migrationBuilder.DropTable(
                name: "service_areas",
                schema: "biz");
        }
    }
}
