-- CreateIndex
CREATE INDEX "org_membership_user_id_idx" ON "org_membership"("user_id");

-- CreateIndex
CREATE INDEX "venue_organization_id_idx" ON "venue"("organization_id");

-- CreateIndex
CREATE INDEX "event_organization_id_idx" ON "event"("organization_id");

-- CreateIndex
CREATE INDEX "event_venue_id_idx" ON "event"("venue_id");

-- CreateIndex
CREATE INDEX "shop_owner_user_id_idx" ON "shop"("owner_user_id");

-- CreateIndex
CREATE INDEX "booking_booth_id_idx" ON "booking"("booth_id");

-- CreateIndex
CREATE INDEX "booking_shop_id_idx" ON "booking"("shop_id");

-- CreateIndex
CREATE INDEX "verified_slip_booking_id_idx" ON "verified_slip"("booking_id");

-- CreateIndex
CREATE INDEX "announcement_organization_id_idx" ON "announcement"("organization_id");
