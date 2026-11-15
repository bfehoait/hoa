-- Owner-run after 084. Owner clarification, 15 November 2026:
-- a dash in the hall/pool package table means the same price in either period.
-- No new day/night cutoff, partial-hour rule, extension-package choice or
-- reservation-credit rule is inferred. Existing hours/limits stay enforced.
-- Saved booking price snapshots and posted charges are not rewritten.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
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
  bond:=250000; reservation:=250000;
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
   bond:=250000; reservation:=250000;
   IF mins=480 THEN rental:=500000; ELSIF mins=300 THEN rental:=400000; END IF;
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
 notes:=array_append(notes,'An estimate is not a confirmed charge or payment. Office approval and fee confirmation are required.');
 period:=CASE WHEN n IN ('basketball court','open court') THEN 'Office confirmation' WHEN day THEN 'Daytime' WHEN night THEN 'Nighttime' ELSE 'Office confirmation' END;
 RETURN jsonb_build_object('policy_date','2025-10-21','use_type',p_use,'period',period,'minutes',mins,
 'adults',p_adults,'children',p_children,'rental_centavos',rental,'bond_centavos',bond,
 'reservation_centavos',reservation,'hourly_day_centavos',low,'hourly_night_centavos',high,
 'total_centavos',CASE WHEN p_use='pool-individual' THEN rental ELSE NULL END,'notes',to_jsonb(notes));
END;$$;
REVOKE ALL ON FUNCTION public.bfe_pdf_booking_price(text,timestamptz,timestamptz,text,integer,integer) FROM PUBLIC,anon,authenticated;


-- Recalculate only the unposted fee review; retain original saved snapshots.
CREATE OR REPLACE FUNCTION public.bfe_booking_fee_review(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bfe_bookings; entry uuid;
BEGIN
 IF auth.uid() IS NULL OR coalesce(cardinality(public.bfe_current_roles()),0)=0
 OR NOT coalesce(public.bfe_can('calendar','view','association') AND public.bfe_can('calendar','approve','association'),false) THEN
  RAISE EXCEPTION 'Booking approval permission required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO b FROM public.bfe_bookings WHERE id=p_id;
 IF b.id IS NULL THEN RAISE EXCEPTION 'Booking unavailable.' USING ERRCODE='42501'; END IF;
 SELECT c.entry_id INTO entry FROM public.bfe_amenity_charges c JOIN public.bfe_accounting_entries e ON e.id=c.entry_id AND e.status='Posted' WHERE c.booking_id=b.id;
 RETURN jsonb_build_object('quote',(SELECT CASE WHEN entry IS NULL THEN public.bfe_pdf_booking_price(f.name,b.starts_at,b.ends_at,p.use_type,p.adults,p.children) ELSE p.estimate END FROM public.bfe_booking_prices p JOIN public.bfe_facilities f ON f.id=b.facility_id WHERE p.booking_id=b.id),
  'has_charge',entry IS NOT NULL,'version',b.version,'status',b.status);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_booking_fee_review(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_booking_fee_review(uuid) TO authenticated;


-- Owners see the current unposted estimate too; posted quotes stay historical.
CREATE OR REPLACE FUNCTION public.bfe_booking_price(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT EXISTS(
  SELECT 1 FROM public.bfe_bookings b WHERE b.id=p_id AND (
   (b.owner_id=auth.uid() AND public.bfe_can('calendar','view','own')) OR public.bfe_can('calendar','view','association')
  )) THEN RAISE EXCEPTION 'Booking unavailable.' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('quote',(SELECT CASE WHEN EXISTS(SELECT 1 FROM public.bfe_amenity_charges c JOIN public.bfe_accounting_entries e ON e.id=c.entry_id AND e.status='Posted' WHERE c.booking_id=p_id)
 THEN p.estimate ELSE public.bfe_pdf_booking_price(f.name,b.starts_at,b.ends_at,p.use_type,p.adults,p.children) END
 FROM public.bfe_booking_prices p JOIN public.bfe_bookings b ON b.id=p.booking_id JOIN public.bfe_facilities f ON f.id=b.facility_id WHERE p.booking_id=p_id));
END;$$;
REVOKE ALL ON FUNCTION public.bfe_booking_price(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_booking_price(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
