-- AlterTable
ALTER TABLE "org_membership" ADD COLUMN     "can_manage_payments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_manage_zones" BOOLEAN NOT NULL DEFAULT false;
