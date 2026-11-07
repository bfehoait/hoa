-- Conditional feature fields and resident-created requests.
--
-- 1. A field definition may carry {"showWhen":{"key":"<other field>","in":[...]}}.
--    The field is then only asked, only required, and only accepted while that
--    other field holds one of the listed values. The client applies the same
--    rule (BaselineField.showWhen), so what a resident is asked and what is
--    stored stay identical.
-- 2. Residents may raise complaints, concerns, gate passes and visitor
--    (walk-in) requests themselves. This only lets them SUBMIT: review,
--    approval and publication stay with the office exactly as before.
BEGIN;

CREATE OR REPLACE FUNCTION public.bfe_validate_feature_fields(p_module text,p_fields jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE defs jsonb; f jsonb; v text; k text; shown boolean;
BEGIN
 SELECT fields INTO defs FROM public.bfe_feature_definitions WHERE code=p_module;
 IF defs IS NULL OR p_fields IS NULL OR jsonb_typeof(p_fields)<>'object' OR octet_length(p_fields::text)>20000 THEN RAISE EXCEPTION 'Invalid feature fields.' USING ERRCODE='22023'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_fields) LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(defs) x WHERE x->>'key'=k) THEN RAISE EXCEPTION 'Unexpected feature field.' USING ERRCODE='22023'; END IF;
 END LOOP;
 FOR f IN SELECT value FROM jsonb_array_elements(defs) LOOP
  v:=btrim(coalesce(p_fields->>(f->>'key'),''));
  shown:=NOT (f ? 'showWhen') OR (f->'showWhen'->'in') ? btrim(coalesce(p_fields->>(f->'showWhen'->>'key'),''));
  IF NOT shown THEN
   IF v<>'' THEN RAISE EXCEPTION 'Field does not apply: %',f->>'key' USING ERRCODE='22023'; END IF;
   CONTINUE;
  END IF;
  IF (p_fields ? (f->>'key') AND jsonb_typeof(p_fields->(f->>'key'))<>'string') OR char_length(v)>2000
   OR (coalesce((f->>'required')::boolean,false) AND (v='' OR v !~ '[^[:space:]]')) THEN RAISE EXCEPTION 'Check field: %',f->>'key' USING ERRCODE='22023'; END IF;
  IF v='' THEN CONTINUE; END IF;
  IF f ? 'options' AND NOT (f->'options' ? v) THEN RAISE EXCEPTION 'Invalid selection: %',f->>'key' USING ERRCODE='22023'; END IF;
  IF f->>'type'='number' THEN
   IF v !~ '^[0-9]+([.][0-9]{1,2})?$' OR length(v)>15 THEN RAISE EXCEPTION 'Invalid number.' USING ERRCODE='22023'; END IF;
   IF v::numeric<coalesce((f->>'min')::numeric,0) OR v::numeric>coalesce((f->>'max')::numeric,1000000) THEN RAISE EXCEPTION 'Number outside allowed range.' USING ERRCODE='22023'; END IF;
   IF f->>'key' IN ('capacity','seats','places','passengers') AND v::numeric<>trunc(v::numeric) THEN RAISE EXCEPTION 'Capacity and passenger counts must be whole numbers.' USING ERRCODE='22023'; END IF;
  ELSIF f->>'type'='date' THEN
   IF v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Invalid date.' USING ERRCODE='22023'; END IF;
   PERFORM v::date;
  ELSIF f->>'type'='time' AND v !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'Invalid time.' USING ERRCODE='22023';
  ELSIF f->>'type'='email' AND v !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN RAISE EXCEPTION 'Invalid email.' USING ERRCODE='22023';
  ELSIF f->>'type'='url' AND v !~ '^https://[^[:space:]@/]+[.][^[:space:]@/]+' THEN RAISE EXCEPTION 'Use a full HTTPS link without embedded credentials.' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF coalesce(p_fields->>'start','')<>'' AND coalesce(p_fields->>'end','')<>'' AND p_fields->>'end'<=p_fields->>'start' THEN RAISE EXCEPTION 'End time must be after start time.' USING ERRCODE='22023'; END IF;
 IF coalesce(p_fields->>'setup','')<>'' AND coalesce(p_fields->>'start','')<>'' AND p_fields->>'setup'>p_fields->>'start' THEN RAISE EXCEPTION 'Setup must be before the start.' USING ERRCODE='22023'; END IF;
 IF p_module='garage-sales' AND (SELECT count(*) FROM regexp_split_to_table(p_fields->>'items',E'\n') x WHERE btrim(x)<>'')>20 THEN RAISE EXCEPTION 'List at most 20 garage sale items.' USING ERRCODE='22023'; END IF;
END;$$;

UPDATE public.bfe_feature_definitions SET fields='[{"key":"category","label":"Business category","options":["Food","Home services","Retail","Other"],"required":true},{"key":"fulfilment","label":"How customers get it","options":["Pickup","Delivery","Pickup or delivery"],"required":true,"showWhen":{"key":"category","in":["Food","Retail"]}},{"key":"serviceArea","label":"Areas served","type":"text","required":true,"showWhen":{"key":"category","in":["Home services"]}},{"key":"storefront","label":"Where it operates from","options":["Home-based","Physical store","Online only"],"required":true,"showWhen":{"key":"category","in":["Retail"]}},{"key":"businessKind","label":"Describe the business","type":"text","required":false,"showWhen":{"key":"category","in":["Other"]}},{"key":"hours","label":"Sample opening hours","type":"text","required":true},{"key":"owner","label":"Sample owner label","type":"text","required":true},{"key":"contact","label":"Sample contact email","type":"email","required":true},{"key":"website","label":"Sample website","type":"url","required":false}]'::jsonb WHERE code='businesses';

UPDATE public.bfe_feature_definitions SET fields='[{"key":"purpose","label":"Pass purpose","options":["Delivery","Move-in","Move-out","Service work","Other"],"required":true},{"key":"crew","label":"Company or crew doing the work","type":"text","required":true,"showWhen":{"key":"purpose","in":["Service work"]}},{"key":"movingUnit","label":"Unit moving in or out","type":"text","required":true,"showWhen":{"key":"purpose","in":["Move-in","Move-out"]}},{"key":"purposeDetail","label":"What is the pass for","type":"text","required":true,"showWhen":{"key":"purpose","in":["Other"]}},{"key":"date","label":"Requested date","type":"date","required":true},{"key":"items","label":"Sample items, one per line","type":"textarea","required":true},{"key":"vehicle","label":"Synthetic vehicle label","type":"text","required":true},{"key":"party","label":"Synthetic visitor label","type":"text","required":true}]'::jsonb WHERE code='gate-passes';

-- Submission only. Review, approval and publication authority are unchanged.
UPDATE public.bfe_feature_definitions SET resident_create=true WHERE code IN ('complaints','concerns','gate-passes','walk-ins');

NOTIFY pgrst,'reload schema';
COMMIT;
