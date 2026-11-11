-- Apply after 061. Owner-confirmed recurring rate: PHP 900 for Linear Park,
-- PHP 800 otherwise. Unknown classifications stay unavailable. No invoices,
-- balances, payments, ownership changes or links are created.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE OR REPLACE FUNCTION public.bfe_my_linked_properties() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT(public.bfe_can('property','view','own') OR public.bfe_can('property','view','association')) THEN
  RAISE EXCEPTION 'Own property access required.' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('rows',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY phase,block,lot,lot_id) FROM (
  SELECT l.id AS lot_id,l.physical_id,l.phase,l.block,l.lot,
   array_agg(DISTINCT m.relationship ORDER BY m.relationship) AS relationships,
   CASE upper(btrim(e.fields->>'Linear Park')) WHEN 'YES' THEN 'yes' WHEN 'NO' THEN 'no' ELSE NULL END AS linear_park,
   CASE upper(btrim(e.fields->>'Linear Park')) WHEN 'YES' THEN 90000 WHEN 'NO' THEN 80000 ELSE NULL END AS monthly_dues_centavos
  FROM public.bfe_lot_memberships m JOIN public.bfe_lots l ON l.id=m.lot_id
  JOIN public.bfe_import_batches b ON b.id=l.batch_id AND b.status='active'
  LEFT JOIN public.bfe_lot_evidence e ON e.lot_id=l.id
  WHERE m.user_id=auth.uid() AND m.state='approved' AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now()) AND public.bfe_lot_read(l.id)
  GROUP BY l.id,l.physical_id,l.phase,l.block,l.lot,e.fields->>'Linear Park'
 )q),'[]'::jsonb));
END;$$;
REVOKE ALL ON FUNCTION public.bfe_my_linked_properties() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_my_linked_properties() TO authenticated;

CREATE FUNCTION public.bfe_staff_linked_properties(p_users uuid[]) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT public.bfe_can('people','view','association') OR NOT public.bfe_can('property','view','association') THEN RAISE EXCEPTION 'Office member and property access required.' USING ERRCODE='42501'; END IF;
 IF p_users IS NULL OR cardinality(p_users) NOT BETWEEN 1 AND 20 OR array_position(p_users,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Select up to twenty accounts.' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('rows',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY user_id,physical_id) FROM (
  SELECT DISTINCT m.user_id,l.physical_id,l.phase,l.block,l.lot
  FROM public.bfe_lot_memberships m JOIN public.bfe_lots l ON l.id=m.lot_id JOIN public.bfe_import_batches b ON b.id=l.batch_id AND b.status='active'
  WHERE m.user_id=ANY(p_users) AND m.state='approved' AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now()) AND public.bfe_lot_read(l.id)
 )q),'[]'::jsonb));
END;$$;
REVOKE ALL ON FUNCTION public.bfe_staff_linked_properties(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_staff_linked_properties(uuid[]) TO authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
