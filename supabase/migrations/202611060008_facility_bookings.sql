-- Apply once after 007. No facilities, fees or operating policies are assumed.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_facilities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE CHECK(char_length(btrim(name)) BETWEEN 3 AND 100),
 opens time NOT NULL, closes time NOT NULL CHECK(closes>opens), slot_minutes integer NOT NULL CHECK(slot_minutes IN (15,30,60)),
 max_minutes integer NOT NULL CHECK(max_minutes BETWEEN 15 AND 1440), capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 10000),
 renters boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT false,
 policy_reference text NOT NULL CHECK(char_length(btrim(policy_reference)) BETWEEN 5 AND 500), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.bfe_bookings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id), client_id uuid NOT NULL,
 facility_id uuid NOT NULL REFERENCES public.bfe_facilities(id), starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),
 purpose text NOT NULL CHECK(char_length(btrim(purpose)) BETWEEN 10 AND 1000), attendees integer NOT NULL CHECK(attendees BETWEEN 1 AND 10000),
 status text NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected','Cancelled')),
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id,client_id)
);
CREATE INDEX bfe_bookings_slots ON public.bfe_bookings(facility_id,starts_at,ends_at) WHERE status IN ('Pending','Approved');
CREATE TABLE public.bfe_booking_audit (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,booking_id uuid REFERENCES public.bfe_bookings(id),actor_id uuid NOT NULL,action text NOT NULL,note text NOT NULL,at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.bfe_facilities ENABLE ROW LEVEL SECURITY; ALTER TABLE public.bfe_bookings ENABLE ROW LEVEL SECURITY; ALTER TABLE public.bfe_booking_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_facilities,public.bfe_bookings,public.bfe_booking_audit FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.bfe_booking_audit_id_seq FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_configure_facility(p_id uuid,p_name text,p_opens time,p_closes time,p_slot integer,p_max integer,p_capacity integer,p_renters boolean,p_active boolean,p_reference text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE fid uuid;
BEGIN
 IF NOT public.bfe_can('calendar','manage','association') THEN RAISE EXCEPTION 'Facility policy management required.' USING ERRCODE='42501'; END IF;
 IF p_name IS NULL OR p_opens IS NULL OR p_closes IS NULL OR p_slot IS NULL OR p_max IS NULL OR p_capacity IS NULL OR p_renters IS NULL OR p_active IS NULL OR p_reference IS NULL OR p_closes<=p_opens OR p_slot NOT IN (15,30,60) OR p_max NOT BETWEEN 15 AND 1440 OR p_max%p_slot<>0 OR p_capacity NOT BETWEEN 1 AND 10000 OR char_length(btrim(p_name)) NOT BETWEEN 3 AND 100 OR char_length(btrim(p_reference)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Check approved facility rules and policy reference.' USING ERRCODE='22023'; END IF;
 IF p_id IS NOT NULL THEN
  PERFORM 1 FROM public.bfe_facilities WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Facility unavailable.'; END IF;
  IF EXISTS(SELECT 1 FROM public.bfe_bookings WHERE facility_id=p_id AND ends_at>now() AND status IN ('Pending','Approved')) THEN RAISE EXCEPTION 'Resolve future reservations before changing facility rules.'; END IF;
  UPDATE public.bfe_facilities SET name=btrim(p_name),opens=p_opens,closes=p_closes,slot_minutes=p_slot,max_minutes=p_max,capacity=p_capacity,renters=p_renters,active=p_active,policy_reference=btrim(p_reference),updated_at=now() WHERE id=p_id RETURNING id INTO fid;
 ELSE
  INSERT INTO public.bfe_facilities(name,opens,closes,slot_minutes,max_minutes,capacity,renters,active,policy_reference) VALUES(btrim(p_name),p_opens,p_closes,p_slot,p_max,p_capacity,p_renters,p_active,btrim(p_reference)) RETURNING id INTO fid;
 END IF;
 INSERT INTO public.bfe_booking_audit(actor_id,action,note) VALUES(auth.uid(),'Facility configured',fid::text||': '||btrim(p_reference)); RETURN fid;
END;$$;

CREATE FUNCTION public.bfe_create_booking(p_client uuid,p_facility uuid,p_start timestamptz,p_end timestamptz,p_purpose text,p_attendees integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.bfe_facilities; r public.bfe_bookings; local_start timestamp; local_end timestamp; minutes numeric;
BEGIN
 IF NOT (public.bfe_current_roles() && ARRAY['homeowner','renter']::text[]) OR NOT public.bfe_can('calendar','create','own') THEN RAISE EXCEPTION 'Resident booking permission required.' USING ERRCODE='42501'; END IF;
 IF p_client IS NULL OR p_start IS NULL OR p_end IS NULL OR p_purpose IS NULL OR p_attendees IS NULL OR char_length(btrim(p_purpose)) NOT BETWEEN 10 AND 1000 OR p_purpose !~ '[^[:space:]]' THEN RAISE EXCEPTION 'Check booking details.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('booking:'||auth.uid()::text,0));
 SELECT * INTO r FROM public.bfe_bookings WHERE owner_id=auth.uid() AND client_id=p_client;
 IF FOUND THEN
  IF r.facility_id IS DISTINCT FROM p_facility OR r.starts_at<>p_start OR r.ends_at<>p_end OR r.purpose<>btrim(p_purpose) OR r.attendees<>p_attendees THEN RAISE EXCEPTION 'Submission reference already used.' USING ERRCODE='22023'; END IF;
  RETURN r.id;
 END IF;
 SELECT * INTO f FROM public.bfe_facilities WHERE id=p_facility FOR UPDATE;
 IF f.id IS NULL OR NOT f.active OR (NOT f.renters AND NOT ('homeowner'=ANY(public.bfe_current_roles()))) THEN RAISE EXCEPTION 'This facility is unavailable for your membership.' USING ERRCODE='42501'; END IF;
 local_start:=p_start AT TIME ZONE 'Asia/Manila'; local_end:=p_end AT TIME ZONE 'Asia/Manila'; minutes:=extract(epoch FROM p_end-p_start)/60;
 IF p_start<=now() OR p_start>now()+interval '366 days' OR local_start::date<>local_end::date OR local_start::time<f.opens OR local_end::time>f.closes OR minutes<=0 OR minutes>f.max_minutes OR minutes%f.slot_minutes<>0 OR extract(epoch FROM local_start::time-f.opens)::numeric%(f.slot_minutes*60)<>0 OR p_attendees NOT BETWEEN 1 AND f.capacity THEN RAISE EXCEPTION 'Choose a future slot within approved hours, duration and capacity.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.bfe_bookings WHERE facility_id=f.id AND status IN ('Pending','Approved') AND starts_at<p_end AND ends_at>p_start) THEN RAISE EXCEPTION 'This slot was just reserved. Choose another time.'; END IF;
 IF (SELECT count(*) FROM public.bfe_bookings WHERE owner_id=auth.uid() AND created_at>now()-interval '1 minute')>=5 THEN RAISE EXCEPTION 'Please wait before submitting another booking.'; END IF;
 INSERT INTO public.bfe_bookings(owner_id,client_id,facility_id,starts_at,ends_at,purpose,attendees) VALUES(auth.uid(),p_client,p_facility,p_start,p_end,btrim(p_purpose),p_attendees) RETURNING * INTO r;
 INSERT INTO public.bfe_booking_audit(booking_id,actor_id,action,note) VALUES(r.id,auth.uid(),'Pending','Slot held pending office decision; no payment recorded'); RETURN r.id;
END;$$;

CREATE FUNCTION public.bfe_decide_booking(p_id uuid,p_version integer,p_status text,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_bookings;
BEGIN
 SELECT * INTO r FROM public.bfe_bookings WHERE id=p_id FOR UPDATE;
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR r.id IS NULL THEN RAISE EXCEPTION 'Booking unavailable.' USING ERRCODE='42501'; END IF;
 IF p_status='Cancelled' AND r.owner_id=auth.uid() AND public.bfe_can('calendar','view','own') THEN
  IF r.status NOT IN ('Pending','Approved') OR r.starts_at<=now() THEN RAISE EXCEPTION 'Booking is already closed or started.'; END IF;
 ELSE
  IF NOT public.bfe_can('calendar','view','association') OR NOT public.bfe_can('calendar','approve','association') THEN RAISE EXCEPTION 'Booking approval permission required.' USING ERRCODE='42501'; END IF;
  IF r.status<>'Pending' OR p_status IS NULL OR p_status NOT IN ('Approved','Rejected') OR r.starts_at<=now() THEN RAISE EXCEPTION 'Booking cannot receive this decision.'; END IF;
 END IF;
 IF p_version IS NULL OR r.version<>p_version THEN RAISE EXCEPTION 'Booking changed. Refresh before retrying.' USING ERRCODE='40001'; END IF;
 IF p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Provide a decision reason.' USING ERRCODE='22023'; END IF;
 UPDATE public.bfe_bookings SET status=p_status,version=version+1 WHERE id=p_id;
 INSERT INTO public.bfe_booking_audit(booking_id,actor_id,action,note) VALUES(p_id,auth.uid(),p_status,btrim(p_note));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(r.owner_id,'community','Booking: '||p_status,'Open facility bookings to check the office decision.','/more/notifications','booking:'||r.id::text||':'||(r.version+1)::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
END;$$;

CREATE FUNCTION public.bfe_booking_dashboard(p_office boolean DEFAULT false,p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb; n bigint;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT public.bfe_can('calendar','view',CASE WHEN p_office THEN 'association' ELSE 'own' END) THEN RAISE EXCEPTION 'Booking access required.' USING ERRCODE='42501'; END IF;
 IF p_office IS NULL OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Invalid page.' USING ERRCODE='22023'; END IF;
 WITH visible AS (SELECT r.*,f.name AS facility_name FROM public.bfe_bookings r JOIN public.bfe_facilities f ON f.id=r.facility_id WHERE p_office OR r.owner_id=auth.uid()), page AS (SELECT * FROM visible ORDER BY created_at DESC,id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(to_jsonb(page) ORDER BY created_at DESC,id),'[]') INTO n,rows FROM page;
 RETURN jsonb_build_object('rows',rows,'total',n,'can_manage',public.bfe_can('calendar','manage','association'),'can_approve',p_office AND public.bfe_can('calendar','approve','association'),
 'facilities',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY name) FROM public.bfe_facilities f WHERE active OR public.bfe_can('calendar','manage','association')),'[]'));
END;$$;
-- Availability exposes occupied intervals only, never another resident's booking details.
CREATE FUNCTION public.bfe_booking_availability(p_facility uuid,p_date date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT (public.bfe_can('calendar','view','own') OR public.bfe_can('calendar','view','association')) THEN RAISE EXCEPTION 'Booking access required.' USING ERRCODE='42501'; END IF;
 IF p_date IS NULL OR p_date<(now() AT TIME ZONE 'Asia/Manila')::date OR p_date>(now() AT TIME ZONE 'Asia/Manila')::date+366 THEN RAISE EXCEPTION 'Choose a valid date.' USING ERRCODE='22023'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('start',starts_at,'end',ends_at) ORDER BY starts_at) FROM public.bfe_bookings WHERE facility_id=p_facility AND status IN ('Pending','Approved') AND (starts_at AT TIME ZONE 'Asia/Manila')::date=p_date),'[]');
END;$$;
REVOKE ALL ON FUNCTION public.bfe_configure_facility(uuid,text,time,time,integer,integer,integer,boolean,boolean,text),public.bfe_create_booking(uuid,uuid,timestamptz,timestamptz,text,integer),public.bfe_decide_booking(uuid,integer,text,text),public.bfe_booking_dashboard(boolean,integer),public.bfe_booking_availability(uuid,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_configure_facility(uuid,text,time,time,integer,integer,integer,boolean,boolean,text),public.bfe_create_booking(uuid,uuid,timestamptz,timestamptz,text,integer),public.bfe_decide_booking(uuid,integer,text,text),public.bfe_booking_dashboard(boolean,integer),public.bfe_booking_availability(uuid,date) TO authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
