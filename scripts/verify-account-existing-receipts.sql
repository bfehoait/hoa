-- Run in the owner's SQL Editor immediately after opening the affected preview.
-- Read-only counts only. No names, account IDs, receipt details or amounts.
-- No account, lot membership or receipt entitlement is changed.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='8s';
WITH target AS MATERIALIZED (
 SELECT target_id FROM public.bfe_member_inspections
 WHERE ended_at IS NULL AND expires_at>now()
 ORDER BY created_at DESC,id LIMIT 1
), memberships AS MATERIALIZED (
 SELECT m.* FROM public.bfe_lot_memberships m
 JOIN target t ON t.target_id=m.user_id
), approved_owner_links AS MATERIALIZED (
 SELECT m.id,m.lot_id FROM memberships m
 JOIN public.bfe_lots l ON l.id=m.lot_id
 JOIN public.bfe_import_batches b ON b.id=l.batch_id AND b.status='active'
 WHERE m.relationship='owner' AND m.state='approved' AND m.starts_at<=now()
  AND (m.expires_at IS NULL OR m.expires_at>now())
), existing_lot_receipts AS MATERIALIZED (
 SELECT DISTINCT r.id FROM approved_owner_links m
 JOIN public.bfe_receipts r ON r.lot_id=m.lot_id
 JOIN public.bfe_import_batches b ON b.id=r.batch_id AND b.status='active'
), entitled_receipts AS MATERIALIZED (
 SELECT DISTINCT r.id FROM approved_owner_links m
 JOIN public.bfe_receipt_entitlements e ON e.membership_id=m.id AND e.revoked_at IS NULL
 JOIN public.bfe_receipts r ON r.id=e.receipt_id AND r.lot_id=m.lot_id
 JOIN public.bfe_import_batches b ON b.id=r.batch_id AND b.status='active'
)
SELECT jsonb_build_object(
 'active_preview_found',EXISTS(SELECT 1 FROM target),
 'target_active',(SELECT cardinality(public.bfe_roles_for(target_id))>0 FROM target),
 'finance_view_own',(SELECT public.bfe_can_for(target_id,'finance','view','own') FROM target),
 'finance_view_association',(SELECT public.bfe_can_for(target_id,'finance','view','association') FROM target),
 'current_approved_owner_links',(SELECT count(*) FROM approved_owner_links),
 'pending_owner_links',(SELECT count(*) FROM memberships WHERE relationship='owner' AND state='pending'),
 'other_approved_relationships',(SELECT count(*) FROM memberships WHERE relationship<>'owner' AND state='approved' AND starts_at<=now() AND (expires_at IS NULL OR expires_at>now())),
 'existing_receipts_for_approved_owner_lots',(SELECT count(*) FROM existing_lot_receipts),
 'entitled_existing_receipts',(SELECT count(*) FROM entitled_receipts),
 'existing_receipts_without_entitlement',(SELECT count(*) FROM existing_lot_receipts r WHERE NOT EXISTS(SELECT 1 FROM entitled_receipts e WHERE e.id=r.id))
) AS existing_receipt_check;
ROLLBACK;
