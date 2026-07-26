-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ORG_ADMIN', 'VENDOR');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VenueStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VenuePointType" AS ENUM ('ENTRANCE', 'RESTROOM', 'PARKING', 'EXIT', 'INFO', 'OTHER');

-- CreateEnum
CREATE TYPE "BoothStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CancelledByRole" AS ENUM ('VENDOR', 'ORG_ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SlipStatus" AS ENUM ('VERIFIED', 'INVALID', 'DUPLICATE', 'ERROR');

-- CreateEnum
CREATE TYPE "ReviewTargetType" AS ENUM ('BOOTH', 'ZONE', 'SHOP', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "PenaltyReason" AS ENUM ('NO_SHOW', 'RULE_VIOLATION', 'CONTRACT_BREACH', 'BAD_REVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_STATUS', 'PAYMENT', 'ANNOUNCEMENT', 'PENALTY', 'REFUND', 'SUPPORT_TICKET', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PROCESSED');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('REFUND_REQUEST', 'BOOTH_CHANGE', 'ISSUE_REPORT', 'GENERAL_INQUIRY', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'PROCESSING', 'CLOSED');

-- CreateEnum
CREATE TYPE "RecommendationSource" AS ENUM ('AI_GEMINI', 'RULE_BASED');

-- CreateTable
CREATE TABLE "organization" (
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT,
    "promptpay_id" TEXT,
    "logo_url" TEXT,
    "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("organization_id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "user_id" UUID NOT NULL,
    "auth_user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'VENDOR',
    "is_blacklisted" BOOLEAN NOT NULL DEFAULT false,
    "blacklist_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "org_membership" (
    "membership_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'ADMIN',
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_membership_pkey" PRIMARY KEY ("membership_id")
);

-- CreateTable
CREATE TABLE "venue" (
    "venue_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "map_image_url" TEXT,
    "status" "VenueStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "venue_pkey" PRIMARY KEY ("venue_id")
);

-- CreateTable
CREATE TABLE "venue_point" (
    "venue_point_id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "type" "VenuePointType" NOT NULL,
    "label" TEXT,
    "pos_x" DECIMAL(10,4) NOT NULL,
    "pos_y" DECIMAL(10,4) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "venue_point_pkey" PRIMARY KEY ("venue_point_id")
);

-- CreateTable
CREATE TABLE "zone" (
    "zone_id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "default_booth_price" DECIMAL(10,2),
    "pos_x" DECIMAL(10,4),
    "pos_y" DECIMAL(10,4),
    "image_urls" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "zone_pkey" PRIMARY KEY ("zone_id")
);

-- CreateTable
CREATE TABLE "zone_category" (
    "zone_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "zone_category_pkey" PRIMARY KEY ("zone_id","category_id")
);

-- CreateTable
CREATE TABLE "booth" (
    "booth_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "booth_price" DECIMAL(10,2) NOT NULL,
    "width_m" DECIMAL(6,2),
    "height_m" DECIMAL(6,2),
    "facilities" JSONB,
    "pos_x" DECIMAL(10,4),
    "pos_y" DECIMAL(10,4),
    "status" "BoothStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "booth_pkey" PRIMARY KEY ("booth_id")
);

-- CreateTable
CREATE TABLE "event" (
    "event_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "venue_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "banner_url" TEXT,
    "gallery_urls" JSONB,
    "map_image_url" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "event_policy" (
    "event_policy_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "general_rules" TEXT,
    "cancellation_policy" TEXT,
    "refund_policy" TEXT,
    "no_show_deduction_percent" DECIMAL(5,2) NOT NULL DEFAULT 70,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "event_policy_pkey" PRIMARY KEY ("event_policy_id")
);

-- CreateTable
CREATE TABLE "subscription" (
    "subscription_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "base_fee" DECIMAL(10,2) NOT NULL,
    "zone_count" INTEGER NOT NULL,
    "per_zone_rate" DECIMAL(10,2) NOT NULL,
    "event_days" INTEGER NOT NULL,
    "per_day_rate" DECIMAL(10,2) NOT NULL,
    "calculated_price" DECIMAL(12,2) NOT NULL,
    "price_min" DECIMAL(10,2) NOT NULL,
    "price_max" DECIMAL(10,2) NOT NULL,
    "final_price" DECIMAL(12,2) NOT NULL,
    "is_over_max" BOOLEAN NOT NULL DEFAULT false,
    "platform_paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscription_pkey" PRIMARY KEY ("subscription_id")
);

-- CreateTable
CREATE TABLE "shop" (
    "shop_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "shop_pkey" PRIMARY KEY ("shop_id")
);

-- CreateTable
CREATE TABLE "shop_category" (
    "shop_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "shop_category_pkey" PRIMARY KEY ("shop_id","category_id")
);

-- CreateTable
CREATE TABLE "booking" (
    "booking_id" UUID NOT NULL,
    "booking_code" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "booth_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "vendor_user_id" UUID NOT NULL,
    "booking_start_date" DATE NOT NULL,
    "booking_end_date" DATE NOT NULL,
    "booth_price" DECIMAL(10,2) NOT NULL,
    "is_payment_exempt" BOOLEAN NOT NULL DEFAULT false,
    "payment_exempt_reason" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "hold_expires_at" TIMESTAMPTZ,
    "confirmed_at" TIMESTAMPTZ,
    "cancelled_by_user_id" UUID,
    "cancelled_by_role" "CancelledByRole",
    "cancel_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "booking_pkey" PRIMARY KEY ("booking_id")
);

-- CreateTable
CREATE TABLE "verified_slip" (
    "slip_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "trans_ref" TEXT,
    "sending_bank" TEXT,
    "sender_name" TEXT,
    "receiver_name" TEXT,
    "slip_image_url" TEXT NOT NULL,
    "slipok_status" "SlipStatus" NOT NULL,
    "slipok_raw" JSONB,
    "verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verified_slip_pkey" PRIMARY KEY ("slip_id")
);

-- CreateTable
CREATE TABLE "refund_request" (
    "refund_request_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "requested_amount" DECIMAL(10,2) NOT NULL,
    "approved_amount" DECIMAL(10,2),
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "evidence_urls" JSONB,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "processed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "refund_request_pkey" PRIMARY KEY ("refund_request_id")
);

-- CreateTable
CREATE TABLE "support_ticket" (
    "support_ticket_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "booking_id" UUID,
    "type" "TicketType" NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "support_ticket_pkey" PRIMARY KEY ("support_ticket_id")
);

-- CreateTable
CREATE TABLE "ticket_message" (
    "ticket_message_id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "sender_user_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "attachment_urls" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_message_pkey" PRIMARY KEY ("ticket_message_id")
);

-- CreateTable
CREATE TABLE "review" (
    "review_id" UUID NOT NULL,
    "reviewer_user_id" UUID,
    "reviewer_display_name" TEXT,
    "target_type" "ReviewTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_pkey" PRIMARY KEY ("review_id")
);

-- CreateTable
CREATE TABLE "notification" (
    "notification_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "related_entity_type" TEXT,
    "related_entity_id" UUID,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE "announcement" (
    "announcement_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "announcement_pkey" PRIMARY KEY ("announcement_id")
);

-- CreateTable
CREATE TABLE "penalty" (
    "penalty_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "booking_id" UUID,
    "reason" "PenaltyReason" NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL DEFAULT 1,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "penalty_pkey" PRIMARY KEY ("penalty_id")
);

-- CreateTable
CREATE TABLE "org_config" (
    "org_config_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "booth_limit_per_vendor" INTEGER,
    "booking_quota_per_vendor" INTEGER,
    "tier_thresholds" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "org_config_pkey" PRIMARY KEY ("org_config_id")
);

-- CreateTable
CREATE TABLE "platform_config" (
    "platform_config_id" UUID NOT NULL,
    "base_fee" DECIMAL(10,2) NOT NULL DEFAULT 500,
    "per_zone_rate" DECIMAL(10,2) NOT NULL DEFAULT 50,
    "per_day_rate" DECIMAL(10,2) NOT NULL DEFAULT 100,
    "price_min" DECIMAL(10,2) NOT NULL DEFAULT 500,
    "price_max" DECIMAL(10,2) NOT NULL DEFAULT 15000,
    "default_booking_quota" INTEGER NOT NULL DEFAULT 2,
    "default_booth_limit" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "platform_config_pkey" PRIMARY KEY ("platform_config_id")
);

-- CreateTable
CREATE TABLE "recommendation_log" (
    "recommendation_log_id" UUID NOT NULL,
    "vendor_user_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "recommended_booth_id" UUID NOT NULL,
    "source" "RecommendationSource" NOT NULL,
    "reason" TEXT,
    "score" DECIMAL(5,2),
    "was_booked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_log_pkey" PRIMARY KEY ("recommendation_log_id")
);

-- CreateTable
CREATE TABLE "product_category" (
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_category_pkey" PRIMARY KEY ("category_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_user_auth_user_id_key" ON "app_user"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "org_membership_organization_id_user_id_key" ON "org_membership"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "zone_venue_id_code_key" ON "zone"("venue_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "booth_zone_id_code_key" ON "booth"("zone_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "event_policy_event_id_key" ON "event_policy"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_event_id_key" ON "subscription"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_booking_code_key" ON "booking"("booking_code");

-- CreateIndex
CREATE INDEX "booking_vendor_user_id_idx" ON "booking"("vendor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_event_id_booth_id_key" ON "booking"("event_id", "booth_id");

-- CreateIndex
CREATE UNIQUE INDEX "verified_slip_trans_ref_key" ON "verified_slip"("trans_ref");

-- CreateIndex
CREATE INDEX "refund_request_booking_id_idx" ON "refund_request"("booking_id");

-- CreateIndex
CREATE INDEX "support_ticket_user_id_idx" ON "support_ticket"("user_id");

-- CreateIndex
CREATE INDEX "support_ticket_organization_id_idx" ON "support_ticket"("organization_id");

-- CreateIndex
CREATE INDEX "ticket_message_ticket_id_idx" ON "ticket_message"("ticket_id");

-- CreateIndex
CREATE INDEX "review_target_type_target_id_idx" ON "review"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "notification_user_id_idx" ON "notification"("user_id");

-- CreateIndex
CREATE INDEX "penalty_user_id_idx" ON "penalty"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_config_organization_id_key" ON "org_config"("organization_id");

-- CreateIndex
CREATE INDEX "recommendation_log_vendor_user_id_idx" ON "recommendation_log"("vendor_user_id");

-- CreateIndex
CREATE INDEX "recommendation_log_event_id_idx" ON "recommendation_log"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_category_name_key" ON "product_category"("name");

-- AddForeignKey
ALTER TABLE "org_membership" ADD CONSTRAINT "org_membership_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_membership" ADD CONSTRAINT "org_membership_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue" ADD CONSTRAINT "venue_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_point" ADD CONSTRAINT "venue_point_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venue"("venue_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone" ADD CONSTRAINT "zone_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venue"("venue_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_category" ADD CONSTRAINT "zone_category_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("zone_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_category" ADD CONSTRAINT "zone_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_category"("category_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booth" ADD CONSTRAINT "booth_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("zone_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venue"("venue_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_policy" ADD CONSTRAINT "event_policy_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop" ADD CONSTRAINT "shop_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "app_user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_category" ADD CONSTRAINT "shop_category_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("shop_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_category" ADD CONSTRAINT "shop_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_category"("category_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_booth_id_fkey" FOREIGN KEY ("booth_id") REFERENCES "booth"("booth_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shop"("shop_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_vendor_user_id_fkey" FOREIGN KEY ("vendor_user_id") REFERENCES "app_user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "app_user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verified_slip" ADD CONSTRAINT "verified_slip_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("booking_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("booking_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "app_user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refund_request" ADD CONSTRAINT "refund_request_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "app_user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket" ADD CONSTRAINT "support_ticket_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("booking_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_message" ADD CONSTRAINT "ticket_message_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_ticket"("support_ticket_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_message" ADD CONSTRAINT "ticket_message_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "app_user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review" ADD CONSTRAINT "review_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "app_user"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty" ADD CONSTRAINT "penalty_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty" ADD CONSTRAINT "penalty_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty" ADD CONSTRAINT "penalty_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking"("booking_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_config" ADD CONSTRAINT "org_config_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_log" ADD CONSTRAINT "recommendation_log_vendor_user_id_fkey" FOREIGN KEY ("vendor_user_id") REFERENCES "app_user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_log" ADD CONSTRAINT "recommendation_log_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_log" ADD CONSTRAINT "recommendation_log_recommended_booth_id_fkey" FOREIGN KEY ("recommended_booth_id") REFERENCES "booth"("booth_id") ON DELETE CASCADE ON UPDATE CASCADE;
