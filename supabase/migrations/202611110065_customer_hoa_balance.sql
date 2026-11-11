-- Apply after 064. Read posted monthly HOA invoices and posted allocations for
-- the caller's current approved linked lots. No charges are created on reads.
-- Imported receipt gaps, water and other unknown charges are never estimated.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.bfe_my_hoa_balance(p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; today date:=(now() AT TIME ZONE 'Asia/Manila')::date;
BEGIN
 IF auth.uid() IS NULL OR coalesce(cardinality(public.bfe_current_roles()),0)=0 OR NOT coalesce(public.bfe_can('finance','view','own') OR public.bfe_can('finance','view','association'),false) THEN RAISE EXCEPTION 'Own finance access required.' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Check invoice page.' USING ERRCODE='22023'; END IF;
 WITH linked AS MATERIALIZED (
  SELECT DISTINCT l.id,l.physical_id FROM public.bfe_lot_memberships m JOIN public.bfe_lots l ON l.id=m.lot_id JOIN public.bfe_import_batches b ON b.id=l.batch_id AND b.status='active'
  WHERE m.user_id=auth.uid() AND m.state='approved' AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now()) AND public.bfe_lot_read(l.id)
 ), bills AS MATERIALIZED (
  SELECT i.id,i.lot_id,l.physical_id,i.period,i.due_date,i.amount_centavos,public.bfe_invoice_allocated(i.id) AS allocated
  FROM linked l JOIN public.bfe_accounting_invoices i ON i.lot_id=l.id AND NOT i.reversed JOIN public.bfe_accounting_entries e ON e.id=i.run_id AND e.kind='billing-run' AND e.status='Posted'
  WHERE i.period<=to_char(today,'YYYY-MM')
 ), visible AS MATERIALIZED (
  SELECT *,greatest(amount_centavos-allocated,0) AS remaining FROM bills
 ), page AS (SELECT * FROM visible ORDER BY period DESC,physical_id,id OFFSET p_page*20 LIMIT 20)
 SELECT jsonb_build_object(
  'as_of',today,'scope','posted_hoa_only',
  'linked_lots',(SELECT count(*) FROM linked),
  'billed_lots',(SELECT count(DISTINCT lot_id) FROM visible),
  'invoice_count',(SELECT count(*) FROM visible),
  'billed_centavos',(SELECT coalesce(sum(amount_centavos),0)::text FROM visible),
  'allocated_centavos',(SELECT coalesce(sum(allocated),0)::text FROM visible),
  'hoa_balance_centavos',(SELECT coalesce(sum(remaining),0)::text FROM visible),
  'total_recorded_balance_centavos',(SELECT coalesce(sum(remaining),0)::text FROM visible),
  'unpaid_months',(SELECT count(DISTINCT period) FROM visible WHERE remaining>0),
  'unpaid_charges',(SELECT count(*) FROM visible WHERE remaining>0),
  'overdue_charges',(SELECT count(*) FROM visible WHERE remaining>0 AND due_date<today),
  'needs_review',EXISTS(SELECT 1 FROM visible WHERE allocated>amount_centavos),
  'unallocated_centavos',(SELECT coalesce(sum(p.amount_centavos),0)::text FROM public.bfe_accounting_payments p JOIN public.bfe_accounting_entries e ON e.id=p.entry_id AND e.status='Posted' JOIN linked l ON l.id=p.lot_id WHERE p.invoice_id IS NULL),
  'rows',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'physical_id',p.physical_id,'period',p.period,'due_date',p.due_date,'billed_centavos',p.amount_centavos::text,'allocated_centavos',p.allocated::text,'balance_centavos',p.remaining::text,'status',CASE WHEN p.allocated>p.amount_centavos THEN 'Review' WHEN p.remaining=0 THEN 'Paid' WHEN p.allocated>0 THEN 'Partial' ELSE 'Unpaid' END) ORDER BY p.period DESC,p.physical_id,p.id),'[]'::jsonb) FROM page p)
 ) INTO result;
 RETURN result;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_my_hoa_balance(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_my_hoa_balance(integer) TO authenticated;

-- Authorized account preview uses the same target-scoped audited read path.
DO $preview$
DECLARE body text; definition text; changed text; marker text:='''bfe_my_linked_properties''';
BEGIN
 SELECT prosrc,pg_get_functiondef(oid) INTO body,definition FROM pg_proc WHERE oid=to_regprocedure('public.bfe_account_preview_read(uuid,text,jsonb)') AND prosecdef;
 IF body IS NULL OR position('p_name NOT IN' IN body)=0 OR position('s.target_id::text' IN body)=0 OR position('bfe_member_inspection_audit' IN body)=0 OR position(body IN definition)=0 THEN RAISE EXCEPTION 'Review the authorized account-preview dispatcher before adding the balance read.'; END IF;
 IF position('''bfe_my_hoa_balance''' IN body)>0 THEN RETURN; END IF;
 IF (SELECT count(*) FROM regexp_matches(body,marker,'g'))<>1 THEN RAISE EXCEPTION 'Expected one linked-property preview entry.'; END IF;
 changed:=replace(body,marker,marker||',''bfe_my_hoa_balance''');
 EXECUTE replace(definition,body,changed);
END;$preview$;
NOTIFY pgrst,'reload schema'; COMMIT;
