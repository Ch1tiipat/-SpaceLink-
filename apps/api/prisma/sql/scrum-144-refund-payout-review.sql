-- SCRUM-144: REVIEW ONLY. Do not apply automatically or include in a bulk SQL run.
-- Shared database changes must be reviewed and applied by Book only.
-- Generated offline with Prisma 6.19.3 migrate diff:
--   --from-schema-datamodel <schema.prisma from faf0185>
--   --to-schema-datamodel prisma/schema.prisma --script
-- This compares datamodel files, not the shared database or migration history.
-- All five fields are nullable for legacy requests; no backfill or data changes.
-- API validation for new requests is a separate implementation phase.
-- Apply the reviewed migration before deploying code generated from the new schema.

-- AlterTable
ALTER TABLE "refund_request" ADD COLUMN     "payout_account_name" TEXT,
ADD COLUMN     "payout_account_number" TEXT,
ADD COLUMN     "payout_bank_name" TEXT,
ADD COLUMN     "payout_method" TEXT,
ADD COLUMN     "payout_prompt_pay_id" TEXT;
