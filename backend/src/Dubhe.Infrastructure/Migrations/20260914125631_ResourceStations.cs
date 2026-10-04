using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dubhe.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ResourceStations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "cumulative_flight_minutes",
                schema: "resource",
                table: "drones",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "health_score",
                schema: "resource",
                table: "drones",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "last_maintained_at",
                schema: "resource",
                table: "drones",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "stations",
                schema: "resource",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    type = table.Column<int>(type: "integer", nullable: false),
                    address = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    lat = table.Column<double>(type: "double precision", nullable: false),
                    lng = table.Column<double>(type: "double precision", nullable: false),
                    capacity = table.Column<int>(type: "integer", nullable: false),
                    charger_count = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    remark = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_stations", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "station_reservations",
                schema: "resource",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    station_id = table.Column<Guid>(type: "uuid", nullable: false),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    start_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    end_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    purpose = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    remark = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_station_reservations", x => x.id);
                    table.ForeignKey(
                        name: "fk_station_reservations_stations_station_id",
                        column: x => x.station_id,
                        principalSchema: "resource",
                        principalTable: "stations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_station_reservations_merchant_id",
                schema: "resource",
                table: "station_reservations",
                column: "merchant_id");

            migrationBuilder.CreateIndex(
                name: "ix_station_reservations_station_id_start_at",
                schema: "resource",
                table: "station_reservations",
                columns: new[] { "station_id", "start_at" });

            migrationBuilder.CreateIndex(
                name: "ix_stations_merchant_id_name",
                schema: "resource",
                table: "stations",
                columns: new[] { "merchant_id", "name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_stations_status",
                schema: "resource",
                table: "stations",
                column: "status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "station_reservations",
                schema: "resource");

            migrationBuilder.DropTable(
                name: "stations",
                schema: "resource");

            migrationBuilder.DropColumn(
                name: "cumulative_flight_minutes",
                schema: "resource",
                table: "drones");

            migrationBuilder.DropColumn(
                name: "health_score",
                schema: "resource",
                table: "drones");

            migrationBuilder.DropColumn(
                name: "last_maintained_at",
                schema: "resource",
                table: "drones");
        }
    }
}
