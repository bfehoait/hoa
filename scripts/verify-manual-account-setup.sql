-- Read-only setup inspection. No account details, emails or password material.
-- Before 025: inspect existing non-internal Auth/member INSERT triggers for
-- automatic member creation or guards that would conflict with manual linking.
SELECT n.nspname AS schema_name,c.relname AS table_name,t.tgname AS trigger_name,
       pg_get_triggerdef(t.oid) AS trigger_definition,
       pn.nspname AS function_schema,p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON c.oid=t.tgrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_proc p ON p.oid=t.tgfoid
JOIN pg_namespace pn ON pn.oid=p.pronamespace
WHERE NOT t.tgisinternal
  AND ((n.nspname='auth' AND c.relname='users')
    OR (n.nspname='public' AND c.relname='members'))
ORDER BY n.nspname,c.relname,t.tgname;

-- After 025: these installation checks should all be true.
SELECT jsonb_build_object(
 'options_function',to_regprocedure('public.bfe_manual_account_options()') IS NOT NULL,
 'preflight_function',to_regprocedure('public.bfe_manual_account_preflight(uuid,uuid,text)') IS NOT NULL,
 'receipt_table',to_regclass('public.bfe_manual_account_receipts') IS NOT NULL,
 'deferred_link_trigger',EXISTS(SELECT 1 FROM pg_trigger
   WHERE tgrelid='auth.users'::regclass AND tgname='bfe_manual_auth_account_link'
     AND tgenabled IN ('O','A') AND tgdeferrable AND tginitdeferred)
) AS manual_account_installation;
