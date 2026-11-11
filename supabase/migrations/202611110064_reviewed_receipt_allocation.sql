-- Apply after 063. Reconcile existing receipt evidence to posted HOA invoices
-- through the existing draft -> submit -> independent post/reverse workflow.
-- No rates, charges, allocations, payments or permission grants are seeded.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_accounting_receipt_allocations (
 entry_id uuid PRIMARY KEY REFERENCES public.bfe_accounting_entries(id),
 receipt_id uuid NOT NULL REFERENCES public.bfe_receipts(id),
 invoice_id uuid NOT NULL REFERENCES public.bfe_accounting_invoices(id),
 amount_centavos bigint NOT NULL CHECK(amount_centavos>0)
);
CREATE INDEX bfe_receipt_allocation_invoice ON public.bfe_accounting_receipt_allocations(invoice_id);
CREATE INDEX bfe_receipt_allocation_source ON public.bfe_accounting_receipt_allocations(receipt_id);
ALTER TABLE public.bfe_accounting_receipt_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_accounting_receipt_allocations FROM PUBLIC,anon,authenticated;
INSERT INTO public.bfe_accounting_form_definitions(kind,fields) VALUES('receipt-allocation',
 '[{"key":"receiptReference","label":"Imported OR number","required":true},{"key":"physicalId","label":"Physical lot ID","required":true},{"key":"allocationPeriod","label":"Verified billing month covered","type":"month","required":true},{"key":"amount","label":"Amount to allocate (PHP)","type":"number","required":true},{"key":"reference","label":"Office verification reference","required":true},{"key":"memo","label":"Allocation / baseline verification notes","type":"textarea","required":true}]');

CREATE FUNCTION public.bfe_invoice_allocated(p_invoice uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT sum(p.amount_centavos) FROM public.bfe_accounting_payments p JOIN public.bfe_accounting_entries e ON e.id=p.entry_id AND e.status='Posted' WHERE p.invoice_id=p_invoice),0)
 +coalesce((SELECT sum(a.amount_centavos) FROM public.bfe_accounting_receipt_allocations a JOIN public.bfe_accounting_entries e ON e.id=a.entry_id AND e.status='Posted' WHERE a.invoice_id=p_invoice),0);
$$;
REVOKE ALL ON FUNCTION public.bfe_invoice_allocated(uuid) FROM PUBLIC,anon,authenticated;
-- Reviewed service patches appended below. The original permissions, actor
-- separation, version checks, advisory lock and audit flow stay intact.

