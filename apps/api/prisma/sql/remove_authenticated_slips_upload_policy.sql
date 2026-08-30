-- Apply manually with psql against DIRECT_URL after Prisma migrations finish.
-- This removes direct authenticated client uploads to the private slips bucket.
-- Backend uploads use the Supabase service role and are unaffected because it
-- bypasses RLS. No replacement policy is needed because clients do not upload
-- payment slips directly.
--
-- Rollback (run manually only if direct authenticated uploads must be restored):
-- CREATE POLICY "Authenticated users can upload slips 1t7jg3_0"
-- ON storage.objects
-- FOR INSERT TO authenticated
-- WITH CHECK (bucket_id = 'slips');
BEGIN;

DROP POLICY IF EXISTS "Authenticated users can upload slips 1t7jg3_0"
ON storage.objects;

COMMIT;
