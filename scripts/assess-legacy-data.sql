-- Read-only assessment of the OWNER-APPROVED TARGET, never the reference backend.
-- Run the complete file as postgres in SQL Editor. Returns aggregate metadata only.
-- No imports, account links, permissions or payment statuses are changed.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
  IF current_user <> 'postgres' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Run in SQL Editor as postgres.';
  END IF;
END $$;

WITH sections AS (
  SELECT key, value FROM public.portal_data
  WHERE key IN ('units','household','announcements','bookings','complaints',
    'concerns','requests','tickets','gatePasses','passes','incidents',
    'budget','dues','expenses','collectionsHistory','lotPayments','ledger')
), items AS (
  SELECT s.key, x.item FROM sections s
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE jsonb_typeof(s.value)
      WHEN 'array' THEN s.value
      WHEN 'object' THEN jsonb_build_array(s.value)
      ELSE '[]'::jsonb END
  ) AS x(item)
), field_types AS (
  SELECT i.key, f.key AS field, jsonb_typeof(f.value) AS value_type, count(*) AS occurrences
  FROM items i CROSS JOIN LATERAL jsonb_each(
    CASE WHEN jsonb_typeof(i.item)='object' THEN i.item ELSE '{}'::jsonb END
  ) f
  -- Fixed allowlist: never return unknown keys or source values.
  WHERE f.key IN ('id','physical_id','physicalId','unit','unitId','unit_id',
    'phase','block','lot','lotNo','admin_unit','owner','name','user_id','userId',
    'title','body','description','message','status','category','type',
    'date','createdAt','created_at','updatedAt','updated_at','amount','paidAt',
    'or_number','receipt_date','account_series','facility','start','end',
    'attachments','proof','email','phone')
  GROUP BY i.key, f.key, jsonb_typeof(f.value)
), active_lots AS (
  SELECT l.* FROM public.bfe_lots l
  JOIN public.bfe_import_batches b ON b.id=l.batch_id WHERE b.status='active'
), active_receipts AS (
  SELECT r.* FROM public.bfe_receipts r
  JOIN public.bfe_import_batches b ON b.id=r.batch_id WHERE b.status='active'
), reports AS (
  SELECT s.key AS section, jsonb_typeof(s.value) AS stored_type,
    md5(s.value::text) AS snapshot_digest,
    (SELECT count(*) FROM items i WHERE i.key=s.key) AS item_count,
    (SELECT count(*) FROM items i WHERE i.key=s.key AND jsonb_typeof(i.item)<>'object') AS nonobject_items,
    (SELECT count(*) - count(DISTINCT i.item->>'id') FROM items i
      WHERE i.key=s.key AND nullif(i.item->>'id','') IS NOT NULL) AS duplicate_nonempty_ids,
    coalesce((SELECT jsonb_agg(jsonb_build_object('field',f.field,'type',f.value_type,
      'occurrences',f.occurrences) ORDER BY f.field,f.value_type)
      FROM field_types f WHERE f.key=s.key),'[]'::jsonb) AS fields
  FROM sections s
)
SELECT jsonb_build_object(
  'assessment_only',true,
  'registry',jsonb_build_object(
    'active_lots',(SELECT count(*) FROM active_lots),
    'active_receipts',(SELECT count(*) FROM active_receipts),
    'total_centavos',(SELECT coalesce(sum(amount_centavos),0) FROM active_receipts),
    'lots_with_receipts',(SELECT count(DISTINCT r.lot_id) FROM active_receipts r JOIN active_lots l ON l.id=r.lot_id),
    'lots_without_receipts',(SELECT count(*) FROM active_lots l WHERE NOT EXISTS(SELECT 1 FROM active_receipts r WHERE r.lot_id=l.id)),
    'receipts_without_active_lot',(SELECT count(*) FROM active_receipts r LEFT JOIN active_lots l ON l.id=r.lot_id WHERE l.id IS NULL),
    'source_count_mismatches',(SELECT count(*) FROM active_lots l JOIN public.bfe_lot_evidence e ON e.lot_id=l.id
      WHERE e.fields ? 'Agency Receipt Transactions' AND e.fields->'Agency Receipt Transactions' IS DISTINCT FROM
        to_jsonb((SELECT count(*) FROM active_receipts r WHERE r.lot_id=l.id))),
    'example_lot_receipts',(SELECT count(*) FROM active_receipts r JOIN active_lots l ON l.id=r.lot_id WHERE l.physical_id='1-01-010')
  ),
  'legacy_sections',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.section) FROM reports r),'[]'::jsonb)
) AS assessment;
COMMIT;
