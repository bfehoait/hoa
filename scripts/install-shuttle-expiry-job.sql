-- Run once as postgres after migration 006, with Supabase Cron enabled.
-- This schedules only the authorized target's shuttle expiry sweep.
BEGIN;
DO $$ BEGIN
 IF current_user<>'postgres' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Run as postgres.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
  RAISE EXCEPTION 'Enable Supabase Cron first, then rerun this file.';
 END IF;
END $$;
SELECT cron.schedule('bfe-shuttle-expiry','* * * * *','SELECT public.bfe_expire_shuttle_requests();');
COMMIT;
