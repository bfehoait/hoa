-- Owner-run after 082. Owner-authorized policy: booking approvers confirm
-- and post that booking's fee atomically with approval. No payment is created.
-- Unrelated Finance posting/reversal and payment permissions remain unchanged.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';

ALTER FUNCTION public.bfe_decide_booking(uuid,integer,text,text) RENAME TO bfe_decide_booking_without_fee;
REVOKE ALL ON FUNCTION public.bfe_decide_booking_without_fee(uuid,integer,text,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bfe_decide_booking(p_id uuid,p_version integer,p_status text,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_status='Approved' THEN
  RAISE EXCEPTION 'Confirm the booking fee before approving. Use Approve and add fee.' USING ERRCODE='22023';
 END IF;
 PERFORM public.bfe_decide_booking_without_fee(p_id,p_version,p_status,p_note);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_decide_booking(uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_decide_booking(uuid,integer,text,text) TO authenticated;

CREATE FUNCTION public.bfe_booking_fee_review(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bfe_bookings; entry uuid;
BEGIN
 IF auth.uid() IS NULL OR coalesce(cardinality(public.bfe_current_roles()),0)=0
 OR NOT coalesce(public.bfe_can('calendar','view','association') AND public.bfe_can('calendar','approve','association'),false) THEN
  RAISE EXCEPTION 'Booking approval permission required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO b FROM public.bfe_bookings WHERE id=p_id;
 IF b.id IS NULL THEN RAISE EXCEPTION 'Booking unavailable.' USING ERRCODE='42501'; END IF;
 SELECT c.entry_id INTO entry FROM public.bfe_amenity_charges c JOIN public.bfe_accounting_entries e ON e.id=c.entry_id AND e.status='Posted' WHERE c.booking_id=b.id;
 RETURN jsonb_build_object('quote',(SELECT estimate FROM public.bfe_booking_prices WHERE booking_id=b.id),
  'has_charge',entry IS NOT NULL,'version',b.version,'status',b.status);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_booking_fee_review(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_booking_fee_review(uuid) TO authenticated;

-- Only this narrow RPC may create a directly posted approval charge.
-- Table writes stay denied to authenticated clients. Fee choices are confirmed
-- by the authorized approver, not copied from a resident-supplied amount.
CREATE FUNCTION public.bfe_approve_booking_with_fee(p_id uuid,p_version integer,p_rental bigint,p_reservation bigint,p_bond bigint,p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bfe_bookings; existing public.bfe_amenity_charges; e public.bfe_accounting_entries;
 payload jsonb; entry uuid:=gen_random_uuid();
BEGIN
 IF auth.uid() IS NULL OR coalesce(cardinality(public.bfe_current_roles()),0)=0
 OR NOT coalesce(public.bfe_can('calendar','view','association') AND public.bfe_can('calendar','approve','association'),false) THEN
  RAISE EXCEPTION 'Booking approval permission required.' USING ERRCODE='42501'; END IF;
 IF p_version IS NULL OR p_rental IS NULL OR p_reservation IS NULL OR p_bond IS NULL
 OR p_rental NOT BETWEEN 0 AND 1000000000000 OR p_reservation NOT BETWEEN 0 AND 1000000000000 OR p_bond NOT BETWEEN 0 AND 1000000000000
 OR p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 5 AND 500 THEN
  RAISE EXCEPTION 'Confirm each fee and explain the amount. Use zero only when no fee applies.' USING ERRCODE='22023'; END IF;
 -- Same lock order as Finance decisions avoids a duplicate charge during posting.
 PERFORM pg_advisory_xact_lock(hashtextextended('accounting-posting',0));
 SELECT * INTO b FROM public.bfe_bookings WHERE id=p_id FOR UPDATE;
 IF b.id IS NULL THEN RAISE EXCEPTION 'Booking unavailable.' USING ERRCODE='42501'; END IF;
 SELECT c.* INTO existing FROM public.bfe_amenity_charges c JOIN public.bfe_accounting_entries a ON a.id=c.entry_id AND a.status='Posted' WHERE c.booking_id=b.id;
 IF existing.entry_id IS NOT NULL THEN
  -- Retry after a lost response succeeds only for exactly this approver's action.
  IF b.status='Approved' AND b.version=p_version+1 AND existing.rental_centavos=p_rental
  AND existing.reservation_centavos=p_reservation AND existing.bond_centavos=p_bond
  AND EXISTS(SELECT 1 FROM public.bfe_accounting_audit WHERE entry_id=existing.entry_id AND actor_id=auth.uid()
   AND action='Booking fee confirmed' AND reference=btrim(p_note)) THEN RETURN existing.entry_id; END IF;
  RAISE EXCEPTION 'This booking already has a charge. Reopen it to check the saved amount.' USING ERRCODE='40001'; END IF;
 IF b.version<>p_version OR b.status NOT IN ('Pending','Approved') THEN
  RAISE EXCEPTION 'Booking changed. Reopen it before confirming the fee.' USING ERRCODE='40001'; END IF;
 IF b.status='Pending' THEN
  -- Reuse installed booking permission, future date, version, hours, overlap,
  -- decision audit and notification checks. All writes roll back on any failure.
  PERFORM public.bfe_decide_booking_without_fee(b.id,p_version,'Approved',p_note);
 ELSE
  -- Explicit repair path for already-approved bookings, never a bulk backfill.
  UPDATE public.bfe_bookings SET version=version+1 WHERE id=b.id;
  INSERT INTO public.bfe_booking_audit(booking_id,actor_id,action,note) VALUES(b.id,auth.uid(),'Fee confirmed',btrim(p_note));
 END IF;
 payload:=jsonb_build_object('booking',b.id::text,'rental',round(p_rental::numeric/100,2)::text,
  'reservation',round(p_reservation::numeric/100,2)::text,'bond',round(p_bond::numeric/100,2)::text,'memo',btrim(p_note));
 PERFORM public.bfe_validate_accounting_fields('amenity-charge',payload);
 INSERT INTO public.bfe_accounting_entries(id,kind,fields,status,creator_id,reviewer_id,review_note)
 VALUES(entry,'amenity-charge',payload,'Posted',auth.uid(),auth.uid(),'Confirmed with booking approval') RETURNING * INTO e;
 INSERT INTO public.bfe_amenity_charges(entry_id,booking_id,rental_centavos,reservation_centavos,bond_centavos)
 VALUES(entry,b.id,p_rental,p_reservation,p_bond);
 INSERT INTO public.bfe_accounting_audit(entry_id,actor_id,action,reference,before_values,after_values)
 VALUES(entry,auth.uid(),'Booking fee confirmed',btrim(p_note),NULL,to_jsonb(e));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 VALUES(b.owner_id,'community','Booking fee confirmed','Your confirmed booking fee is now in Other on My account. This is not a payment.',
 '/account','booking-fee:'||entry::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
 RETURN entry;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_approve_booking_with_fee(uuid,integer,bigint,bigint,bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_approve_booking_with_fee(uuid,integer,bigint,bigint,bigint,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
