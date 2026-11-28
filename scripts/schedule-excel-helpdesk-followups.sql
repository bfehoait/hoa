-- OWNER RUN ONLY after 103. Requires Supabase pg_cron to be enabled by owner.
-- A reminder once per unresolved request without any staff reply after three days.
-- No duplicate reminders on retries. Existing cron jobs are kept.
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN RAISE EXCEPTION 'Enable pg_cron before scheduling Helpdesk reminders.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM cron.job WHERE jobname='bfe-helpdesk-followups') THEN
 PERFORM cron.schedule('bfe-helpdesk-followups','0 * * * *','SELECT public.bfe_send_helpdesk_followups()'); END IF;
END;$$;
