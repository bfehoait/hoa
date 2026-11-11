-- Apply after 060. Owner-approved policy: current approved household members
-- can read all existing/future receipts of their linked active imported lot.
-- Owner receipt entitlements, financial approvals/exports and balances remain separate.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.bfe_household_receipt_lots(p_user uuid) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT DISTINCT m.lot_id FROM public.bfe_lot_memberships m
 JOIN public.bfe_lots l ON l.id=m.lot_id JOIN public.bfe_import_batches b ON b.id=l.batch_id AND b.status='active'
 WHERE p_user IS NOT NULL AND cardinality(public.bfe_roles_for(p_user))>0
  AND m.user_id=p_user AND m.relationship='household' AND m.state='approved'
  AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now());
$$;
REVOKE ALL ON FUNCTION public.bfe_household_receipt_lots(uuid) FROM PUBLIC,anon,authenticated;
DO $policy$
DECLARE body text; definition text; changed text; fingerprint text;
BEGIN
 SELECT prosrc,pg_get_functiondef(oid) INTO body,definition FROM pg_proc
 WHERE oid=to_regprocedure('public.bfe_legacy_can_for(uuid,text,text,text)') AND prosecdef AND provolatile='s';
 fingerprint:=md5(regexp_replace(body,'[[:space:]]','','g'));
 IF fingerprint IS NULL OR fingerprint NOT IN ('f1264476c722a779f3244c645a685bc6','5157129e9b81ccd3aa00d8db703f2736','03507679593e9822904a2aae20462c32','ba7e537bce3d39d74e6cb6ba45fc6a4e') OR position(body IN definition)=0 THEN
  RAISE EXCEPTION 'Base access policy differs from the reviewed 023/045 policies. No changes applied; inspect it before adding household receipt viewing.';
 END IF;
 IF (SELECT count(*) FROM regexp_matches(body,'v_base[[:space:]]*:=','g'))<>1 THEN RAISE EXCEPTION 'Expected one base permission clause.'; END IF;
 changed:=regexp_replace(body,'v_base[[:space:]]*:=',$clause$v_base :=
    (p_module='finance' AND p_action='view' AND p_scope='own' AND EXISTS(SELECT 1 FROM public.bfe_household_receipt_lots(p_user_id))) OR $clause$);
 EXECUTE replace(definition,body,changed);
 SELECT prosrc,pg_get_functiondef(oid) INTO body,definition FROM pg_proc
 WHERE oid=to_regprocedure('public.bfe_receipt_read(uuid)') AND prosecdef AND provolatile='s';
 IF md5(regexp_replace(body,'[[:space:]]','','g')) IS DISTINCT FROM 'dda4459614d179d01fba5bfa0b084391' OR position(body IN definition)=0 THEN
  RAISE EXCEPTION 'Receipt read policy differs from the reviewed 005 policy. No changes applied.';
 END IF;
 changed:=replace(body,$old$public.bfe_can('finance','view','association') OR ($old$,$new$public.bfe_can('finance','view','association') OR (
 public.bfe_can('finance','view','own') AND public.bfe_lot_read(r.lot_id) AND EXISTS(SELECT 1 FROM public.bfe_household_receipt_lots(auth.uid()) h(lot_id) WHERE h.lot_id=r.lot_id)) OR ($new$);
 IF changed=body THEN RAISE EXCEPTION 'Receipt read clause could not be extended safely.'; END IF;
 EXECUTE replace(definition,body,changed);
 SELECT prosrc,pg_get_functiondef(oid) INTO body,definition FROM pg_proc
 WHERE oid=to_regprocedure('public.bfe_lot_receipts(uuid,date,date,integer,boolean)') AND prosecdef AND provolatile='s';
 IF md5(regexp_replace(body,'[[:space:]]','','g')) IS DISTINCT FROM '94f887282584621be40cf9fbc631130b' OR position(body IN definition)=0 THEN
  RAISE EXCEPTION 'Receipt history service differs from the reviewed 036 definition. No changes applied.';
 END IF;
 changed:=replace(body,'WITH entitled AS MATERIALIZED (',$new$WITH household_lots AS MATERIALIZED (
  SELECT h.lot_id FROM public.bfe_household_receipt_lots(v_actor) h(lot_id)
  WHERE NOT v_association AND v_own AND (p_lot IS NULL OR h.lot_id=p_lot) AND public.bfe_lot_read(h.lot_id)
 ), entitled AS MATERIALIZED ($new$);
 changed:=regexp_replace(changed,$pattern$WHERE[[:space:]]+NOT[[:space:]]+v_association[[:space:]]+AND[[:space:]]+v_own[[:space:]]+AND[[:space:]]+\(p_from[[:space:]]+IS[[:space:]]+NULL[[:space:]]+OR[[:space:]]+r\.receipt_date>=p_from\)[[:space:]]+AND[[:space:]]+\(p_to[[:space:]]+IS[[:space:]]+NULL[[:space:]]+OR[[:space:]]+r\.receipt_date<=p_to\)[[:space:]]+\),[[:space:]]+visible[[:space:]]+AS[[:space:]]+MATERIALIZED[[:space:]]+\($pattern$,$new$WHERE NOT v_association AND v_own
   AND NOT EXISTS(SELECT 1 FROM household_lots h WHERE h.lot_id=r.lot_id)
   AND (p_from IS NULL OR r.receipt_date>=p_from) AND (p_to IS NULL OR r.receipt_date<=p_to)
  UNION ALL
  SELECT r.* FROM household_lots h JOIN public.bfe_receipts r ON r.lot_id=h.lot_id
  WHERE (p_from IS NULL OR r.receipt_date>=p_from) AND (p_to IS NULL OR r.receipt_date<=p_to)
 ), visible AS MATERIALIZED ($new$);
 IF position('JOIN public.bfe_receipts r ON r.lot_id=h.lot_id' IN changed)=0 OR position('NOT EXISTS(SELECT 1 FROM household_lots' IN changed)=0 THEN
  RAISE EXCEPTION 'Receipt history scopes could not be extended safely.';
 END IF;
 changed:=replace(changed,'Own access still needs per-receipt entitlement.','Owner access uses receipt entitlements; approved household access covers its linked lot.');
 EXECUTE replace(definition,body,changed);
END;$policy$;
NOTIFY pgrst,'reload schema'; COMMIT;
