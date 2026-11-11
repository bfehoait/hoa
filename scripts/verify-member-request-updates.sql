-- Owner-run read-only metadata check after 062 and 063. No private records.
-- Presence is not proof of account access or successful browser outcomes.
SELECT jsonb_build_object(
 'linked_directory_installed',to_regprocedure('public.bfe_staff_linked_properties(uuid[])') IS NOT NULL,
 'monthly_rate_summary_installed',EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.bfe_my_linked_properties()') AND position('monthly_dues_centavos' IN prosrc)>0),
 'private_health_read_installed',to_regprocedure('public.bfe_private_health_note(uuid)') IS NOT NULL,
 'private_health_save_installed',to_regprocedure('public.bfe_save_private_health_note(integer,text)') IS NOT NULL,
 'registration_health_enabled',EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.bfe_apply_for_membership(jsonb)') AND position('healthNote' IN prosrc)>0),
 'health_table_rls',EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass('public.bfe_private_health_notes') AND relrowsecurity),
 'health_table_direct_read_blocked',CASE WHEN to_regclass('public.bfe_private_health_notes') IS NOT NULL THEN NOT has_table_privilege('authenticated','public.bfe_private_health_notes','SELECT') ELSE false END
) AS member_request_readiness;
