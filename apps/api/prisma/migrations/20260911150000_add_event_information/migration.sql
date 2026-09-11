-- CreateEnum
CREATE TYPE "EventInformationType" AS ENUM ('ATMOSPHERE', 'ACTIVITY', 'FACILITY');

-- CreateTable
CREATE TABLE "event_information" (
    "event_information_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "EventInformationType" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_information_pkey" PRIMARY KEY ("event_information_id")
);

-- CreateIndex
CREATE INDEX "event_information_event_id_sort_order_idx" ON "event_information"("event_id", "sort_order");

-- AddForeignKey
ALTER TABLE "event_information" ADD CONSTRAINT "event_information_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EnableRls
ALTER TABLE "event_information" ENABLE ROW LEVEL SECURITY;
