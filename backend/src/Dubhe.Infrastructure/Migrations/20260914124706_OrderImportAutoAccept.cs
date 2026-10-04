using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dubhe.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class OrderImportAutoAccept : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "auto_accept_rules",
                schema: "biz",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    max_weight_kg = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    max_distance_km = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_auto_accept_rules", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_auto_accept_rules_merchant_id",
                schema: "biz",
                table: "auto_accept_rules",
                column: "merchant_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "auto_accept_rules",
                schema: "biz");
        }
    }
}
