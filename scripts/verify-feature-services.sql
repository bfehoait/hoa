-- Read-only verification after migrations 007-011. No source records are returned.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF current_user<>'postgres' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Run in SQL Editor as postgres.'; END IF;
END $$;
SELECT jsonb_build_object(
 'assessment_only',true,
 'form_definitions',(SELECT count(*) FROM public.bfe_feature_definitions),
 'field_definitions',(SELECT sum(jsonb_array_length(fields)) FROM public.bfe_feature_definitions),
 'new_private_tables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('bfe_feature_definitions','bfe_feature_records','bfe_feature_audit','bfe_facilities','bfe_bookings','bfe_booking_audit','bfe_visitor_passes','bfe_visitor_audit','bfe_activity_participation','bfe_participation_audit') AND c.relrowsecurity AND NOT has_table_privilege('authenticated',c.oid,'SELECT') AND NOT has_table_privilege('authenticated',c.oid,'INSERT') AND NOT has_table_privilege('authenticated',c.oid,'UPDATE') AND NOT has_table_privilege('authenticated',c.oid,'DELETE') AND NOT has_table_privilege('anon',c.oid,'SELECT')),
 'authenticated_operations',jsonb_build_object(
  'feature_submission',has_function_privilege('authenticated','public.bfe_submit_feature(uuid,text,text,text,jsonb,boolean)','EXECUTE'),
  'bookings',has_function_privilege('authenticated','public.bfe_create_booking(uuid,uuid,timestamptz,timestamptz,text,integer)','EXECUTE'),
  'visitor_passes',has_function_privilege('authenticated','public.bfe_create_visitor_pass(uuid,uuid,text,text,text,timestamptz,timestamptz)','EXECUTE'),
  'participation',has_function_privilege('authenticated','public.bfe_request_participation(uuid,uuid,integer,text)','EXECUTE')
 ),
 'anonymous_operations_blocked',NOT has_function_privilege('anon','public.bfe_feature_dashboard(text,text,integer,text)','EXECUTE') AND NOT has_function_privilege('anon','public.bfe_booking_dashboard(boolean,integer)','EXECUTE') AND NOT has_function_privilege('anon','public.bfe_visitor_dashboard(boolean,integer,text)','EXECUTE') AND NOT has_function_privilege('anon','public.bfe_participation_dashboard(text,boolean,integer)','EXECUTE'),
 'configured_facilities',(SELECT count(*) FROM public.bfe_facilities),
 'existing_shuttle_expiry_function',to_regprocedure('public.bfe_expire_shuttle_requests()') IS NOT NULL
) AS feature_services_verification;
COMMIT;
