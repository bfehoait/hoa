-- Owner-run AFTER 074 (requires household receipt policy 061).
-- Owner-approved: an approved owner lot link also grants that lot's receipt
-- history. Existing approved household access is preserved. Renter-only links
-- are unchanged. No receipts, entitlements, balances or links are created.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

-- Fail closed if 061 is absent or its shared scope has been customized.
DO $guard$
DECLARE body text;
BEGIN
 SELECT prosrc INTO body FROM pg_proc
 WHERE oid=to_regprocedure('public.bfe_household_receipt_lots(uuid)')
  AND prosecdef AND provolatile='s';
 IF body IS NULL OR regexp_replace(body,'[[:space:]]','','g') IS DISTINCT FROM
  regexp_replace($expected$
 SELECT DISTINCT m.lot_id FROM public.bfe_lot_memberships m
 JOIN public.bfe_lots l ON l.id=m.lot_id JOIN public.bfe_import_batches b ON b.id=l.batch_id AND b.status='active'
 WHERE p_user IS NOT NULL AND cardinality(public.bfe_roles_for(p_user))>0
  AND m.user_id=p_user AND m.relationship='household' AND m.state='approved'
  AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now());
 $expected$,'[[:space:]]','','g') THEN
  RAISE EXCEPTION 'Receipt scope differs from migration 061. No changes applied; review the installed policy first.';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.bfe_receipt_read(uuid)')
    AND prosecdef AND position('public.bfe_household_receipt_lots(auth.uid())' IN prosrc)>0)
  OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.bfe_lot_receipts(uuid,date,date,integer,boolean)')
    AND prosecdef AND position('public.bfe_household_receipt_lots(v_actor)' IN prosrc)>0)
  OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.bfe_legacy_can_for(uuid,text,text,text)')
    AND prosecdef AND position('public.bfe_household_receipt_lots(p_user_id)' IN prosrc)>0) THEN
  RAISE EXCEPTION 'Migration 061 receipt readers/permission integration is missing. No changes applied.';
 END IF;
END;$guard$;

-- Keep the legacy helper name so permissions, individual-receipt RLS and
-- paginated history use the same scope without replacing their other checks.
CREATE OR REPLACE FUNCTION public.bfe_household_receipt_lots(p_user uuid) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT DISTINCT m.lot_id FROM public.bfe_lot_memberships m
 JOIN public.bfe_lots l ON l.id=m.lot_id
 JOIN public.bfe_import_batches b ON b.id=l.batch_id AND b.status='active'
 WHERE p_user IS NOT NULL AND cardinality(public.bfe_roles_for(p_user))>0
  AND m.user_id=p_user AND m.relationship IN ('owner','household') AND m.state='approved'
  AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now());
$$;
REVOKE ALL ON FUNCTION public.bfe_household_receipt_lots(uuid) FROM PUBLIC,anon,authenticated;
COMMENT ON FUNCTION public.bfe_household_receipt_lots(uuid) IS
 'Internal receipt scope for active approved owner/household lot links; legacy name retained for policy compatibility.';
NOTIFY pgrst,'reload schema';
COMMIT;