DO $patch$
DECLARE body text; definition text; changed text;
BEGIN
 SELECT prosrc,pg_get_functiondef(oid) INTO body,definition FROM pg_proc WHERE oid=to_regprocedure('public.bfe_validate_accounting_fields(text,jsonb)') AND prosecdef;
 IF md5(regexp_replace(body,'[[:space:]]','','g')) IS DISTINCT FROM '97dd45e02cab6726db023d6a67259d46' OR position(body IN definition)=0 THEN RAISE EXCEPTION 'Accounting service differs from reviewed 054. No changes applied; inspect before extending receipt allocation.'; END IF;
 changed:=replace(body,$old$p_kind IN ('payment','expense')$old$,$new$p_kind IN ('payment','expense','receipt-allocation')$new$);
 EXECUTE replace(definition,body,changed);
 SELECT prosrc,pg_get_functiondef(oid) INTO body,definition FROM pg_proc WHERE oid=to_regprocedure('public.bfe_decide_accounting_entry(uuid,integer,text,text)') AND prosecdef;
 IF md5(regexp_replace(body,'[[:space:]]','','g')) IS DISTINCT FROM '62935ef0f8faa191d9cb4dfc07665f9e' OR position(body IN definition)=0 THEN RAISE EXCEPTION 'Accounting service differs from reviewed 054. No changes applied; inspect before extending receipt allocation.'; END IF;
 changed:=replace(body,'billed integer:=0;','billed integer:=0; source_receipt public.bfe_receipts;');
 changed:=replace(changed,$old$SELECT coalesce(sum(p.amount_centavos),0) INTO allocated FROM public.bfe_accounting_payments p JOIN public.bfe_accounting_entries e ON e.id=p.entry_id AND e.status='Posted' WHERE p.invoice_id=invoice.id;$old$,'SELECT public.bfe_invoice_allocated(invoice.id) INTO allocated;');
 changed:=replace(changed,$old$ELSIF r.kind='expense' THEN$old$,$new$ELSIF r.kind='receipt-allocation' THEN
   SELECT x.* INTO source_receipt FROM public.bfe_receipts x JOIN public.bfe_import_batches b ON b.id=x.batch_id AND b.status='active'
   JOIN public.bfe_lots f ON f.id=x.lot_id JOIN public.bfe_import_batches lb ON lb.id=f.batch_id AND lb.status='active'
   WHERE x.or_number=r.fields->>'receiptReference' AND f.physical_id=r.fields->>'physicalId' FOR SHARE OF x,f,b,lb;
   IF source_receipt.id IS NULL THEN RAISE EXCEPTION 'Choose an existing receipt for this active property.' USING ERRCODE='22023'; END IF;
   SELECT i.* INTO invoice FROM public.bfe_accounting_invoices i JOIN public.bfe_accounting_entries run ON run.id=i.run_id AND run.status='Posted'
   WHERE i.lot_id=source_receipt.lot_id AND i.period=r.fields->>'allocationPeriod' AND NOT i.reversed FOR UPDATE OF i;
   IF invoice.id IS NULL THEN RAISE EXCEPTION 'Post the verified monthly invoice before allocating this receipt.' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM public.bfe_accounting_receipt_allocations a JOIN public.bfe_accounting_entries e ON e.id=a.entry_id AND e.status='Posted' WHERE a.receipt_id=source_receipt.id AND a.invoice_id=invoice.id) THEN RAISE EXCEPTION 'This receipt already has a posted allocation to this month. Reverse it before correcting.' USING ERRCODE='22023'; END IF;
   amount:=round((r.fields->>'amount')::numeric*100)::bigint;
   SELECT coalesce(sum(a.amount_centavos),0) INTO allocated FROM public.bfe_accounting_receipt_allocations a JOIN public.bfe_accounting_entries e ON e.id=a.entry_id AND e.status='Posted' WHERE a.receipt_id=source_receipt.id;
   IF allocated+amount>source_receipt.amount_centavos THEN RAISE EXCEPTION 'Allocation exceeds the remaining imported receipt amount.' USING ERRCODE='22023'; END IF;
   IF public.bfe_invoice_allocated(invoice.id)+amount>invoice.amount_centavos THEN RAISE EXCEPTION 'Allocation exceeds the remaining invoice amount.' USING ERRCODE='22023'; END IF;
   INSERT INTO public.bfe_accounting_receipt_allocations(entry_id,receipt_id,invoice_id,amount_centavos) VALUES(p_id,source_receipt.id,invoice.id,amount);
  ELSIF r.kind='expense' THEN$new$);
 changed:=replace(changed,$old$EXISTS(SELECT 1 FROM public.bfe_accounting_invoices i JOIN public.bfe_accounting_payments p ON p.invoice_id=i.id JOIN public.bfe_accounting_entries e ON e.id=p.entry_id AND e.status='Posted' WHERE i.run_id=p_id)$old$,$new$EXISTS(SELECT 1 FROM public.bfe_accounting_invoices i WHERE i.run_id=p_id AND public.bfe_invoice_allocated(i.id)>0)$new$);
 IF position('source_receipt public.bfe_receipts' IN changed)=0 OR position('INSERT INTO public.bfe_accounting_receipt_allocations' IN changed)=0 OR position('public.bfe_invoice_allocated(invoice.id) INTO allocated' IN changed)=0 OR position('i.run_id=p_id AND public.bfe_invoice_allocated(i.id)>0' IN changed)=0 THEN RAISE EXCEPTION 'Expected accounting allocation clauses were not found. No changes applied.'; END IF;
 EXECUTE replace(definition,body,changed);
 SELECT prosrc,pg_get_functiondef(oid) INTO body,definition FROM pg_proc WHERE oid=to_regprocedure('public.bfe_accounting_dashboard(text,text,integer,text)') AND prosecdef;
 IF md5(regexp_replace(body,'[[:space:]]','','g')) IS DISTINCT FROM 'ac6646b5ce238506cb4a398b39850963' OR position(body IN definition)=0 THEN RAISE EXCEPTION 'Accounting service differs from reviewed 054. No changes applied; inspect before extending receipt allocation.'; END IF;
 changed:=replace(body,$old$'allocated_centavos',(SELECT coalesce(sum(p.amount_centavos),0)::text FROM public.bfe_accounting_payments p JOIN public.bfe_accounting_entries e ON e.id=p.entry_id WHERE e.status='Posted' AND p.invoice_id IS NOT NULL)$old$,$new$'allocated_centavos',(SELECT coalesce(sum(public.bfe_invoice_allocated(i.id)),0)::text FROM public.bfe_accounting_invoices i WHERE NOT i.reversed)$new$);
 IF changed=body THEN RAISE EXCEPTION 'Expected accounting summary clause was not found.'; END IF;
 EXECUTE replace(definition,body,changed);
END;$patch$;
NOTIFY pgrst,'reload schema'; COMMIT;
