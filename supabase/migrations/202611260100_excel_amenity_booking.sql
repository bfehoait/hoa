-- HOA.xlsx amenity rules. Owner-run AFTER 099. No payment destinations or missing rates invented.
-- Three-day pencil requests do not reserve capacity; confirmed bookings take priority.
-- Existing posted charges/payments are unchanged. Approved Sunday changes apply to new/edited bookings.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE SEQUENCE public.bfe_booking_reference_seq;
REVOKE ALL ON SEQUENCE public.bfe_booking_reference_seq FROM PUBLIC,anon,authenticated;
CREATE TABLE public.bfe_booking_checkout (
 booking_id uuid PRIMARY KEY REFERENCES public.bfe_bookings(id),
 reference text NOT NULL UNIQUE, hold_until timestamptz NOT NULL DEFAULT now()+interval '3 days',
 proof_path text, offered_centavos bigint CHECK(offered_centavos>0 AND offered_centavos<=100000000000),
 receipt_number text, verified_centavos bigint CHECK(verified_centavos>0 AND verified_centavos<=100000000000),
 verified_by uuid REFERENCES auth.users(id), verified_at timestamptz, payment_entry_id uuid,
 UNIQUE(receipt_number)
);
ALTER TABLE public.bfe_booking_checkout ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_booking_checkout FROM PUBLIC,anon,authenticated;
CREATE TABLE public.bfe_booking_payment_settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 instructions text NOT NULL CHECK(length(btrim(instructions)) BETWEEN 5 AND 2000),
 -- Excel: reservation payment is 20% of the displayed Total Booking Fee.
 reservation_basis text NOT NULL DEFAULT 'rental_and_bond' CHECK(reservation_basis='rental_and_bond'),
 policy_reference text NOT NULL CHECK(length(btrim(policy_reference)) BETWEEN 5 AND 500)
);
ALTER TABLE public.bfe_booking_payment_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_booking_payment_settings FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bfe_excel_validate_booking_time(f public.bfe_facilities,p_start timestamptz,p_end timestamptz) RETURNS void
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE s timestamp:=p_start AT TIME ZONE 'Asia/Manila';e timestamp:=p_end AT TIME ZONE 'Asia/Manila';mins numeric:=extract(epoch FROM p_end-p_start)/60;n text:=lower(btrim(f.name));d integer:=extract(dow FROM s);
BEGIN
 IF p_start IS NULL OR p_end IS NULL OR p_start<=now() OR p_start>now()+interval '366 days' OR s::date<>e::date OR mins<=0
 OR s::time<f.opens OR e::time>f.closes OR mod(mins,f.slot_minutes)<>0 OR mod(extract(epoch FROM s::time-f.opens),f.slot_minutes*60)<>0
 OR s::time<time '07:00' OR e::time>time '22:00'
 OR (d=0 AND s::time<time '13:00' AND e::time>time '10:30')
 OR (n IN ('basketball court','open court') AND (mins<60 OR (d=0 AND e::time>time '12:00')))
 OR (n='function hall' AND (mins<120 OR s::time<time '08:00'))
 OR (n='swimming pool' AND (d=1 OR (d=0 AND e::time>time '11:00') OR (d BETWEEN 2 AND 6 AND (s::time<time '09:00' OR e::time>time '21:00'))))
 THEN RAISE EXCEPTION 'Choose a valid time: court minimum 1 hour, hall minimum 2 hours; all amenities close Sunday 10:30 AM to 1 PM. Opening and closing hours still apply.' USING ERRCODE='22023'; END IF;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_excel_validate_booking_time(public.bfe_facilities,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.bfe_amenity_hours_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.bfe_facilities;
BEGIN
 IF NEW.status NOT IN ('Pending','Approved') THEN RETURN NEW; END IF;
 SELECT * INTO f FROM public.bfe_facilities WHERE id=NEW.facility_id;
 -- Unchanged historical approval must still allow a valid future reservation.
 PERFORM public.bfe_excel_validate_booking_time(f,NEW.starts_at,NEW.ends_at);
 IF lower(btrim(f.name))='swimming pool' AND NEW.attendees>40 THEN RAISE EXCEPTION 'The pool limit is 40 people.' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END;$$;
-- Expand exclusive pool reservations to their full day/evening sessions.
CREATE FUNCTION public.bfe_excel_pool_window(p_start timestamptz,p_end timestamptz,p_exclusive boolean) RETURNS tstzrange
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN p_exclusive THEN tstzrange(
 ((p_start AT TIME ZONE 'Asia/Manila')::date + CASE WHEN (p_start AT TIME ZONE 'Asia/Manila')::time<time '17:00' THEN CASE WHEN extract(dow FROM p_start AT TIME ZONE 'Asia/Manila')=0 THEN time '07:00' ELSE time '09:00' END ELSE time '17:00' END) AT TIME ZONE 'Asia/Manila',
 ((p_end AT TIME ZONE 'Asia/Manila')::date + CASE WHEN extract(dow FROM p_end AT TIME ZONE 'Asia/Manila')=0 THEN time '11:00' WHEN (p_end AT TIME ZONE 'Asia/Manila')::time<=time '17:00' THEN time '17:00' ELSE time '21:00' END) AT TIME ZONE 'Asia/Manila','[)') ELSE tstzrange(p_start,p_end,'[)') END;
$$;
REVOKE ALL ON FUNCTION public.bfe_excel_pool_window(timestamptz,timestamptz,boolean) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bfe_excel_booking_conflict_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n text;ownuse text;
BEGIN
 IF NEW.status<>'Approved' THEN RETURN NEW; END IF;
 PERFORM 1 FROM public.bfe_facilities WHERE id=NEW.facility_id FOR UPDATE;
 SELECT lower(btrim(name)) INTO n FROM public.bfe_facilities WHERE id=NEW.facility_id;
 SELECT use_type INTO ownuse FROM public.bfe_booking_prices WHERE booking_id=NEW.id;
 IF EXISTS(SELECT 1 FROM public.bfe_bookings b LEFT JOIN public.bfe_booking_prices p ON p.booking_id=b.id
 WHERE b.id<>NEW.id AND b.facility_id=NEW.facility_id AND b.status='Approved'
 AND public.bfe_excel_pool_window(b.starts_at,b.ends_at,n='swimming pool' AND p.use_type='pool-exclusive') && public.bfe_excel_pool_window(NEW.starts_at,NEW.ends_at,n='swimming pool' AND ownuse='pool-exclusive')) THEN RAISE EXCEPTION 'Another booking is already confirmed for this time or exclusive pool session.' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_excel_booking_conflict_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bfe_excel_booking_conflict_guard BEFORE UPDATE OF status,starts_at,ends_at,facility_id ON public.bfe_bookings FOR EACH ROW EXECUTE FUNCTION public.bfe_excel_booking_conflict_guard();
CREATE OR REPLACE FUNCTION public.bfe_create_booking(p_client uuid,p_facility uuid,p_start timestamptz,p_end timestamptz,p_purpose text,p_attendees integer) RETURNS uuid
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
 IF p_start<=now() OR p_start>now()+interval '366 days' OR local_start::date<>local_end::date OR local_start::time<f.opens OR local_end::time>f.closes OR minutes<=0 OR (lower(btrim(f.name)) NOT IN ('basketball court','open court','function hall','swimming pool') AND minutes>f.max_minutes) OR minutes%f.slot_minutes<>0 OR extract(epoch FROM local_start::time-f.opens)::numeric%(f.slot_minutes*60)<>0 OR p_attendees NOT BETWEEN 1 AND f.capacity THEN RAISE EXCEPTION 'Choose a future slot within approved hours, duration and capacity.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.bfe_bookings WHERE facility_id=f.id AND (status='Approved' OR (status='Pending' AND NOT EXISTS(SELECT 1 FROM public.bfe_booking_checkout c WHERE c.booking_id=bfe_bookings.id))) AND starts_at<p_end AND ends_at>p_start) THEN RAISE EXCEPTION 'This slot was just reserved. Choose another time.'; END IF;
 IF (SELECT count(*) FROM public.bfe_bookings WHERE owner_id=auth.uid() AND created_at>now()-interval '1 minute')>=5 THEN RAISE EXCEPTION 'Please wait before submitting another booking.'; END IF;
 INSERT INTO public.bfe_bookings(owner_id,client_id,facility_id,starts_at,ends_at,purpose,attendees) VALUES(auth.uid(),p_client,p_facility,p_start,p_end,btrim(p_purpose),p_attendees) RETURNING * INTO r;
 INSERT INTO public.bfe_booking_audit(booking_id,actor_id,action,note) VALUES(r.id,auth.uid(),'Pending','Submitted for office review; no payment recorded'); RETURN r.id;
END;$$;
CREATE OR REPLACE FUNCTION public.bfe_office_create_booking(p_target uuid,p_reference text,p_client uuid,p_facility uuid,p_start timestamptz,p_end timestamptz,p_purpose text,p_attendees integer) RETURNS uuid
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
 IF p_start<=now() OR p_start>now()+interval '366 days' OR local_start::date<>local_end::date OR local_start::time<f.opens OR local_end::time>f.closes OR minutes<=0 OR (lower(btrim(f.name)) NOT IN ('basketball court','open court','function hall','swimming pool') AND minutes>f.max_minutes) OR minutes%f.slot_minutes<>0 OR extract(epoch FROM local_start::time-f.opens)::numeric%(f.slot_minutes*60)<>0 OR p_attendees NOT BETWEEN 1 AND f.capacity THEN RAISE EXCEPTION 'Choose a future slot within approved hours, duration and capacity.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.bfe_bookings WHERE facility_id=f.id AND (status='Approved' OR (status='Pending' AND NOT EXISTS(SELECT 1 FROM public.bfe_booking_checkout c WHERE c.booking_id=bfe_bookings.id))) AND starts_at<p_end AND ends_at>p_start) THEN RAISE EXCEPTION 'This slot was just reserved. Choose another time.'; END IF;
 IF (SELECT count(*) FROM public.bfe_bookings WHERE owner_id=p_target AND created_at>now()-interval '1 minute')>=5 THEN RAISE EXCEPTION 'Please wait before submitting another booking.'; END IF;
 INSERT INTO public.bfe_bookings(owner_id,client_id,facility_id,starts_at,ends_at,purpose,attendees) VALUES(p_target,p_client,p_facility,p_start,p_end,btrim(p_purpose),p_attendees) RETURNING * INTO r;
 INSERT INTO public.bfe_booking_audit(booking_id,actor_id,action,note) VALUES(r.id,auth.uid(),'Pending','Office-created request: '||btrim(p_reference));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(p_target,'community','Booking request recorded','Office recorded your facility request. Approval is pending.','/more/notifications','office-booking:'||r.id::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
 RETURN r.id;
END;$$;
CREATE OR REPLACE FUNCTION public.bfe_pdf_booking_price(p_name text,p_start timestamptz,p_end timestamptz,p_use text,p_adults integer,p_children integer)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE s timestamp:=p_start AT TIME ZONE 'Asia/Manila'; e timestamp:=p_end AT TIME ZONE 'Asia/Manila';
 n text:=lower(btrim(p_name)); mins numeric:=extract(epoch FROM p_end-p_start)/60;
 rental bigint; bond bigint; reservation bigint; low bigint; high bigint;
 notes text[]:=ARRAY[]::text[]; day boolean; night boolean; period text;
BEGIN
 IF p_use IS NULL OR p_start IS NULL OR p_end IS NULL OR e<=s OR s::date<>e::date
 OR p_adults IS NULL OR p_children IS NULL OR p_adults NOT BETWEEN 0 AND 10000 OR p_children NOT BETWEEN 0 AND 10000 THEN
  RAISE EXCEPTION 'Choose one date, a start and end time, and valid guest counts.' USING ERRCODE='22023'; END IF;
 day:=s::time>=time '08:00' AND e::time<=time '17:00';
 night:=s::time>=time '17:00' AND e::time<=time '22:00';
 IF n IN ('function hall','clubhouse') THEN
  IF p_use<>'hall' THEN RAISE EXCEPTION 'Choose Function Hall use.' USING ERRCODE='22023'; END IF;
  bond:=250000; reservation:=NULL;
  IF mins=540 THEN rental:=350000;
  ELSIF day AND mins=120 THEN rental:=100000;
  ELSIF night AND mins=120 THEN rental:=150000;
  ELSIF mins=300 THEN rental:=300000;
  END IF;
  IF rental IS NULL THEN notes:=array_append(notes,'Office will confirm the package or extension price for these times. Owner clarification: 9-hour package PHP 3,500 and 5-hour package PHP 3,000 apply in either period; 2 hours PHP 1,000 daytime / PHP 1,500 nighttime; extensions PHP 500/hour.'); END IF;
 ELSIF n IN ('basketball court','open court') THEN
  IF p_use NOT IN ('court-sports','court-function') THEN RAISE EXCEPTION 'Choose sports or special function.' USING ERRCODE='22023'; END IF;
  IF p_use='court-sports' THEN low:=25000; high:=30000;
   notes:=array_append(notes,'The PDF lists 2 free daytime sports hours per unit owner without electricity, subject to its same-day reservation rules. Office verifies eligibility; free use is not automatic.');
  ELSE low:=35000; high:=40000; bond:=250000; END IF;
  notes:=array_append(notes,'Hourly rate: PHP '||(low/100)::text||' daytime / PHP '||(high/100)::text||' nighttime. The PDF does not define the court day/night cutoff or partial-hour charging. Office confirms the rental price.');
 ELSIF n='swimming pool' THEN
  day:=s::time>=time '09:00' AND e::time<=time '17:00';
  night:=s::time>=time '17:00' AND e::time<=time '21:00';
  IF p_use='pool-exclusive' THEN
   bond:=250000; reservation:=NULL;
   IF extract(dow FROM s)<>0 AND day THEN rental:=500000; ELSIF extract(dow FROM s)<>0 AND night THEN rental:=400000; END IF;
   IF rental IS NULL THEN notes:=array_append(notes,'Office will confirm this package. Owner clarification: 8-hour package PHP 5,000 and 5-hour package PHP 4,000 apply in either period; extensions PHP 1,000/hour. Operating hours still apply.'); END IF;
  ELSIF p_use='pool-individual' THEN
   IF p_adults+p_children NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'Enter between 1 and 40 pool guests.' USING ERRCODE='22023'; END IF;
   IF day THEN rental:=p_adults::bigint*10000+p_children::bigint*8000;
   ELSIF night THEN rental:=p_adults::bigint*12000+p_children::bigint*10000;
   ELSE notes:=array_append(notes,'Office confirms Sunday and mixed daytime/nighttime admission prices; the PDF does not define them.'); END IF;
   notes:=array_append(notes,'PDF admission: adults PHP 100 daytime / PHP 120 nighttime; children PHP 80 daytime / PHP 100 nighttime. Office verifies child-rate eligibility; the PDF does not define the pricing age band.');
  ELSE RAISE EXCEPTION 'Choose individual admission or exclusive pool use.' USING ERRCODE='22023'; END IF;
 ELSE RAISE EXCEPTION 'Pricing is not defined for this facility in the PDF.' USING ERRCODE='22023'; END IF;
 IF reservation IS NOT NULL THEN notes:=array_append(notes,'Reservation fee PHP 2,500 is listed separately. Office confirms whether it is credited toward rental; it is not added twice in this estimate.'); END IF;
 IF bond IS NOT NULL THEN notes:=array_append(notes,'The surety bond is refundable subject to the PDF damage, cleanup and refund requirements.'); END IF;
 notes:=array_append(notes,'HOA.xlsx requires a reservation payment of at least 20% before confirmation. The full booking fee includes rental and any listed refundable bond. The reservation payment is credited toward this total.');
 period:=CASE WHEN n IN ('basketball court','open court') THEN 'Office confirmation' WHEN day THEN 'Daytime' WHEN night THEN 'Nighttime' ELSE 'Office confirmation' END;
 RETURN jsonb_build_object('policy_date','2025-10-21','use_type',p_use,'period',period,'minutes',mins,
 'adults',p_adults,'children',p_children,'rental_centavos',rental,'bond_centavos',bond,
 'reservation_centavos',reservation,'hourly_day_centavos',low,'hourly_night_centavos',high,
 'total_centavos',CASE WHEN rental IS NOT NULL THEN rental+coalesce(bond,0) ELSE NULL END,'notes',to_jsonb(notes));
END;$$;

CREATE OR REPLACE FUNCTION public.bfe_quote_booking(p_facility uuid,p_start timestamptz,p_end timestamptz,p_use text,p_adults integer,p_children integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.bfe_facilities; s timestamp:=p_start AT TIME ZONE 'Asia/Manila'; e timestamp:=p_end AT TIME ZONE 'Asia/Manila'; n text; dow integer:=extract(dow FROM s);
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT (
  public.bfe_can('calendar','create','own') OR public.bfe_can('calendar','create','association')) THEN
  RAISE EXCEPTION 'Booking access required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO f FROM public.bfe_facilities WHERE id=p_facility;
 IF f.id IS NULL OR NOT f.active THEN RAISE EXCEPTION 'Choose an available facility.' USING ERRCODE='22023'; END IF;
 n:=lower(btrim(f.name));
 PERFORM public.bfe_excel_validate_booking_time(f,p_start,p_end);
 RETURN public.bfe_pdf_booking_price(f.name,p_start,p_end,p_use,p_adults,p_children);
END;$$;
CREATE OR REPLACE FUNCTION public.bfe_booking_availability(p_facility uuid,p_date date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE n text;
BEGIN
 IF auth.uid() IS NULL OR coalesce(cardinality(public.bfe_current_roles()),0)=0 OR NOT (public.bfe_can('calendar','view','own') OR public.bfe_can('calendar','view','association')) THEN RAISE EXCEPTION 'Booking access required.' USING ERRCODE='42501'; END IF;
 IF p_date IS NULL OR p_facility IS NULL THEN RAISE EXCEPTION 'Choose a facility and date.' USING ERRCODE='22023'; END IF;
 SELECT lower(btrim(name)) INTO n FROM public.bfe_facilities WHERE id=p_facility AND active;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('start',lower(w),'end',upper(w))) FROM (
 SELECT public.bfe_excel_pool_window(b.starts_at,b.ends_at,n='swimming pool' AND p.use_type='pool-exclusive') w
 FROM public.bfe_bookings b LEFT JOIN public.bfe_booking_prices p ON p.booking_id=b.id
 WHERE b.facility_id=p_facility AND (b.starts_at AT TIME ZONE 'Asia/Manila')::date=p_date
 AND (b.status='Approved' OR (b.status='Pending' AND NOT EXISTS(SELECT 1 FROM public.bfe_booking_checkout c WHERE c.booking_id=b.id)))) q),'[]'::jsonb);
END;$$;
CREATE FUNCTION public.bfe_create_excel_booking(p_client uuid,p_facility uuid,p_start timestamptz,p_end timestamptz,p_purpose text,p_attendees integer,p_use text,p_adults integer,p_children integer,p_target uuid DEFAULT NULL,p_reference text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE bid uuid;code text;suffix text;
BEGIN
 bid:=public.bfe_create_priced_booking(p_client,p_facility,p_start,p_end,p_purpose,p_attendees,p_use,p_adults,p_children,p_target,p_reference);
 SELECT CASE lower(btrim(name)) WHEN 'swimming pool' THEN 'SP' WHEN 'basketball court' THEN 'BC' WHEN 'open court' THEN 'BC' WHEN 'function hall' THEN 'FH' ELSE 'AM' END INTO code FROM public.bfe_facilities WHERE id=p_facility;
 IF NOT EXISTS(SELECT 1 FROM public.bfe_booking_checkout WHERE booking_id=bid) THEN
 suffix:=nextval('public.bfe_booking_reference_seq')::text;
 INSERT INTO public.bfe_booking_checkout(booking_id,reference) VALUES(bid,code||'-'||to_char(p_start AT TIME ZONE 'Asia/Manila','MMDDYYYY')||'-'||lpad(suffix,greatest(3,length(suffix)),'0')) ON CONFLICT(booking_id) DO NOTHING;
 END IF;
 RETURN bid;
END;$$;
CREATE FUNCTION public.bfe_booking_checkout_read(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bfe_bookings;c public.bfe_booking_checkout;
BEGIN
 SELECT * INTO b FROM public.bfe_bookings WHERE id=p_id;
 IF auth.uid() IS NULL OR coalesce(cardinality(public.bfe_current_roles()),0)=0 OR b.id IS NULL OR NOT ((b.owner_id=auth.uid() AND public.bfe_can('calendar','view','own')) OR public.bfe_can('calendar','view','association')) THEN RAISE EXCEPTION 'Booking unavailable.' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.bfe_booking_checkout WHERE booking_id=b.id;
 RETURN jsonb_build_object('checkout',CASE WHEN c.booking_id IS NULL THEN NULL ELSE to_jsonb(c)||jsonb_build_object('status',b.status,'download_name',(SELECT regexp_replace(coalesce(m.name,'Homeowner'),'[^a-zA-Z0-9 _-]','','g') FROM public.members m WHERE m.user_id=b.owner_id LIMIT 1)||'_'||c.reference,'expired',b.status='Pending' AND c.hold_until<=now()) END,'payment_settings',(SELECT jsonb_build_object('instructions',instructions,'reservation_basis',reservation_basis) FROM public.bfe_booking_payment_settings WHERE singleton));
END;$$;
REVOKE ALL ON FUNCTION public.bfe_create_excel_booking(uuid,uuid,timestamptz,timestamptz,text,integer,text,integer,integer,uuid,text),public.bfe_booking_checkout_read(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_create_excel_booking(uuid,uuid,timestamptz,timestamptz,text,integer,text,integer,integer,uuid,text),public.bfe_booking_checkout_read(uuid) TO authenticated;
CREATE FUNCTION public.bfe_excel_checkout_seed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bfe_bookings;code text;suffix text;
 bid uuid:=coalesce((to_jsonb(NEW)->>'booking_id')::uuid,(to_jsonb(NEW)->>'id')::uuid);
BEGIN
 -- Cover legacy booking RPCs too. Historical rows are not backfilled.
 IF EXISTS(SELECT 1 FROM public.bfe_booking_checkout WHERE booking_id=bid) THEN RETURN NEW; END IF;
 SELECT * INTO b FROM public.bfe_bookings WHERE id=bid;
 SELECT CASE lower(btrim(name)) WHEN 'swimming pool' THEN 'SP' WHEN 'basketball court' THEN 'BC' WHEN 'open court' THEN 'BC' WHEN 'function hall' THEN 'FH' ELSE 'AM' END INTO code FROM public.bfe_facilities WHERE id=b.facility_id;
 suffix:=nextval('public.bfe_booking_reference_seq')::text;
 INSERT INTO public.bfe_booking_checkout(booking_id,reference) VALUES(b.id,code||'-'||to_char(b.starts_at AT TIME ZONE 'Asia/Manila','MMDDYYYY')||'-'||lpad(suffix,greatest(3,length(suffix)),'0')) ON CONFLICT(booking_id) DO NOTHING;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_excel_checkout_seed() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bfe_excel_checkout_seed AFTER INSERT ON public.bfe_booking_prices FOR EACH ROW EXECUTE FUNCTION public.bfe_excel_checkout_seed();
CREATE TRIGGER bfe_excel_checkout_booking_seed AFTER INSERT ON public.bfe_bookings FOR EACH ROW EXECUTE FUNCTION public.bfe_excel_checkout_seed();
NOTIFY pgrst,'reload schema';
COMMIT;
