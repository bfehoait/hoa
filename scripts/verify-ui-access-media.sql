-- Read-only installation check after migrations 014-016. No grants or records are created.
BEGIN TRANSACTION READ ONLY;
SELECT jsonb_build_object(
 'assessment_only',true,
 'tab_access_installed',to_regprocedure('public.bfe_save_tab_access(text,text,text,jsonb,jsonb,text)') IS NOT NULL,
 'permission_summaries_installed',EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.bfe_tab_access(text,text,text)') AND provolatile='s' AND prosecdef AND position('''effective''' IN prosrc)>0) AND has_function_privilege('authenticated','public.bfe_tab_access(text,text,text)','EXECUTE') AND NOT has_function_privilege('anon','public.bfe_tab_access(text,text,text)','EXECUTE'),
 'listing_media_installed',to_regprocedure('public.bfe_listing_media(uuid)') IS NOT NULL,
 'private_tables',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('bfe_access_managers','bfe_tab_rules','bfe_listing_assets') AND c.relrowsecurity AND NOT has_table_privilege('authenticated',c.oid,'SELECT') AND NOT has_table_privilege('authenticated',c.oid,'INSERT') AND NOT has_table_privilege('authenticated',c.oid,'UPDATE') AND NOT has_table_privilege('authenticated',c.oid,'DELETE')),
 'cover_bucket_private',EXISTS(SELECT 1 FROM storage.buckets WHERE id='bfe-listing-covers' AND NOT public AND file_size_limit=1048576 AND allowed_mime_types=ARRAY['image/webp']::text[]),
 'anonymous_blocked',NOT has_function_privilege('anon','public.bfe_save_tab_access(text,text,text,jsonb,jsonb,text)','EXECUTE') AND NOT has_function_privilege('anon','public.bfe_listing_media(uuid)','EXECUTE'),
 'authenticated_endpoints',has_function_privilege('authenticated','public.bfe_save_tab_access(text,text,text,jsonb,jsonb,text)','EXECUTE') AND has_function_privilege('authenticated','public.bfe_listing_media(uuid)','EXECUTE'),
 'storage_guards',(SELECT count(*) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname IN ('bfe_listing_cover_insert_guard','bfe_listing_cover_select_guard','bfe_listing_cover_update_guard','bfe_listing_cover_delete_guard','bfe_listing_cover_anon_guard'))
) AS ui_access_media_verification;
COMMIT;
