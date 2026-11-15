-- Owner-run after 083. The approval transaction posts a fee notification to
-- /account. The older path CHECK omitted that route, rolling back the charge.
-- Preserve the existing allowlist and add only the account destination.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
ALTER TABLE public.bfe_notifications DROP CONSTRAINT bfe_notifications_path_check;
ALTER TABLE public.bfe_notifications ADD CONSTRAINT bfe_notifications_path_check
 CHECK(path IN ('/services/requests','/office/requests','/more/profile',
 '/developer/access','/more/notifications','/more/transport','/driver/dispatch','/account'));
NOTIFY pgrst,'reload schema';
COMMIT;
