-- READ ONLY. Run in the owner's SQL editor; no migration or BFE deployment.
-- Step 1: confirm the installed reader uses the 061 scope and 075 is installed.
SELECT
 coalesce(position($find$m.relationship IN ('owner','household')$find$ IN
  pg_get_functiondef(to_regprocedure('public.bfe_household_receipt_lots(uuid)')))>0,false)
  AS owner_scope_075_present,
 coalesce(position('public.bfe_household_receipt_lots(v_actor)' IN
  pg_get_functiondef(to_regprocedure('public.bfe_lot_receipts(uuid,date,date,integer,boolean)')))>0,false)
  AS history_uses_link_scope;

-- Step 2: replace the empty string below with the affected physical lot ID
-- from Office (format #-##-###). No names, emails or payment details returned.
-- Approved links are distinguished from a member's free-text recorded address.
WITH requested AS (SELECT ''::text AS physical_id),
target AS (
 SELECT l.id,l.physical_id,b.status AS lot_import_status
 FROM requested q JOIN public.bfe_lots l ON l.physical_id=q.physical_id
 JOIN public.bfe_import_batches b ON b.id=l.batch_id
)
SELECT t.physical_id,t.lot_import_status,
 (SELECT count(*) FROM public.bfe_receipts r WHERE r.lot_id=t.id) AS imported_receipts,
 (SELECT count(*) FROM public.bfe_receipts r JOIN public.bfe_import_batches b ON b.id=r.batch_id
  WHERE r.lot_id=t.id AND b.status='active') AS active_receipts,
 coalesce((SELECT jsonb_agg(jsonb_build_object(
  'relationship',m.relationship,'state',m.state,
  'started',m.starts_at<=now(),
  'unexpired',m.expires_at IS NULL OR m.expires_at>now(),
  'account_active',cardinality(public.bfe_roles_for(m.user_id))>0,
  'in_receipt_scope',EXISTS(SELECT 1 FROM public.bfe_household_receipt_lots(m.user_id) h(lot_id) WHERE h.lot_id=t.id)
 )) FROM public.bfe_lot_memberships m WHERE m.lot_id=t.id),'[]'::jsonb) AS links
FROM target t;
-- If step 2 returns no rows, check that the ID was filled in and matches an
-- imported lot. If multiple links exist, this summary does not identify which
-- person owns each link; verify the affected person privately in Office.
