-- CreateTable
CREATE TABLE "event_join_information" (
    "event_join_information_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "event_join_information_pkey" PRIMARY KEY ("event_join_information_id")
);

-- CreateIndex
CREATE INDEX "event_join_information_event_id_sort_order_idx" ON "event_join_information"("event_id", "sort_order");

-- AddForeignKey
ALTER TABLE "event_join_information" ADD CONSTRAINT "event_join_information_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deny direct Data API access unless explicit policies are added later.
ALTER TABLE "event_join_information" ENABLE ROW LEVEL SECURITY;
