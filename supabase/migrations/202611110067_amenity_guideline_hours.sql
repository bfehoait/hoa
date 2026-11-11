-- Owner-supplied BFE Amenities Guidelines, as of 21 October 2025, pp. 1–3.
-- Apply after 066. No facility rows, rates, capacities or payments are seeded.
-- Name aliases match the frontend. Review unrecognized facility names separately.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE OR REPLACE FUNCTION public.bfe_amenity_hours_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s timestamp:=NEW.starts_at AT TIME ZONE 'Asia/Manila';
 e timestamp:=NEW.ends_at AT TIME ZONE 'Asia/Manila'; n text; weekday integer:=extract(dow FROM s);
BEGIN
 -- Cancellation/rejection must remain available for historical reservations.
 IF NEW.status NOT IN ('Pending','Approved') THEN RETURN NEW; END IF;
 SELECT lower(btrim(name)) INTO n FROM public.bfe_facilities WHERE id=NEW.facility_id;
 IF s::date<>e::date OR e<=s OR s::time<time '07:00' OR e::time>time '22:00' THEN
  RAISE EXCEPTION 'Choose an amenity time within operating hours.' USING ERRCODE='22023';
 END IF;
 IF n IN ('clubhouse','function hall') AND (
  s::time<time '08:00' OR (weekday=0 AND s::time<time '17:00' AND e::time>time '12:00')
 ) THEN
  RAISE EXCEPTION 'Function Hall hours are 8 AM-10 PM, excluding Sunday Mass from noon to 5 PM.' USING ERRCODE='22023';
 ELSIF n IN ('basketball court','open court') AND weekday=0 AND e::time>time '12:00' THEN
  RAISE EXCEPTION 'The basketball court closes at noon on Sundays.' USING ERRCODE='22023';
 ELSIF n='swimming pool' AND (
  weekday=1 OR (weekday=0 AND e::time>time '11:00') OR
  (weekday BETWEEN 2 AND 6 AND (s::time<time '09:00' OR e::time>time '21:00')) OR NEW.attendees>40
 ) THEN
  RAISE EXCEPTION 'Pool: Tue-Sat 9 AM-9 PM, Sunday 7-11 AM, closed Monday; maximum 40 people. Office verifies total admission.' USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_amenity_hours_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER bfe_amenity_hours_guard ON public.bfe_bookings;
CREATE TRIGGER bfe_amenity_hours_guard BEFORE INSERT OR UPDATE OF facility_id,starts_at,ends_at,attendees,status
 ON public.bfe_bookings FOR EACH ROW EXECUTE FUNCTION public.bfe_amenity_hours_guard();
NOTIFY pgrst,'reload schema';
COMMIT;
