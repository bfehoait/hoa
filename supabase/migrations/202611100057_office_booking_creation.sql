-- Apply after 056. Staff may record a resident's request, never impersonate them.
-- Preserves 008's slot, duration, capacity, rate-limit and overlap checks.
-- All records start Pending. Approval and calendar visibility use existing services.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.bfe_office_create_booking(p_target uuid,p_reference text,p_client uuid,p_facility uuid,p_start timestamptz,p_end timestamptz,p_purpose text,p_attendees integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.bfe_facilities; r public.bfe_bookings; local_start timestamp; local_end timestamp; minutes numeric; target_roles text[];
BEGIN
 IF auth.uid() IS NULL OR NOT ('admin'=ANY(public.bfe_current_roles())) OR NOT public.bfe_can('calendar','view','association') OR NOT public.bfe_can('calendar','create','association') OR NOT public.bfe_can('people','view','association') THEN RAISE EXCEPTION 'Office booking creation permissions required.' USING ERRCODE='42501'; END IF;
 IF p_target IS NULL OR p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Choose a resident and record the request reference.' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM public.members WHERE user_id=p_target FOR SHARE;
 target_roles:=public.bfe_roles_for(p_target);
 IF (SELECT count(*) FROM public.members WHERE user_id=p_target)<>1 OR NOT(target_roles && ARRAY['homeowner','renter']::text[]) OR NOT public.bfe_can_for(p_target,'calendar','create','own') THEN RAISE EXCEPTION 'This account is not eligible to request a booking.' USING ERRCODE='42501'; END IF;
 IF p_client IS NULL OR p_start IS NULL OR p_end IS NULL OR p_purpose IS NULL OR p_attendees IS NULL OR char_length(btrim(p_purpose)) NOT BETWEEN 10 AND 1000 OR p_purpose !~ '[^[:space:]]' THEN RAISE EXCEPTION 'Check booking details.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||p_target::text,0));
 SELECT * INTO r FROM public.bfe_bookings WHERE owner_id=p_target AND client_id=p_client;
 IF FOUND THEN
  IF r.facility_id IS DISTINCT FROM p_facility OR r.starts_at<>p_start OR r.ends_at<>p_end OR r.purpose<>btrim(p_purpose) OR r.attendees<>p_attendees THEN RAISE EXCEPTION 'Submission reference already used.' USING ERRCODE='22023'; END IF;
  RETURN r.id;
 END IF;
 SELECT * INTO f FROM public.bfe_facilities WHERE id=p_facility FOR UPDATE;
 IF f.id IS NULL OR NOT f.active OR (NOT f.renters AND NOT ('homeowner'=ANY(target_roles))) THEN RAISE EXCEPTION 'This facility is unavailable for your membership.' USING ERRCODE='42501'; END IF;
 local_start:=p_start AT TIME ZONE 'Asia/Manila'; local_end:=p_end AT TIME ZONE 'Asia/Manila'; minutes:=extract(epoch FROM p_end-p_start)/60;
 IF p_start<=now() OR p_start>now()+interval '366 days' OR local_start::date<>local_end::date OR local_start::time<f.opens OR local_end::time>f.closes OR minutes<=0 OR minutes>f.max_minutes OR minutes%f.slot_minutes<>0 OR extract(epoch FROM local_start::time-f.opens)::numeric%(f.slot_minutes*60)<>0 OR p_attendees NOT BETWEEN 1 AND f.capacity THEN RAISE EXCEPTION 'Choose a future slot within approved hours, duration and capacity.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.bfe_bookings WHERE facility_id=f.id AND status IN ('Pending','Approved') AND starts_at<p_end AND ends_at>p_start) THEN RAISE EXCEPTION 'This slot was just reserved. Choose another time.'; END IF;
 IF (SELECT count(*) FROM public.bfe_bookings WHERE owner_id=p_target AND created_at>now()-interval '1 minute')>=5 THEN RAISE EXCEPTION 'Please wait before submitting another booking.'; END IF;
 INSERT INTO public.bfe_bookings(owner_id,client_id,facility_id,starts_at,ends_at,purpose,attendees) VALUES(p_target,p_client,p_facility,p_start,p_end,btrim(p_purpose),p_attendees) RETURNING * INTO r;
 INSERT INTO public.bfe_booking_audit(booking_id,actor_id,action,note) VALUES(r.id,auth.uid(),'Pending','Office-created request: '||btrim(p_reference));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(p_target,'community','Booking request recorded','Office recorded your facility request. Approval is pending.','/more/notifications','office-booking:'||r.id::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
 RETURN r.id;
END;$$;


CREATE FUNCTION public.bfe_office_booking_members(p_search text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT ('admin'=ANY(public.bfe_current_roles())) OR NOT public.bfe_can('calendar','view','association') OR NOT public.bfe_can('calendar','create','association') OR NOT public.bfe_can('people','view','association') THEN RAISE EXCEPTION 'Office booking creation permissions required.' USING ERRCODE='42501'; END IF;
 IF p_search IS NULL OR char_length(btrim(p_search)) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Enter at least two characters of the name or address.' USING ERRCODE='22023'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(q) ORDER BY name,user_id) FROM (
  SELECT m.user_id,m.name,m.unit,public.bfe_roles_for(m.user_id) AS roles FROM public.members m
  WHERE m.user_id IS NOT NULL AND (SELECT count(*) FROM public.members d WHERE d.user_id=m.user_id)=1
  AND position(lower(btrim(p_search)) IN lower(coalesce(m.name,'')||' '||coalesce(m.unit,'')))>0
  AND public.bfe_roles_for(m.user_id) && ARRAY['homeowner','renter']::text[] AND public.bfe_can_for(m.user_id,'calendar','create','own')
  ORDER BY m.name,m.user_id LIMIT 20
 )q),'[]');
END;$$;
REVOKE ALL ON FUNCTION public.bfe_office_create_booking(uuid,text,uuid,uuid,timestamptz,timestamptz,text,integer),public.bfe_office_booking_members(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_office_create_booking(uuid,text,uuid,uuid,timestamptz,timestamptz,text,integer),public.bfe_office_booking_members(text) TO authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
