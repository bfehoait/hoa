-- Owner-run after 085 (independent of 086). Owner request, 19 November 2026:
-- Buy & sell "Item category" options become Home and garden, Entertainment,
-- Clothing and accessories, Health and beauty, Pet supplies, Computers and
-- mobiles, Hobbies, Vehicles and Properties, replacing Home, Garden, Electronics
-- and Other. Only the buy-sell category options change; other fields, listings
-- and their saved categories are left as they are. Listings saved with an
-- earlier category keep it and need a new category the next time they are edited.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
UPDATE public.bfe_feature_definitions d
SET fields=(
  SELECT jsonb_agg(
    CASE WHEN f->>'key'='category'
      THEN jsonb_set(f,'{options}','["Home and garden","Entertainment","Clothing and accessories","Health and beauty","Pet supplies","Computers and mobiles","Hobbies","Vehicles","Properties"]'::jsonb)
      ELSE f END
    ORDER BY i)
  FROM jsonb_array_elements(d.fields) WITH ORDINALITY AS t(f,i))
WHERE d.code='buy-sell';
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.bfe_feature_definitions WHERE code='buy-sell'
    AND fields @> '[{"key":"category","options":["Home and garden","Properties"]}]'::jsonb)
  THEN RAISE EXCEPTION 'buy-sell category options were not updated.'; END IF;
END $$;
COMMIT;
