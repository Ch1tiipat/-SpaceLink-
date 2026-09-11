-- SCRUM-182 — booth quota grant (AGENTS.md §2.1.1 exception #14)
--
-- REVIEW COPY. Do not apply this by hand and do not move it into
-- prisma/migrations/. It is the output of:
--
--   npx prisma migrate diff \
--     --from-schema-datamodel <schema.prisma at 4a7da68> \
--     --to-schema-datamodel  prisma/schema.prisma \
--     --script
--
-- The PO applies it by running `prisma migrate` against the shared Supabase
-- project once this ticket is reviewed (§2.1.1, §12). Unlike the files beside
-- it in prisma/sql/, this one is NOT a hand-applied companion to a migration —
-- it is the migration's own SQL, kept here only so it can be read in review.
--
-- Additive only: one new table, three indexes, six foreign keys. No statement
-- alters, drops or renames anything that already exists.

-- CreateTable
CREATE TABLE "booth_quota_grant" (
    "quota_grant_id" UUID NOT NULL,
    "vendor_user_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_ticket_id" UUID NOT NULL,
    "granted_by_user_id" UUID NOT NULL,
    "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_booking_id" UUID,
    "consumed_at" TIMESTAMPTZ,

    CONSTRAINT "booth_quota_grant_pkey" PRIMARY KEY ("quota_grant_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booth_quota_grant_source_ticket_id_key" ON "booth_quota_grant"("source_ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "booth_quota_grant_consumed_booking_id_key" ON "booth_quota_grant"("consumed_booking_id");

-- CreateIndex
CREATE INDEX "booth_quota_grant_vendor_user_id_event_id_idx" ON "booth_quota_grant"("vendor_user_id", "event_id");

-- AddForeignKey
ALTER TABLE "booth_quota_grant" ADD CONSTRAINT "booth_quota_grant_vendor_user_id_fkey" FOREIGN KEY ("vendor_user_id") REFERENCES "app_user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booth_quota_grant" ADD CONSTRAINT "booth_quota_grant_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booth_quota_grant" ADD CONSTRAINT "booth_quota_grant_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booth_quota_grant" ADD CONSTRAINT "booth_quota_grant_source_ticket_id_fkey" FOREIGN KEY ("source_ticket_id") REFERENCES "support_ticket"("support_ticket_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booth_quota_grant" ADD CONSTRAINT "booth_quota_grant_granted_by_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "app_user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booth_quota_grant" ADD CONSTRAINT "booth_quota_grant_consumed_booking_id_fkey" FOREIGN KEY ("consumed_booking_id") REFERENCES "booking"("booking_id") ON DELETE SET NULL ON UPDATE CASCADE;

