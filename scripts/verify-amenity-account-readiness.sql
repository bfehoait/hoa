-- Run after 068/069. Read-only metadata/counts; no identities or amounts.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='30s';
SELECT jsonb_build_object(
 'assessment_only',true,
 'account_balance_read',to_regprocedure('public.bfe_my_account_balance(integer)') IS NOT NULL,
 'booking_charge_read',to_regprocedure('public.bfe_booking_charge(uuid)') IS NOT NULL,
 'active_clubhouse_choices',(SELECT count(*) FROM public.bfe_facilities WHERE active AND lower(btrim(name))='clubhouse'),
 'active_pool_choices',(SELECT count(*) FROM public.bfe_facilities WHERE active AND lower(btrim(name))='swimming pool'),
 'charge_form_definitions',(SELECT count(*) FROM public.bfe_accounting_form_definitions WHERE kind IN ('amenity-charge','amenity-payment')),
 'charge_tables_rls',(SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('bfe_amenity_charges','bfe_amenity_payments') AND c.relrowsecurity),
 'posted_charge_count',(SELECT count(*) FROM public.bfe_amenity_charges c JOIN public.bfe_accounting_entries e ON e.id=c.entry_id AND e.status='Posted'),
 'accounting_trigger',(SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid='public.bfe_accounting_entries'::regclass AND tgname='bfe_amenity_accounting_effect' AND NOT tgisinternal)
) AS readiness;
COMMIT;
