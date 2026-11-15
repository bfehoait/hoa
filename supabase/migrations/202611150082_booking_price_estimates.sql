-- Owner-run after 081. PDF-only estimates, never invoices or payments.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_booking_prices (
 booking_id uuid PRIMARY KEY REFERENCES public.bfe_bookings(id),
 use_type text NOT NULL, adults integer NOT NULL, children integer NOT NULL,
 estimate jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bfe_booking_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_booking_prices FROM PUBLIC,anon,authenticated;

-- Internal calculator: only exact PDF packages/rates are calculated. No
-- rounding, cheapest-package substitution, child age band or daily rate.
CREATE FUNCTION public.bfe_pdf_booking_price(p_name text,p_start timestamptz,p_end timestamptz,p_use text,p_adults integer,p_children integer)
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
  bond:=250000; reservation:=250000;
  IF day AND mins=540 THEN rental:=350000;
  ELSIF day AND mins=120 THEN rental:=100000;
  ELSIF night AND mins=120 THEN rental:=150000;
  ELSIF night AND mins=300 THEN rental:=300000;
  END IF;
  IF rental IS NULL THEN notes:=array_append(notes,'Office will confirm the package or extension price for these times. PDF: daytime 9 hours PHP 3,500 or 2 hours PHP 1,000; nighttime 5 hours PHP 3,000 or 2 hours PHP 1,500; extensions PHP 500/hour.'); END IF;
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
   bond:=250000; reservation:=250000;
   IF day AND mins=480 THEN rental:=500000; END IF;
   IF rental IS NULL THEN notes:=array_append(notes,'Office will confirm this package. PDF: 8 daytime hours PHP 5,000; 5 nighttime hours PHP 4,000; extensions PHP 1,000/hour. The listed night package duration differs from the 5:01-9 PM night window.'); END IF;
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
 notes:=array_append(notes,'An estimate is not a confirmed charge or payment. Office approval and fee confirmation are required.');
 period:=CASE WHEN n IN ('basketball court','open court') THEN 'Office confirmation' WHEN day THEN 'Daytime' WHEN night THEN 'Nighttime' ELSE 'Office confirmation' END;
 RETURN jsonb_build_object('policy_date','2025-10-21','use_type',p_use,'period',period,'minutes',mins,
 'adults',p_adults,'children',p_children,'rental_centavos',rental,'bond_centavos',bond,
 'reservation_centavos',reservation,'hourly_day_centavos',low,'hourly_night_centavos',high,
 'total_centavos',CASE WHEN p_use='pool-individual' THEN rental ELSE NULL END,'notes',to_jsonb(notes));
END;$$;
REVOKE ALL ON FUNCTION public.bfe_pdf_booking_price(text,timestamptz,timestamptz,text,integer,integer) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_quote_booking(p_facility uuid,p_start timestamptz,p_end timestamptz,p_use text,p_adults integer,p_children integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE f public.bfe_facilities; s timestamp:=p_start AT TIME ZONE 'Asia/Manila'; e timestamp:=p_end AT TIME ZONE 'Asia/Manila'; n text; dow integer:=extract(dow FROM s);
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT (
  public.bfe_can('calendar','create','own') OR public.bfe_can('calendar','create','association')) THEN
  RAISE EXCEPTION 'Booking access required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO f FROM public.bfe_facilities WHERE id=p_facility;
 IF f.id IS NULL OR NOT f.active THEN RAISE EXCEPTION 'Choose an available facility.' USING ERRCODE='22023'; END IF;
 n:=lower(btrim(f.name));
 IF p_start IS NULL OR p_end IS NULL OR p_start<=now() OR p_start>now()+interval '366 days'
 OR s::date<>e::date OR e<=s OR s::time<f.opens OR e::time>f.closes
 OR extract(epoch FROM p_end-p_start)/60>f.max_minutes
 OR mod(extract(epoch FROM p_end-p_start)/60,f.slot_minutes)<>0
 OR mod(extract(epoch FROM s::time-f.opens),f.slot_minutes*60)<>0
 OR (n IN ('function hall','clubhouse') AND (s::time<time '08:00' OR e::time>time '22:00' OR (dow=0 AND s::time<time '17:00' AND e::time>time '12:00')))
 OR (n IN ('basketball court','open court') AND (s::time<time '07:00' OR e::time>time '22:00' OR (dow=0 AND e::time>time '12:00')))
 OR (n='swimming pool' AND (dow=1 OR (dow=0 AND (s::time<time '07:00' OR e::time>time '11:00')) OR (dow BETWEEN 2 AND 6 AND (s::time<time '09:00' OR e::time>time '21:00')))) THEN
  RAISE EXCEPTION 'Choose an available time within the facility hours and booking limit.' USING ERRCODE='22023'; END IF;
 RETURN public.bfe_pdf_booking_price(f.name,p_start,p_end,p_use,p_adults,p_children);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_quote_booking(uuid,timestamptz,timestamptz,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_quote_booking(uuid,timestamptz,timestamptz,text,integer,integer) TO authenticated;

CREATE FUNCTION public.bfe_create_priced_booking(p_client uuid,p_facility uuid,p_start timestamptz,p_end timestamptz,p_purpose text,p_attendees integer,p_use text,p_adults integer,p_children integer,p_target uuid DEFAULT NULL,p_reference text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE bid uuid; price jsonb; previous public.bfe_booking_prices;
BEGIN
 -- Original create functions retain independent permissions, target eligibility,
 -- idempotency, slot/capacity/overlap/rate-limit checks and Pending status.
 IF p_target IS NULL THEN
  bid:=public.bfe_create_booking(p_client,p_facility,p_start,p_end,p_purpose,p_attendees);
 ELSE
  bid:=public.bfe_office_create_booking(p_target,p_reference,p_client,p_facility,p_start,p_end,p_purpose,p_attendees);
 END IF;
 SELECT * INTO previous FROM public.bfe_booking_prices WHERE booking_id=bid;
 IF FOUND THEN
  IF previous.use_type IS DISTINCT FROM p_use OR previous.adults IS DISTINCT FROM p_adults OR previous.children IS DISTINCT FROM p_children THEN
   RAISE EXCEPTION 'This booking was saved with different price choices. Reopen it.' USING ERRCODE='40001'; END IF;
  RETURN bid;
 END IF;
 IF p_use='pool-individual' AND p_adults+p_children IS DISTINCT FROM p_attendees THEN
  RAISE EXCEPTION 'Adults and children must add up to the attendee count.' USING ERRCODE='22023'; END IF;
 price:=public.bfe_quote_booking(p_facility,p_start,p_end,p_use,p_adults,p_children);
 INSERT INTO public.bfe_booking_prices(booking_id,use_type,adults,children,estimate) VALUES(bid,p_use,p_adults,p_children,price);
 RETURN bid;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_create_priced_booking(uuid,uuid,timestamptz,timestamptz,text,integer,text,integer,integer,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_create_priced_booking(uuid,uuid,timestamptz,timestamptz,text,integer,text,integer,integer,uuid,text) TO authenticated;

CREATE FUNCTION public.bfe_booking_price(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT EXISTS(
  SELECT 1 FROM public.bfe_bookings b WHERE b.id=p_id AND (
   (b.owner_id=auth.uid() AND public.bfe_can('calendar','view','own')) OR public.bfe_can('calendar','view','association')
  )) THEN RAISE EXCEPTION 'Booking unavailable.' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('quote',(SELECT estimate FROM public.bfe_booking_prices WHERE booking_id=p_id));
END;$$;
REVOKE ALL ON FUNCTION public.bfe_booking_price(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_booking_price(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
