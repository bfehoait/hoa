-- Apply after 059. Customer address summaries read the caller's approved links.
-- Does not change recorded member addresses, ownership, links or receipt access.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.bfe_my_linked_properties() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT(public.bfe_can('property','view','own') OR public.bfe_can('property','view','association')) THEN
  RAISE EXCEPTION 'Own property access required.' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('rows',coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY phase,block,lot,lot_id) FROM (
  SELECT l.id AS lot_id,l.physical_id,l.phase,l.block,l.lot,array_agg(DISTINCT m.relationship ORDER BY m.relationship) AS relationships
  FROM public.bfe_lot_memberships m JOIN public.bfe_lots l ON l.id=m.lot_id
  JOIN public.bfe_import_batches b ON b.id=l.batch_id AND b.status='active'
  WHERE m.user_id=auth.uid() AND m.state='approved' AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now())
   AND public.bfe_lot_read(l.id)
  GROUP BY l.id,l.physical_id,l.phase,l.block,l.lot
 )q),'[]'::jsonb));
END;$$;
REVOKE ALL ON FUNCTION public.bfe_my_linked_properties() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_my_linked_properties() TO authenticated;
-- The account-preview dispatcher already runs only authorized, audited STABLE
-- reads under its selected target. Add exactly this argument-free read.
DO $preview$
DECLARE body text; definition text; changed text; marker text:='''bfe_list_lots''';
BEGIN
 SELECT prosrc,pg_get_functiondef(oid) INTO body,definition FROM pg_proc WHERE oid=to_regprocedure('public.bfe_account_preview_read(uuid,text,jsonb)') AND prosecdef;
 IF body IS NULL OR position('p_name NOT IN' IN body)=0 OR position('s.target_id::text' IN body)=0 OR position('bfe_member_inspection_audit' IN body)=0 THEN
  RAISE EXCEPTION 'Review the installed authorized account-preview read service before adding linked-property summaries.'; END IF;
 IF position('''bfe_my_linked_properties''' IN body)>0 THEN RETURN; END IF;
 IF (SELECT count(*) FROM regexp_matches(body,marker,'g'))<>1 OR position(body IN definition)=0 THEN RAISE EXCEPTION 'Expected one preview allowlist entry; no changes applied.'; END IF;
 changed:=replace(body,marker,marker||',''bfe_my_linked_properties''');
 EXECUTE replace(definition,body,changed);
END;$preview$;
NOTIFY pgrst,'reload schema'; COMMIT;
