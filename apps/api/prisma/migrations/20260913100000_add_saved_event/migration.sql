-- CreateTable
CREATE TABLE "saved_event" (
    "saved_event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_event_pkey" PRIMARY KEY ("saved_event_id")
);

-- CreateIndex
CREATE INDEX "saved_event_user_id_idx" ON "saved_event"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_event_user_id_event_id_key" ON "saved_event"("user_id", "event_id");

-- AddForeignKey
ALTER TABLE "saved_event" ADD CONSTRAINT "saved_event_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_event" ADD CONSTRAINT "saved_event_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;
