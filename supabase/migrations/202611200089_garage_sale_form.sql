-- Owner-run after 085 (independent of 086-088). Owner request, 20 November 2026,
-- for Livelihood > Post a listing > Garage sales:
--  * Items becomes optional.
--  * Proposed audience and Contact email are removed from the form.
--  * Field labels use Title Case.
-- Garage sale items keep their own item list and review (bfe_garage_items).
-- Saved records keep any earlier audience/contact values; the form no longer
-- sends them, so editing a sale saves it without those two fields.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
UPDATE public.bfe_feature_definitions d
SET fields=(
  SELECT jsonb_agg(
    CASE f->>'key'
      WHEN 'date' THEN jsonb_set(f,'{label}','"Sale Date"')
      WHEN 'start' THEN jsonb_set(f,'{label}','"Start Time"')
      WHEN 'end' THEN jsonb_set(f,'{label}','"End Time"')
      WHEN 'location' THEN jsonb_set(f,'{label}','"Sale Location"')
      WHEN 'items' THEN jsonb_set(jsonb_set(f,'{label}','"Items"'),'{required}','false'::jsonb)
      ELSE f END
    ORDER BY i)
  FROM jsonb_array_elements(d.fields) WITH ORDINALITY AS t(f,i)
  WHERE f->>'key' NOT IN ('visibility','contact'))
WHERE d.code='garage-sales';
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.bfe_feature_definitions WHERE code='garage-sales'
    AND fields @> '[{"key":"items","required":false}]'::jsonb)
    OR EXISTS(SELECT 1 FROM public.bfe_feature_definitions d, jsonb_array_elements(d.fields) f
      WHERE d.code='garage-sales' AND f->>'key' IN ('visibility','contact'))
  THEN RAISE EXCEPTION 'garage-sales definition was not updated.'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
