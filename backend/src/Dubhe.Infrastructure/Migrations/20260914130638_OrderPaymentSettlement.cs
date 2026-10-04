using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Dubhe.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class OrderPaymentSettlement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "paid_at",
                schema: "biz",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "payment_status",
                schema: "biz",
                table: "orders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "invoice_applications",
                schema: "biz",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    applicant_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: true),
                    title = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    tax_no = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    amount = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    order_ids = table.Column<string>(type: "jsonb", nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    invoice_no = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    file_url = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    rejected_reason = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    issued_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    remark = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_invoice_applications", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "payments",
                schema: "biz",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    payer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    method = table.Column<int>(type: "integer", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    transaction_no = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    failure_reason = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    paid_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    refunded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    refund_reason = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_payments", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "settlement_statements",
                schema: "biz",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    statement_no = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    merchant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    period_start = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    period_end = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    order_count = table.Column<int>(type: "integer", nullable: false),
                    total_amount = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    commission_rate = table.Column<decimal>(type: "numeric(6,4)", precision: 6, scale: 4, nullable: false),
                    commission_amount = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    net_amount = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    status = table.Column<int>(type: "integer", nullable: false),
                    generated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    confirmed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    settled_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    remark = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_settlement_statements", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "settlement_statement_items",
                schema: "biz",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    statement_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_no = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    total_amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    commission_amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    net_amount = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    payment_status = table.Column<int>(type: "integer", nullable: false),
                    delivered_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_settlement_statement_items", x => x.id);
                    table.ForeignKey(
                        name: "fk_settlement_statement_items_settlement_statements_statement_~",
                        column: x => x.statement_id,
                        principalSchema: "biz",
                        principalTable: "settlement_statements",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_invoice_applications_applicant_user_id",
                schema: "biz",
                table: "invoice_applications",
                column: "applicant_user_id");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_applications_merchant_id",
                schema: "biz",
                table: "invoice_applications",
                column: "merchant_id");

            migrationBuilder.CreateIndex(
                name: "ix_invoice_applications_status",
                schema: "biz",
                table: "invoice_applications",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_payments_order_id",
                schema: "biz",
                table: "payments",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_payments_status",
                schema: "biz",
                table: "payments",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_settlement_statement_items_order_id",
                schema: "biz",
                table: "settlement_statement_items",
                column: "order_id");

            migrationBuilder.CreateIndex(
                name: "ix_settlement_statement_items_statement_id",
                schema: "biz",
                table: "settlement_statement_items",
                column: "statement_id");

            migrationBuilder.CreateIndex(
                name: "ix_settlement_statements_merchant_id",
                schema: "biz",
                table: "settlement_statements",
                column: "merchant_id");

            migrationBuilder.CreateIndex(
                name: "ix_settlement_statements_statement_no",
                schema: "biz",
                table: "settlement_statements",
                column: "statement_no",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_settlement_statements_status",
                schema: "biz",
                table: "settlement_statements",
                column: "status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "invoice_applications",
                schema: "biz");

            migrationBuilder.DropTable(
                name: "payments",
                schema: "biz");

            migrationBuilder.DropTable(
                name: "settlement_statement_items",
                schema: "biz");

            migrationBuilder.DropTable(
                name: "settlement_statements",
                schema: "biz");

            migrationBuilder.DropColumn(
                name: "paid_at",
                schema: "biz",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "payment_status",
                schema: "biz",
                table: "orders");
        }
    }
}
