-- Apply manually with psql against DIRECT_URL after Prisma migrations finish.
-- Enables deny-by-default RLS on saved_event, matching audit_log /
-- booth_quota_grant / event_information / event_join_information.
-- No policy is added: access must go through the NestJS API (service
-- role), which bypasses RLS. This blocks direct Supabase Data API
-- reads/writes from any anon/authenticated client key.
--
-- Rollback (run manually only if direct Data API access must be restored):
-- ALTER TABLE public.saved_event DISABLE ROW LEVEL SECURITY;
BEGIN;

ALTER TABLE public.saved_event ENABLE ROW LEVEL SECURITY;

COMMIT;
