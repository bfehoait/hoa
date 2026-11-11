-- Apply after 055. Private pickup notes and assigned-driver arrival estimates.
-- The existing immediate-request, availability and 60-minute rules still apply.
-- An estimate is not a reservation or a change to the request deadline.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
ALTER TABLE public.bfe_shuttle_requests
 ADD COLUMN pickup_note text NOT NULL DEFAULT '' CHECK(char_length(pickup_note)<=1000),
 ADD COLUMN driver_note text NOT NULL DEFAULT '' CHECK(char_length(driver_note)<=1000),
 ADD COLUMN estimated_arrival timestamptz;
CREATE FUNCTION public.bfe_create_shuttle_journey(p_client uuid,p_pickup text,p_destination text,p_passengers integer,p_note text DEFAULT '') RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rid uuid; r public.bfe_shuttle_requests; existed boolean;
BEGIN
 IF p_note IS NULL OR char_length(btrim(p_note))>1000 THEN RAISE EXCEPTION 'Keep the pickup note within 1,000 characters.' USING ERRCODE='22023'; END IF;
 -- Same lock as the established creation service: retries cannot replace notes.
 PERFORM pg_advisory_xact_lock(hashtextextended('shuttle:'||auth.uid()::text,0));
 SELECT EXISTS(SELECT 1 FROM public.bfe_shuttle_requests WHERE owner_id=auth.uid() AND client_id=p_client) INTO existed;
 rid:=public.bfe_create_shuttle_request(p_client,p_pickup,p_destination,p_passengers);
 SELECT * INTO r FROM public.bfe_shuttle_requests WHERE id=rid FOR UPDATE;
 IF existed AND r.pickup_note IS DISTINCT FROM btrim(p_note) THEN RAISE EXCEPTION 'Submission reference already used with a different note.' USING ERRCODE='22023'; END IF;
 IF NOT existed THEN UPDATE public.bfe_shuttle_requests SET pickup_note=btrim(p_note) WHERE id=rid; END IF;
 RETURN rid;
END;$$;
CREATE FUNCTION public.bfe_update_shuttle_journey(p_id uuid,p_version integer,p_minutes integer,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_shuttle_requests; eta timestamptz;
BEGIN
 IF auth.uid() IS NULL OR NOT public.bfe_shuttle_driver() THEN RAISE EXCEPTION 'Authorized assigned driver required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.bfe_shuttle_requests WHERE id=p_id FOR UPDATE;
 IF r.id IS NULL OR r.driver_id IS DISTINCT FROM auth.uid() OR r.status NOT IN ('Accepted','On the way')
  OR NOT EXISTS(SELECT 1 FROM public.bfe_shuttles WHERE active AND driver_id=auth.uid() AND code=r.shuttle_code) THEN
  RAISE EXCEPTION 'Only the assigned active driver can update this journey.' USING ERRCODE='42501'; END IF;
 IF p_version IS NULL OR r.version<>p_version THEN RAISE EXCEPTION 'Request changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
 IF p_note IS NULL OR char_length(btrim(p_note))>1000 OR p_minutes IS NULL OR p_minutes NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Enter an arrival estimate of 1 to 60 minutes and a note within 1,000 characters.' USING ERRCODE='22023'; END IF;
 eta:=now()+make_interval(mins=>p_minutes);
 IF r.expires_at<=now() OR eta>r.expires_at THEN RAISE EXCEPTION 'The estimate must fit within the existing arrival deadline.' USING ERRCODE='22023'; END IF;
 UPDATE public.bfe_shuttle_requests SET estimated_arrival=eta,driver_note=btrim(p_note),version=version+1 WHERE id=p_id;
 INSERT INTO public.bfe_shuttle_audit(request_id,actor_id,action,details) VALUES(p_id,auth.uid(),'Arrival estimate updated',jsonb_build_object('before',jsonb_build_object('estimated_arrival',r.estimated_arrival,'driver_note',r.driver_note),'after',jsonb_build_object('estimated_arrival',eta,'driver_note',btrim(p_note))));
END;$$;
CREATE FUNCTION public.bfe_shuttle_journey_dashboard(p_history boolean DEFAULT false,p_page integer DEFAULT 0,p_outcome text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; rows jsonb;
BEGIN
 -- Decorate only the rows already authorized by the existing dashboard.
 result:=public.bfe_shuttle_dashboard(p_history,p_page,p_outcome);
 SELECT coalesce(jsonb_agg(j.value||jsonb_build_object('pickup_note',r.pickup_note,'driver_note',r.driver_note,'estimated_arrival',r.estimated_arrival) ORDER BY j.ord),'[]') INTO rows
 FROM jsonb_array_elements(result->'rows') WITH ORDINALITY j(value,ord)
 JOIN public.bfe_shuttle_requests r ON r.id=(j.value->>'id')::uuid;
 RETURN jsonb_set(result,'{rows}',rows);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_create_shuttle_journey(uuid,text,text,integer,text),public.bfe_update_shuttle_journey(uuid,integer,integer,text),public.bfe_shuttle_journey_dashboard(boolean,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_create_shuttle_journey(uuid,text,text,integer,text),public.bfe_update_shuttle_journey(uuid,integer,integer,text),public.bfe_shuttle_journey_dashboard(boolean,integer,text) TO authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
