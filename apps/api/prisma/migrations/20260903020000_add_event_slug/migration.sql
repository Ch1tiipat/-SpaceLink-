-- AlterTable: add the column as nullable so existing events can be backfilled.
ALTER TABLE "event" ADD COLUMN "slug" TEXT;

-- Backfill existing events with the same ASCII base and UUID-hex suffix shape
-- used by the application. Generate another suffix if a collision occurs.
DO $$
DECLARE
  event_row RECORD;
  slug_base TEXT;
  slug_candidate TEXT;
BEGIN
  FOR event_row IN
    SELECT "event_id", "name"
    FROM "event"
    ORDER BY "event_id"
  LOOP
    slug_base := lower(normalize(event_row."name", NFKD));
    slug_base := regexp_replace(slug_base, '[^a-z0-9[:space:]-]', '', 'g');
    slug_base := btrim(slug_base);
    slug_base := regexp_replace(slug_base, '[[:space:]]+', '-', 'g');
    slug_base := regexp_replace(slug_base, '-+', '-', 'g');
    slug_base := left(slug_base, 60);
    slug_base := btrim(slug_base, '-');

    LOOP
      slug_candidate := COALESCE(NULLIF(slug_base, ''), 'event')
        || '-'
        || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM "event"
        WHERE "slug" = slug_candidate
      );
    END LOOP;

    UPDATE "event"
    SET "slug" = slug_candidate
    WHERE "event_id" = event_row."event_id";
  END LOOP;
END $$;

-- Match the required Prisma field after every existing row has a unique slug.
ALTER TABLE "event" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "event_slug_key" ON "event"("slug");
