-- CreateEnum
CREATE TYPE "AnnouncementType" AS ENUM ('EVENT', 'ANNOUNCEMENT');

-- AlterTable
ALTER TABLE "announcement" ADD COLUMN     "event_id" UUID,
ADD COLUMN     "type" "AnnouncementType" NOT NULL DEFAULT 'ANNOUNCEMENT';

-- CreateIndex
CREATE INDEX "announcement_event_id_idx" ON "announcement"("event_id");

-- AddForeignKey
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("event_id") ON DELETE SET NULL ON UPDATE CASCADE;
