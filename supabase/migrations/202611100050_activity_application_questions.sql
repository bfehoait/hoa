-- Apply after 049. Retain structured vendor/participant answers in the existing
-- capacity-controlled participation workflow. No applications are seeded.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_participation_answers (
 participation_id uuid PRIMARY KEY REFERENCES public.bfe_activity_participation(id),
 answers jsonb NOT NULL CHECK(jsonb_typeof(answers)='object')
);
ALTER TABLE public.bfe_participation_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_participation_answers FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bfe_request_business_participation(p_client uuid,p_activity uuid,p_places integer,p_details text,p_answers jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rid uuid; k text; v text; normalized jsonb:='{}'; existing jsonb; activity_module text;
BEGIN
 IF p_answers IS NULL OR jsonb_typeof(p_answers)<>'object' OR octet_length(p_answers::text)>6000 THEN RAISE EXCEPTION 'Check application answers.' USING ERRCODE='22023'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_answers) LOOP
  IF k NOT IN ('participant','phone','business','products') OR jsonb_typeof(p_answers->k)<>'string' THEN RAISE EXCEPTION 'Unsupported application question.' USING ERRCODE='22023'; END IF;
  v:=btrim(p_answers->>k);
  IF char_length(v)>(CASE k WHEN 'phone' THEN 40 WHEN 'products' THEN 1000 ELSE 120 END) THEN RAISE EXCEPTION 'Application answer is too long.' USING ERRCODE='22023'; END IF;
  IF v<>'' THEN normalized:=normalized||jsonb_build_object(k,v); END IF;
 END LOOP;
 SELECT module INTO activity_module FROM public.bfe_feature_records WHERE id=p_activity;
 IF activity_module='booth-events' AND (coalesce(normalized->>'participant','')='' OR coalesce(normalized->>'phone','')='' OR coalesce(normalized->>'business','')='' OR coalesce(normalized->>'products','')='') THEN RAISE EXCEPTION 'Enter vendor name, phone, business and products.' USING ERRCODE='22023'; END IF;
 IF activity_module<>'booth-events' AND (coalesce(normalized->>'business','')<>'' OR coalesce(normalized->>'products','')<>'') THEN RAISE EXCEPTION 'Vendor questions apply only to booth applications.' USING ERRCODE='22023'; END IF;
 rid:=public.bfe_request_participation(p_client,p_activity,p_places,p_details);
 SELECT answers INTO existing FROM public.bfe_participation_answers WHERE participation_id=rid FOR UPDATE;
 IF FOUND AND existing IS DISTINCT FROM normalized THEN RAISE EXCEPTION 'Application reference already used for different answers.' USING ERRCODE='22023'; END IF;
 INSERT INTO public.bfe_participation_answers(participation_id,answers) VALUES(rid,normalized) ON CONFLICT DO NOTHING;
 RETURN rid;
END;$$;
CREATE FUNCTION public.bfe_business_participation_dashboard(p_module text,p_office boolean DEFAULT false,p_pending boolean DEFAULT false,p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; rows jsonb;
BEGIN
 IF p_office IS NULL OR p_pending IS NULL THEN RAISE EXCEPTION 'Check application view.' USING ERRCODE='22023'; END IF;
 IF p_office AND p_pending THEN result:=public.bfe_office_participation_queue(p_module,p_page);
 ELSE result:=public.bfe_participation_dashboard(p_module,p_office,p_page); END IF;
 -- Only decorate rows already returned by the installed authorized service.
 SELECT coalesce(jsonb_agg(r.value||jsonb_build_object('answers',coalesce(a.answers,'{}')) ORDER BY r.ordinality),'[]') INTO rows
 FROM jsonb_array_elements(result->'rows') WITH ORDINALITY r(value,ordinality)
 LEFT JOIN public.bfe_participation_answers a ON a.participation_id=(r.value->>'id')::uuid;
 RETURN jsonb_set(result,'{rows}',rows);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_request_business_participation(uuid,uuid,integer,text,jsonb),public.bfe_business_participation_dashboard(text,boolean,boolean,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_request_business_participation(uuid,uuid,integer,text,jsonb),public.bfe_business_participation_dashboard(text,boolean,boolean,integer) TO authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
