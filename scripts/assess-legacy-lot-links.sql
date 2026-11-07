-- Second read-only assessment in the same owner-approved TARGET project.
-- Counts exact candidate matches only. No records or permissions are changed.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '30s';
DO $$ BEGIN
  IF current_user <> 'postgres' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Run in SQL Editor as postgres.';
  END IF;
END $$;

WITH source AS (
  SELECT key, value FROM public.portal_data
  WHERE key IN ('units','household','bookings','complaints','concerns',
    'requests','tickets','gatePasses','passes','dues')
), items AS (
  SELECT s.key AS section, x.ordinality AS position, x.item
  FROM source s CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(s.value)='array' THEN s.value ELSE '[]'::jsonb END
  ) WITH ORDINALITY x(item,ordinality)
), active_lots AS (
  SELECT l.id, l.physical_id, l.admin_unit FROM public.bfe_lots l
  JOIN public.bfe_import_batches b ON b.id=l.batch_id WHERE b.status='active'
), normalized_units AS (
  SELECT position,item,
    (regexp_match(btrim(item->>'phase'),'^(?:phase[[:space:]]*)?([1-9][0-9]{0,3})$','i'))[1] AS phase_number,
    (regexp_match(btrim(item->>'block'),'^(?:block[[:space:]]*)?([0-9]{1,2})$','i'))[1] AS block_number,
    (regexp_match(btrim(item->>'lotNo'),'^(?:lot[[:space:]]*)?([0-9]{1,3})$','i'))[1] AS lot_number
  FROM items WHERE section='units'
), units AS (
  SELECT position, item, nullif(btrim(item->>'unit'),'') AS unit_ref,
    CASE WHEN phase_number IS NOT NULL AND block_number IS NOT NULL AND lot_number IS NOT NULL
    THEN phase_number || '-' || lpad(block_number,2,'0')
      || '-' || lpad(lot_number,3,'0') END AS structured_ref
  FROM normalized_units
), unit_candidates AS (
  -- A legacy sequential `lot` number is deliberately not used as lotNo.
  -- Compare only explicit identifiers or complete phase/block/lotNo triples.
  SELECT u.position, v.ref FROM units u
  CROSS JOIN LATERAL (VALUES
    (u.structured_ref), (nullif(btrim(u.item->>'physical_id'),'')),
    (nullif(btrim(u.item->>'physicalId'),'')), (u.unit_ref)
  ) v(ref)
  WHERE v.ref ~ '^[1-9][0-9]*-[0-9]{2}-[0-9]{3}$'
  UNION ALL
  -- Admin references are compared verbatim after trimming, never reconstructed.
  SELECT u.position,l.physical_id FROM units u JOIN active_lots l
    ON l.admin_unit=u.unit_ref OR l.admin_unit=nullif(btrim(u.item->>'admin_unit'),'')
), unit_links AS (
  SELECT u.position, u.unit_ref,
    (SELECT count(DISTINCT c.ref) FROM unit_candidates c WHERE c.position=u.position) AS candidate_ids,
    (SELECT count(DISTINCT l.id) FROM unit_candidates c JOIN active_lots l ON l.physical_id=c.ref WHERE c.position=u.position) AS matched_lots,
    (SELECT min(l.physical_id) FROM unit_candidates c JOIN active_lots l ON l.physical_id=c.ref WHERE c.position=u.position) AS matched_physical_id
  FROM units u
), records AS (
  SELECT i.section,i.position,i.item,nullif(btrim(i.item->>'unit'),'') AS unit_ref
  FROM items i WHERE section<>'units'
), checks AS (
  SELECT r.section,r.position,r.unit_ref,
    (SELECT count(*) FROM unit_links u WHERE u.unit_ref=r.unit_ref) AS legacy_unit_matches,
    (SELECT count(*) FROM unit_links u WHERE u.unit_ref=r.unit_ref AND u.candidate_ids=1 AND u.matched_lots=1) AS usable_legacy_matches,
    (SELECT count(*) FROM unit_links u WHERE u.unit_ref=r.unit_ref AND u.candidate_ids>1) AS conflicting_legacy_matches,
    (SELECT count(*) FROM active_lots l WHERE l.physical_id=r.unit_ref) AS direct_lot_matches,
    (SELECT count(*) FROM unit_links u WHERE u.unit_ref=r.unit_ref AND u.matched_physical_id<>r.unit_ref) AS disagreeing_unit_matches
  FROM records r
), classified AS (
  SELECT *, CASE
    WHEN unit_ref IS NULL THEN 'missing_unit_reference'
    WHEN direct_lot_matches=1 AND disagreeing_unit_matches=0
      AND (legacy_unit_matches=0 OR (legacy_unit_matches=1 AND usable_legacy_matches=1))
      THEN 'exact_physical_id_candidate'
    WHEN direct_lot_matches=0 AND legacy_unit_matches=1 AND usable_legacy_matches=1
      THEN 'unique_legacy_unit_candidate'
    WHEN legacy_unit_matches>1 OR disagreeing_unit_matches>0 OR conflicting_legacy_matches>0 THEN 'ambiguous_or_conflicting'
    WHEN legacy_unit_matches=1 THEN 'legacy_unit_without_unique_lot'
    ELSE 'no_matching_unit_or_lot' END AS match_state
  FROM checks
), section_counts AS (
  SELECT section,count(*) AS records,
    count(*) FILTER(WHERE match_state='exact_physical_id_candidate') AS exact_physical_id_candidates,
    count(*) FILTER(WHERE match_state='unique_legacy_unit_candidate') AS unique_legacy_unit_candidates,
    count(*) FILTER(WHERE match_state='missing_unit_reference') AS missing_unit_references,
    count(*) FILTER(WHERE match_state='ambiguous_or_conflicting') AS ambiguous_or_conflicting,
    count(*) FILTER(WHERE match_state='legacy_unit_without_unique_lot') AS legacy_unit_without_unique_lot,
    count(*) FILTER(WHERE match_state='no_matching_unit_or_lot') AS unmatched
  FROM classified GROUP BY section
), format_counts AS (
  -- Mask every character; these signatures contain no source words or numbers.
  SELECT f.field, jsonb_typeof(f.value) AS value_type,
    left(regexp_replace(regexp_replace(regexp_replace(coalesce(f.value #>> '{}',''),
      '[[:alpha:]]','A','g'),'[[:digit:]]','9','g'),'[^A9 -]','?','g'),60) AS masked_format,
    count(*) AS occurrences
  FROM units u CROSS JOIN LATERAL (VALUES
    ('phase',u.item->'phase'),('block',u.item->'block'),
    ('lotNo',u.item->'lotNo'),('unit',u.item->'unit')
  ) f(field,value)
  GROUP BY f.field,jsonb_typeof(f.value),3
)
SELECT jsonb_build_object(
  'assessment_version',2,
  'assessment_only',true,
  'matching_basis','Exact identifiers only; candidates require review, no ownership or access inferred.',
  'units',jsonb_build_object(
    'records',(SELECT count(*) FROM units),
    'unique_lot_candidates',(SELECT count(*) FROM unit_links WHERE candidate_ids=1 AND matched_lots=1),
    'missing_physical_id_candidates',(SELECT count(*) FROM unit_links WHERE candidate_ids=0),
    'conflicting_physical_id_candidates',(SELECT count(*) FROM unit_links WHERE candidate_ids>1),
    'unmatched_physical_id_candidates',(SELECT count(*) FROM unit_links WHERE candidate_ids=1 AND matched_lots=0),
    'duplicate_unit_reference_groups',(SELECT count(*) FROM (SELECT unit_ref FROM units WHERE unit_ref IS NOT NULL GROUP BY unit_ref HAVING count(*)>1) d)
  ),
  'sections',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY section) FROM section_counts s),'[]'::jsonb),
  'same_id_gate_pass_candidates',(SELECT count(*) FROM items g JOIN items p ON p.section='passes'
    AND nullif(g.item->>'id','')=nullif(p.item->>'id','') WHERE g.section='gatePasses'),
  'unit_field_formats',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY field,masked_format) FROM format_counts f),'[]'::jsonb),
  'source_shapes',coalesce((SELECT jsonb_agg(jsonb_build_object('section',key,'stored_type',jsonb_typeof(value)) ORDER BY key) FROM source),'[]'::jsonb)
) AS lot_link_assessment;
COMMIT;
