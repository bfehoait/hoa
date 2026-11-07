-- Apply once after 009. Read-only history for the new protected workflows.
BEGIN;
CREATE FUNCTION public.bfe_workflow_history(p_kind text,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 THEN RAISE EXCEPTION 'Active membership required.' USING ERRCODE='42501'; END IF;
 IF p_kind='feature' THEN
  IF NOT EXISTS(SELECT 1 FROM public.bfe_feature_records r JOIN public.bfe_feature_definitions d ON d.code=r.module WHERE r.id=p_id AND ((r.owner_id=auth.uid() AND public.bfe_can(d.capability,'view','own')) OR public.bfe_can(d.capability,'view','association'))) THEN RAISE EXCEPTION 'Record history unavailable.' USING ERRCODE='42501'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('action',a.action,'note',a.note,'at',a.at) ORDER BY a.id DESC),'[]') INTO result FROM (SELECT * FROM public.bfe_feature_audit WHERE record_id=p_id ORDER BY id DESC LIMIT 100) a;
 ELSIF p_kind='booking' THEN
  IF NOT EXISTS(SELECT 1 FROM public.bfe_bookings r WHERE r.id=p_id AND ((r.owner_id=auth.uid() AND public.bfe_can('calendar','view','own')) OR public.bfe_can('calendar','view','association'))) THEN RAISE EXCEPTION 'Record history unavailable.' USING ERRCODE='42501'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('action',a.action,'note',a.note,'at',a.at) ORDER BY a.id DESC),'[]') INTO result FROM (SELECT * FROM public.bfe_booking_audit WHERE booking_id=p_id ORDER BY id DESC LIMIT 100) a;
 ELSIF p_kind='visitor' THEN
  IF NOT EXISTS(SELECT 1 FROM public.bfe_visitor_passes r WHERE r.id=p_id AND ((r.owner_id=auth.uid() AND public.bfe_can('security','view','own')) OR public.bfe_can('security','view','association'))) THEN RAISE EXCEPTION 'Record history unavailable.' USING ERRCODE='42501'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('action',a.action,'note',a.note,'at',a.at) ORDER BY a.id DESC),'[]') INTO result FROM (SELECT * FROM public.bfe_visitor_audit WHERE pass_id=p_id ORDER BY id DESC LIMIT 100) a;
 ELSE RAISE EXCEPTION 'Unknown history type.' USING ERRCODE='22023'; END IF;
 RETURN result;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_workflow_history(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_workflow_history(text,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';COMMIT;
