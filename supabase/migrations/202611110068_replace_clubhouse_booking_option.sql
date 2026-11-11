-- Apply after 067. Replace the legacy Clubhouse choice without rewriting history.
-- No existing booking is reassigned, cancelled or repriced.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $replace$
DECLARE old public.bfe_facilities; pool_id uuid;
BEGIN
 LOCK TABLE public.bfe_facilities IN SHARE ROW EXCLUSIVE MODE;
 FOR old IN SELECT * FROM public.bfe_facilities WHERE lower(btrim(name))='clubhouse' AND active FOR UPDATE LOOP
  IF EXISTS(SELECT 1 FROM public.bfe_bookings WHERE facility_id=old.id AND status IN ('Pending','Approved') AND ends_at>now()) THEN
   RAISE EXCEPTION 'Resolve future Clubhouse reservations before replacing the booking option; history has not been changed.';
  END IF;
  SELECT id INTO pool_id FROM public.bfe_facilities WHERE lower(btrim(name))='swimming pool' AND active;
  IF pool_id IS NULL THEN
   IF EXISTS(SELECT 1 FROM public.bfe_facilities WHERE lower(btrim(name))='swimming pool') THEN
    RAISE EXCEPTION 'An inactive Swimming pool already exists. Review and activate its approved configuration first.';
   END IF;
   INSERT INTO public.bfe_facilities(name,opens,closes,slot_minutes,max_minutes,capacity,renters,active,policy_reference)
   VALUES('Swimming pool','07:00','21:00',old.slot_minutes,old.max_minutes,40,old.renters,true,
    'BFE Amenities Guidelines, 21 October 2025: pool daily schedule and 40-person capacity. Existing slot/duration and renter configuration retained for Office review.') RETURNING id INTO pool_id;
  END IF;
  UPDATE public.bfe_facilities SET active=false,updated_at=now() WHERE id=old.id;
 END LOOP;
END;$replace$;
NOTIFY pgrst,'reload schema';
COMMIT;
