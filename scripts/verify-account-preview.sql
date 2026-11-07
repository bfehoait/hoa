-- Read-only check after migration 013; no preview session is opened.
BEGIN TRANSACTION READ ONLY;
DO $$ BEGIN
 IF current_user<>'postgres' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Run as postgres in SQL Editor.'; END IF;
END $$;
SELECT jsonb_build_object(
 'assessment_only',true,
 'gateway_installed',to_regprocedure('public.bfe_account_preview_read(uuid,text,jsonb)') IS NOT NULL,
 'authenticated_gateway',has_function_privilege('authenticated','public.bfe_account_preview_read(uuid,text,jsonb)','EXECUTE'),
 'anonymous_blocked',NOT has_function_privilege('anon','public.bfe_account_preview_read(uuid,text,jsonb)','EXECUTE'),
 'request_helpers_private',NOT has_function_privilege('authenticated','public.bfe_preview_requests(boolean,integer,text,text)','EXECUTE') AND NOT has_function_privilege('authenticated','public.bfe_preview_request_thread(uuid,integer)','EXECUTE') AND NOT has_function_privilege('anon','public.bfe_preview_requests(boolean,integer,text,text)','EXECUTE'),
 'guarded_request_reads_stable',(SELECT count(*)=2 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('bfe_preview_requests','bfe_preview_request_thread') AND p.provolatile='s' AND p.prosecdef)
) AS account_preview_verification;
COMMIT;
