-- Read-only installation check after migration 012. Does not start an inspection.
BEGIN TRANSACTION READ ONLY;
DO $$ BEGIN
 IF current_user<>'postgres' OR auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Run in SQL Editor as postgres.'; END IF;
END $$;
SELECT jsonb_build_object(
 'assessment_only',true,
 'private_tables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('bfe_member_inspections','bfe_member_inspection_audit') AND c.relrowsecurity AND NOT has_table_privilege('authenticated',c.oid,'SELECT') AND NOT has_table_privilege('authenticated',c.oid,'INSERT') AND NOT has_table_privilege('authenticated',c.oid,'UPDATE') AND NOT has_table_privilege('authenticated',c.oid,'DELETE') AND NOT has_table_privilege('anon',c.oid,'SELECT')),
 'authenticated_endpoints',has_function_privilege('authenticated','public.bfe_start_member_inspection(uuid,uuid,text)','EXECUTE') AND has_function_privilege('authenticated','public.bfe_inspect_member(uuid,text,integer)','EXECUTE') AND has_function_privilege('authenticated','public.bfe_end_member_inspection(uuid)','EXECUTE'),
 'anonymous_blocked',NOT has_function_privilege('anon','public.bfe_start_member_inspection(uuid,uuid,text)','EXECUTE') AND NOT has_function_privilege('anon','public.bfe_inspect_member(uuid,text,integer)','EXECUTE') AND NOT has_function_privilege('anon','public.bfe_end_member_inspection(uuid)','EXECUTE')
) AS member_inspection_verification;
COMMIT;
