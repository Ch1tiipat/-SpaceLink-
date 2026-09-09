-- CreateEnum
CREATE TYPE "PaymentGroupStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "booking" ADD COLUMN     "payment_group_id" UUID;

-- AlterTable
ALTER TABLE "verified_slip" ADD COLUMN     "payment_group_id" UUID;

-- CreateTable
CREATE TABLE "booking_payment_group" (
    "payment_group_id" UUID NOT NULL,
    "payment_code" TEXT NOT NULL,
    "vendor_user_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentGroupStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "hold_expires_at" TIMESTAMPTZ NOT NULL,
    "confirmed_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "booking_payment_group_pkey" PRIMARY KEY ("payment_group_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booking_payment_group_payment_code_key" ON "booking_payment_group"("payment_code");

-- CreateIndex
CREATE INDEX "booking_payment_group_vendor_user_id_idx" ON "booking_payment_group"("vendor_user_id");

-- CreateIndex
CREATE INDEX "booking_payment_group_shop_id_idx" ON "booking_payment_group"("shop_id");

-- CreateIndex
CREATE INDEX "booking_payment_group_event_id_idx" ON "booking_payment_group"("event_id");

-- CreateIndex
CREATE INDEX "booking_payment_group_organization_id_idx" ON "booking_payment_group"("organization_id");

-- CreateIndex
CREATE INDEX "booking_payment_group_status_hold_expires_at_idx" ON "booking_payment_group"("status", "hold_expires_at");

-- CreateIndex
CREATE INDEX "booking_payment_group_id_idx" ON "booking"("payment_group_id");

-- CreateIndex
CREATE INDEX "verified_slip_payment_group_id_idx" ON "verified_slip"("payment_group_id");

-- AddForeignKey
ALTER TABLE "booking_payment_group" ADD CONSTRAINT "booking_payment_group_vendor_user_id_fkey" FOREIGN KEY ("vendor_user_id") REFERENCES "app_user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_payment_group" ADD CONSTRAINT "booking_payment_group_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("shop_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_payment_group" ADD CONSTRAINT "booking_payment_group_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_payment_group" ADD CONSTRAINT "booking_payment_group_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_payment_group_id_fkey" FOREIGN KEY ("payment_group_id") REFERENCES "booking_payment_group"("payment_group_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verified_slip" ADD CONSTRAINT "verified_slip_payment_group_id_fkey" FOREIGN KEY ("payment_group_id") REFERENCES "booking_payment_group"("payment_group_id") ON DELETE SET NULL ON UPDATE CASCADE;
