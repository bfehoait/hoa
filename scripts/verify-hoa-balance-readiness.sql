-- Owner-run read-only metadata check after 064/065; no accounts or amounts.
-- Presence is not proof of live role permissions or successful browser flows.
SELECT jsonb_build_object(
 'allocation_form_installed',EXISTS(SELECT 1 FROM public.bfe_accounting_form_definitions WHERE kind='receipt-allocation'),
 'allocation_helper_installed',to_regprocedure('public.bfe_invoice_allocated(uuid)') IS NOT NULL,
 'posting_service_extended',EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.bfe_decide_accounting_entry(uuid,integer,text,text)') AND position('INSERT INTO public.bfe_accounting_receipt_allocations' IN prosrc)>0),
 'balance_read_installed',EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.bfe_my_hoa_balance(integer)') AND prosecdef AND provolatile='s'),
 'balance_read_executable',CASE WHEN to_regprocedure('public.bfe_my_hoa_balance(integer)') IS NOT NULL THEN has_function_privilege('authenticated','public.bfe_my_hoa_balance(integer)','EXECUTE') ELSE false END,
 'preview_read_enabled',EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.bfe_account_preview_read(uuid,text,jsonb)') AND position('''bfe_my_hoa_balance''' IN prosrc)>0)
) AS hoa_balance_readiness;
