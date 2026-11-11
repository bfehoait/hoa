-- Apply after 052. Reviewed business attributes of existing imported lots.
-- Does not change registered ownership, account links, receipts or import evidence.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_lot_business_details (
 lot_id uuid PRIMARY KEY REFERENCES public.bfe_lots(id),admin_reference text NOT NULL DEFAULT '',street text NOT NULL DEFAULT '',
 hoa_start date,area_sqm numeric(12,2) CHECK(area_sqm>0),occupancy text NOT NULL DEFAULT 'Unknown',
 remarks text NOT NULL DEFAULT '',additional_statuses text NOT NULL DEFAULT '',linear_park boolean NOT NULL DEFAULT false,
 reference text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bfe_lot_business_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_lot_business_details FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bfe_lot_business_details(p_lot uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_lot_business_details; v integer;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT public.bfe_lot_read(p_lot) THEN RAISE EXCEPTION 'Lot unavailable.' USING ERRCODE='42501'; END IF;
 SELECT version INTO v FROM public.bfe_lots WHERE id=p_lot;
 SELECT * INTO r FROM public.bfe_lot_business_details WHERE lot_id=p_lot;
 RETURN jsonb_build_object('version',v,'details',CASE WHEN r.lot_id IS NULL THEN NULL ELSE to_jsonb(r) END,'can_manage','admin'=ANY(public.bfe_current_roles()) AND public.bfe_can('property','view','association') AND public.bfe_can('property','manage','association'));
END;$$;
CREATE FUNCTION public.bfe_save_lot_business_details(p_lot uuid,p_version integer,p_fields jsonb,p_reference text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.bfe_lots; old_row public.bfe_lot_business_details; result public.bfe_lot_business_details; k text; area numeric; started date; park boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT ('admin'=ANY(public.bfe_current_roles())) OR NOT public.bfe_can('property','view','association') OR NOT public.bfe_can('property','manage','association') THEN RAISE EXCEPTION 'Office property management required.' USING ERRCODE='42501'; END IF;
 IF p_fields IS NULL OR jsonb_typeof(p_fields)<>'object' OR octet_length(p_fields::text)>12000 OR p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Check property answers and approval reference.' USING ERRCODE='22023'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_fields) LOOP
  IF k NOT IN ('admin_reference','street','hoa_start','area_sqm','occupancy','remarks','additional_statuses','linear_park') OR jsonb_typeof(p_fields->k)<>'string' OR char_length(p_fields->>k)>2000 THEN RAISE EXCEPTION 'Unsupported property answer.' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF coalesce(p_fields->>'occupancy','Unknown') NOT IN ('Owner occupied','Tenanted','Vacant','Unknown') OR coalesce(p_fields->>'linear_park','false') NOT IN ('true','false') THEN RAISE EXCEPTION 'Choose occupancy and park status.' USING ERRCODE='22023'; END IF;
 IF nullif(p_fields->>'area_sqm','') IS NOT NULL THEN
  IF p_fields->>'area_sqm' !~ '^[0-9]+([.][0-9]{1,2})?$' THEN RAISE EXCEPTION 'Use a positive lot area with up to two decimal places.' USING ERRCODE='22023'; END IF;
  area:=(p_fields->>'area_sqm')::numeric;
  IF area<=0 OR area>1000000000 THEN RAISE EXCEPTION 'Lot area is outside the allowed range.' USING ERRCODE='22023'; END IF;
 END IF;
 IF nullif(p_fields->>'hoa_start','') IS NOT NULL THEN started:=(p_fields->>'hoa_start')::date; END IF;
 park:=coalesce(p_fields->>'linear_park','false')::boolean;
 SELECT * INTO l FROM public.bfe_lots WHERE id=p_lot FOR UPDATE;
 IF l.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.bfe_import_batches WHERE id=l.batch_id AND status='active') THEN RAISE EXCEPTION 'Choose an active imported lot.' USING ERRCODE='22023'; END IF;
 SELECT * INTO old_row FROM public.bfe_lot_business_details WHERE lot_id=p_lot FOR UPDATE;
 IF p_version IS NULL OR l.version<>p_version THEN RAISE EXCEPTION 'Property changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
 INSERT INTO public.bfe_lot_business_details(lot_id,admin_reference,street,hoa_start,area_sqm,occupancy,remarks,additional_statuses,linear_park,reference)
 VALUES(p_lot,btrim(coalesce(p_fields->>'admin_reference','')),btrim(coalesce(p_fields->>'street','')),started,area,coalesce(p_fields->>'occupancy','Unknown'),btrim(coalesce(p_fields->>'remarks','')),btrim(coalesce(p_fields->>'additional_statuses','')),park,btrim(p_reference))
 ON CONFLICT(lot_id) DO UPDATE SET admin_reference=EXCLUDED.admin_reference,street=EXCLUDED.street,hoa_start=EXCLUDED.hoa_start,area_sqm=EXCLUDED.area_sqm,occupancy=EXCLUDED.occupancy,remarks=EXCLUDED.remarks,additional_statuses=EXCLUDED.additional_statuses,linear_park=EXCLUDED.linear_park,reference=EXCLUDED.reference,updated_at=now() RETURNING * INTO result;
 UPDATE public.bfe_lots SET version=version+1 WHERE id=p_lot;
 INSERT INTO public.bfe_registry_audit(lot_id,actor_id,action,details) VALUES(p_lot,auth.uid(),'Property business details updated',jsonb_build_object('reference',btrim(p_reference),'before',CASE WHEN old_row.lot_id IS NULL THEN NULL ELSE to_jsonb(old_row) END,'after',to_jsonb(result)));
END;$$;
REVOKE ALL ON FUNCTION public.bfe_lot_business_details(uuid),public.bfe_save_lot_business_details(uuid,integer,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_lot_business_details(uuid),public.bfe_save_lot_business_details(uuid,integer,jsonb,text) TO authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
