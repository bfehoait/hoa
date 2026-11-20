-- Owner-run after 085. Owner request, 19 November 2026: community documents use two
-- categories, "Mandatory Documents" (the Board posts them in common areas) and
-- "Member's Right to Inspect" (kept at the HOA office for members to inspect or
-- copy on request), replacing Minutes, Policy, Financial disclosure and Resolution.
-- Only the board-records category options change; the other fields, published
-- records and their saved categories are left as they are. Documents already saved
-- with an earlier category still appear under "All categories" and need a new
-- category the next time the office edits them.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
UPDATE public.bfe_feature_definitions d
SET fields=(
  SELECT jsonb_agg(
    CASE WHEN f->>'key'='category'
      THEN jsonb_set(f,'{options}','["Mandatory Documents","Member''s Right to Inspect"]'::jsonb)
      ELSE f END
    ORDER BY i)
  FROM jsonb_array_elements(d.fields) WITH ORDINALITY AS t(f,i))
WHERE d.code='board-records';
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.bfe_feature_definitions WHERE code='board-records'
    AND fields @> '[{"key":"category","options":["Mandatory Documents","Member''s Right to Inspect"]}]'::jsonb)
  THEN RAISE EXCEPTION 'board-records category options were not updated.'; END IF;
END $$;
COMMIT;
