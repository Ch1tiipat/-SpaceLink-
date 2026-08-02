-- Apply manually with psql against DIRECT_URL after Prisma migrations finish.
-- This transaction keeps the existing full unique index if active duplicates
-- prevent creation of the replacement partial unique index.
BEGIN;

DROP INDEX IF EXISTS "booking_event_id_booth_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "booking_active_event_booth_key"
ON "booking" ("event_id", "booth_id")
WHERE "status" IN ('PENDING_PAYMENT', 'CONFIRMED');

COMMIT;
