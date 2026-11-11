-- Apply after 035. Optimize reads of EXISTING receipts only.
-- No imports, payments, memberships, entitlements or permission grants added.
-- Mirrors the installed bfe_receipt_read predicate from 005 in one scoped set.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
-- Fail closed if this project has customized the existing receipt-read rule.
DO $guard$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('public.bfe_receipt_read(uuid)')
  AND p.prosecdef AND p.provolatile='s'
  AND regexp_replace(p.prosrc,'[[:space:]]','','g')=regexp_replace($expected$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.bfe_receipts r
 JOIN public.bfe_import_batches b ON b.id=r.batch_id JOIN public.bfe_lots l ON l.id=r.lot_id
 JOIN public.bfe_import_batches lb ON lb.id=l.batch_id
 WHERE r.id=p_receipt AND b.status='active' AND lb.status='active' AND (
 public.bfe_can('finance','view','association') OR (
 public.bfe_can('finance','view','own') AND EXISTS(SELECT 1 FROM public.bfe_receipt_entitlements e
 JOIN public.bfe_lot_memberships m ON m.id=e.membership_id
 WHERE e.receipt_id=r.id AND e.revoked_at IS NULL AND m.lot_id=r.lot_id AND m.user_id=auth.uid()
 AND m.relationship='owner' AND m.state='approved' AND m.starts_at<=now()
 AND (m.expires_at IS NULL OR m.expires_at>now())))));
$expected$,'[[:space:]]','','g')) THEN
  RAISE EXCEPTION 'Installed receipt access rules differ from migration 005. Review those rules before optimizing; no changes applied.';
 END IF;
END;$guard$;
CREATE OR REPLACE FUNCTION public.bfe_lot_receipts(p_lot uuid DEFAULT NULL,p_from date DEFAULT NULL,p_to date DEFAULT NULL,p_page integer DEFAULT 0,p_export boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid(); v_association boolean; v_own boolean; v_result jsonb;
BEGIN
 IF v_actor IS NULL OR cardinality(public.bfe_current_roles())=0 THEN RAISE EXCEPTION 'Active membership required.' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 OR p_export IS NULL OR (p_from IS NOT NULL AND p_to IS NOT NULL AND p_from>p_to) THEN RAISE EXCEPTION 'Invalid receipt filters.' USING ERRCODE='22023'; END IF;
 IF p_export AND NOT public.bfe_can('finance','export','association') THEN RAISE EXCEPTION 'Finance export required.' USING ERRCODE='42501'; END IF;
 IF p_lot IS NOT NULL AND NOT public.bfe_lot_read(p_lot) THEN RAISE EXCEPTION 'Lot unavailable.' USING ERRCODE='42501'; END IF;
 -- Evaluate unchanged authority once, rather than for every receipt in each
 -- detail/count/summary scan. Own access still needs per-receipt entitlement.
 v_association:=coalesce(public.bfe_can('finance','view','association'),false);
 v_own:=coalesce(public.bfe_can('finance','view','own'),false);
 WITH entitled AS MATERIALIZED (
  SELECT DISTINCT e.receipt_id,m.lot_id
  FROM public.bfe_lot_memberships m
  JOIN public.bfe_receipt_entitlements e ON e.membership_id=m.id AND e.revoked_at IS NULL
  WHERE NOT v_association AND v_own AND m.user_id=v_actor
   AND m.relationship='owner' AND m.state='approved' AND m.starts_at<=now()
   AND (m.expires_at IS NULL OR m.expires_at>now())
   AND (p_lot IS NULL OR m.lot_id=p_lot)
 ), candidates AS (
  SELECT r.* FROM public.bfe_receipts r WHERE v_association
   AND (p_lot IS NULL OR r.lot_id=p_lot)
   AND (p_from IS NULL OR r.receipt_date>=p_from) AND (p_to IS NULL OR r.receipt_date<=p_to)
  UNION ALL
  SELECT r.* FROM entitled e JOIN public.bfe_receipts r ON r.id=e.receipt_id AND r.lot_id=e.lot_id
  WHERE NOT v_association AND v_own
   AND (p_from IS NULL OR r.receipt_date>=p_from) AND (p_to IS NULL OR r.receipt_date<=p_to)
 ), visible AS MATERIALIZED (
  SELECT r.*,l.physical_id,l.phase FROM candidates r
  JOIN public.bfe_import_batches b ON b.id=r.batch_id AND b.status='active'
  JOIN public.bfe_lots l ON l.id=r.lot_id
  JOIN public.bfe_import_batches lb ON lb.id=l.batch_id AND lb.status='active'
 ), page AS (
  SELECT id,lot_id,physical_id,or_number,receipt_date,amount_centavos,account_series,payer,source_file,batch_id
  FROM visible ORDER BY receipt_date DESC,or_number
  OFFSET p_page*(CASE WHEN p_export THEN 500 ELSE 20 END)
  LIMIT (CASE WHEN p_export THEN 500 ELSE 20 END)
 ), monthly AS (
  SELECT to_char(receipt_date,'YYYY-MM') AS month,count(*) AS count,sum(amount_centavos) AS amount_centavos FROM visible GROUP BY 1
 ), phases AS (
  SELECT phase,count(*) AS count,sum(amount_centavos) AS amount_centavos FROM visible GROUP BY phase
 ), lots AS (
  SELECT physical_id,count(*) AS count,sum(amount_centavos) AS amount_centavos FROM visible GROUP BY physical_id
 )
 SELECT jsonb_build_object(
  'rows',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.receipt_date DESC,p.or_number),'[]'::jsonb) FROM page p),
  'total',(SELECT count(*) FROM visible),
  'total_centavos',(SELECT coalesce(sum(amount_centavos),0) FROM visible),
  'monthly',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.month),'[]'::jsonb) FROM monthly m),
  'phases',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.phase),'[]'::jsonb) FROM phases p),
  'lots',(SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.physical_id),'[]'::jsonb) FROM lots l)
 ) INTO v_result;
 RETURN v_result;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_lot_receipts(uuid,date,date,integer,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_lot_receipts(uuid,date,date,integer,boolean) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
