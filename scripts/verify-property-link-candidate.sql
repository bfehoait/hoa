-- Owner-run, read-only diagnosis for the lot entered in Office.
-- Paste into SQL Editor and replace the three NULL values there with phase, block and lot.
-- Keep this source file generic; do not save private addresses into it.
-- Returns counts only: no member names, account IDs, ownership or receipts.
BEGIN READ ONLY;
SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='8s';
WITH params(phase,block,lot) AS (
 VALUES (NULL::integer,NULL::integer,NULL::integer)
), input AS (
 SELECT *,coalesce(phase>0 AND block BETWEEN 1 AND 99 AND lot BETWEEN 1 AND 999,false) AS valid,
 phase::text||'-'||lpad(block::text,2,'0')||'-'||lpad(lot::text,3,'0') AS physical FROM params
), counts AS (
 SELECT p.valid,
 count(l.id) FILTER(WHERE l.phase=p.phase AND l.block=p.block AND l.lot=p.lot) AS matching_numbered_lots,
 count(l.id) FILTER(WHERE l.physical_id=p.physical) AS matching_physical_ids,
 count(l.id) FILTER(WHERE l.physical_id=p.physical AND b.status='active') AS active_matches,
 count(l.id) FILTER(WHERE l.physical_id=p.physical AND b.status='withdrawn') AS withdrawn_matches
 FROM input p LEFT JOIN public.bfe_lots l ON p.valid AND ((l.phase=p.phase AND l.block=p.block AND l.lot=p.lot) OR l.physical_id=p.physical)
 LEFT JOIN public.bfe_import_batches b ON b.id=l.batch_id GROUP BY p.valid
)
SELECT jsonb_build_object('input_valid',valid,'matching_numbered_lots',matching_numbered_lots,'matching_physical_ids',matching_physical_ids,
 'active_matches',active_matches,'withdrawn_matches',withdrawn_matches,'next_step',CASE
 WHEN NOT valid THEN 'Enter the phase, block and lot in the params row, then rerun.'
 WHEN active_matches=1 THEN 'An active lot exists. Refresh Office, check the same numbers and review the property before linking.'
 WHEN withdrawn_matches>0 THEN 'The matching lot belongs to a withdrawn import. Review the import with the registry owner before linking.'
 WHEN matching_numbered_lots>0 THEN 'A numbered lot exists but its physical ID differs. Review the imported address mapping; do not force a different match.'
 ELSE 'No matching imported lot exists. Review the Lot register and source workbook before creating or importing any record.' END) AS property_link_check
FROM counts;
ROLLBACK;
