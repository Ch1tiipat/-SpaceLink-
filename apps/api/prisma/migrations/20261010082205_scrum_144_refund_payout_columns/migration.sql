-- SCRUM-144: Add nullable refund payout columns for fresh installs.
-- Existing columns are preserved; no data backfill or destructive changes.
ALTER TABLE "refund_request"
    ADD COLUMN IF NOT EXISTS "payout_account_name" TEXT,
    ADD COLUMN IF NOT EXISTS "payout_account_number" TEXT,
    ADD COLUMN IF NOT EXISTS "payout_bank_name" TEXT,
    ADD COLUMN IF NOT EXISTS "payout_method" TEXT,
    ADD COLUMN IF NOT EXISTS "payout_prompt_pay_id" TEXT;
