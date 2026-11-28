-- AFTER 101. Narrow Office verification flow from HOA.xlsx; independent Finance
-- workflows elsewhere are unchanged. Both calendar approval and Finance approval are required.
-- No bank, GCash, QR or receipt file is seeded. Reservation payment is 20% of Total Booking Fee.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $$
DECLARE rule text;
BEGIN
 SELECT pg_get_expr(conbin,conrelid) INTO rule FROM pg_constraint WHERE conrelid='public.bfe_notifications'::regclass AND conname='bfe_notifications_path_check';
 IF rule IS NULL THEN RAISE EXCEPTION 'Review the notification path policy before installing booking payments.'; END IF;
 ALTER TABLE public.bfe_notifications DROP CONSTRAINT bfe_notifications_path_check;
 EXECUTE 'ALTER TABLE public.bfe_notifications ADD CONSTRAINT bfe_notifications_path_check CHECK (path=''/services/bookings'' OR ('||rule||'))';
END;$$;
ALTER FUNCTION public.bfe_approve_booking_with_fee(uuid,integer,bigint,bigint,bigint,text) RENAME TO bfe_approve_booking_with_fee_before_excel;
REVOKE ALL ON FUNCTION public.bfe_approve_booking_with_fee_before_excel(uuid,integer,bigint,bigint,bigint,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bfe_approve_booking_with_fee(p_id uuid,p_version integer,p_rental bigint,p_reservation bigint,p_bond bigint,p_note text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.bfe_booking_checkout WHERE booking_id=p_id) THEN RAISE EXCEPTION 'Verify the booking payment and receipt before approving.' USING ERRCODE='22023'; END IF;
 RETURN public.bfe_approve_booking_with_fee_before_excel(p_id,p_version,p_rental,p_reservation,p_bond,p_note);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_approve_booking_with_fee(uuid,integer,bigint,bigint,bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_approve_booking_with_fee(uuid,integer,bigint,bigint,bigint,text) TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('bfe-booking-proofs','bfe-booking-proofs',false,8388608,ARRAY['image/jpeg','image/png','image/webp','application/pdf']) ON CONFLICT(id) DO NOTHING;
-- Never reuse a public or unrestricted bucket for private payment proofs.
DO $proof_bucket$
BEGIN
 IF EXISTS(SELECT 1 FROM storage.buckets WHERE id='bfe-booking-proofs' AND (
  public IS DISTINCT FROM false OR file_size_limit IS NULL OR file_size_limit>8388608
  OR allowed_mime_types IS NULL OR NOT (allowed_mime_types <@ ARRAY['image/jpeg','image/png','image/webp','application/pdf']::text[])
 )) THEN RAISE EXCEPTION 'Booking proof bucket must be private, limited to 8 MB and approved file types. Review its settings before applying 102.'; END IF;
END;$proof_bucket$;
CREATE FUNCTION public.bfe_booking_proof_allowed(p_path text,p_write boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND coalesce(cardinality(public.bfe_current_roles()),0)>0 AND EXISTS(
 SELECT 1 FROM public.bfe_bookings b JOIN public.bfe_booking_checkout c ON c.booking_id=b.id
 WHERE split_part(p_path,'/',1)=b.owner_id::text AND split_part(p_path,'/',2)=b.id::text
 AND p_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|pdf)$'
 AND CASE WHEN p_write THEN b.owner_id=auth.uid() AND public.bfe_can('calendar','create','own') AND b.status='Pending' AND b.starts_at>now() AND c.hold_until>now() AND c.verified_at IS NULL
 ELSE (b.owner_id=auth.uid() AND public.bfe_can('calendar','view','own')) OR (public.bfe_can('calendar','view','association') AND public.bfe_can('calendar','approve','association')) END);
$$;
REVOKE ALL ON FUNCTION public.bfe_booking_proof_allowed(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_booking_proof_allowed(text,boolean) TO authenticated;
CREATE POLICY bfe_booking_proof_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='bfe-booking-proofs' AND public.bfe_booking_proof_allowed(name,true));
CREATE POLICY bfe_booking_proof_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='bfe-booking-proofs' AND public.bfe_booking_proof_allowed(name,false));
CREATE FUNCTION public.bfe_submit_booking_proof(p_id uuid,p_path text,p_amount bigint) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.bfe_booking_checkout;b public.bfe_bookings;q jsonb;basis text;minimum numeric;
BEGIN
 SELECT * INTO b FROM public.bfe_bookings WHERE id=p_id FOR UPDATE;
 SELECT * INTO c FROM public.bfe_booking_checkout WHERE booking_id=p_id;
 IF NOT coalesce(public.bfe_booking_proof_allowed(p_path,true),false) OR split_part(p_path,'/',2) IS DISTINCT FROM p_id::text THEN RAISE EXCEPTION 'Booking proof upload is not available.' USING ERRCODE='42501'; END IF;
 basis:='rental_and_bond'; -- 20% of Total Booking Fee, as specified in HOA.xlsx.
 SELECT public.bfe_pdf_booking_price(f.name,b.starts_at,b.ends_at,p.use_type,p.adults,p.children) INTO q FROM public.bfe_booking_prices p JOIN public.bfe_facilities f ON f.id=b.facility_id WHERE p.booking_id=b.id;
 minimum:=CASE WHEN q->>'rental_centavos' IS NULL THEN NULL ELSE ceil(((q->>'rental_centavos')::numeric+CASE WHEN basis='rental_and_bond' THEN coalesce((q->>'bond_centavos')::numeric,0) ELSE 0 END)*0.2) END;
 IF minimum IS NULL OR p_amount IS NULL OR p_amount<minimum OR p_amount>(q->>'total_centavos')::numeric THEN RAISE EXCEPTION 'Office must confirm the fee, or the amount must be at least 20%% of the confirmed booking fee.' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='bfe-booking-proofs' AND name=p_path) THEN RAISE EXCEPTION 'Finish the proof upload first.' USING ERRCODE='22023'; END IF;
 IF c.proof_path=p_path AND c.offered_centavos=p_amount THEN RETURN; END IF;
 UPDATE public.bfe_booking_checkout SET proof_path=p_path,offered_centavos=p_amount WHERE booking_id=p_id;
 UPDATE public.bfe_bookings SET version=version+1 WHERE id=p_id;
 INSERT INTO public.bfe_booking_audit(booking_id,actor_id,action,note) VALUES(p_id,auth.uid(),'Payment proof submitted','Office must match the proof and issue a receipt; not a verified payment');
END;$$;
CREATE FUNCTION public.bfe_approve_excel_booking(p_id uuid,p_version integer,p_rental bigint,p_bond bigint,p_paid bigint,p_receipt text,p_note text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.bfe_bookings;c public.bfe_booking_checkout;charge uuid;payment uuid:=gen_random_uuid();payload jsonb;basis text;minimum numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.bfe_can('calendar','view','association') AND public.bfe_can('calendar','approve','association') AND public.bfe_can('finance','approve','association'),false) THEN RAISE EXCEPTION 'Office booking approval and Finance payment approval permissions are required.' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('accounting-posting',0));
 SELECT * INTO b FROM public.bfe_bookings WHERE id=p_id FOR UPDATE;
 SELECT * INTO c FROM public.bfe_booking_checkout WHERE booking_id=p_id FOR UPDATE;
 IF b.id IS NULL OR c.booking_id IS NULL THEN RAISE EXCEPTION 'Booking unavailable.' USING ERRCODE='22023'; END IF;
 IF c.payment_entry_id IS NOT NULL THEN
  IF c.verified_centavos=p_paid AND c.receipt_number=upper(btrim(p_receipt)) AND EXISTS(SELECT 1 FROM public.bfe_amenity_charges a WHERE a.booking_id=b.id AND a.rental_centavos=p_rental AND a.bond_centavos=p_bond) THEN RETURN c.payment_entry_id; END IF;
  RAISE EXCEPTION 'A payment is already recorded. Reopen the booking.' USING ERRCODE='40001'; END IF;
 IF p_version IS NULL OR b.version<>p_version OR b.status<>'Pending' THEN RAISE EXCEPTION 'Booking changed. Reopen it.' USING ERRCODE='40001'; END IF;
 IF c.hold_until<=now() THEN RAISE EXCEPTION 'The three-day pencil booking ended. Ask the resident to submit a new booking.' USING ERRCODE='22023'; END IF;
 basis:='rental_and_bond'; -- Includes every amount in the displayed total.
 IF p_rental IS NULL OR p_bond IS NULL OR p_rental<0 OR p_bond<0 OR p_rental+p_bond NOT BETWEEN 1 AND 100000000000 OR p_receipt IS NULL OR length(btrim(p_receipt)) NOT BETWEEN 1 AND 100 OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Enter the full fee, bond, receipt number and verification note.' USING ERRCODE='22023'; END IF;
 minimum:=ceil((p_rental+CASE WHEN basis='rental_and_bond' THEN p_bond ELSE 0 END)::numeric*0.2);
 IF p_paid IS NULL OR p_paid<minimum OR p_paid>p_rental+p_bond THEN RAISE EXCEPTION 'Verified payment must cover at least 20%% and cannot exceed the full amount due.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('receipt:'||lower(btrim(p_receipt)),0));
 IF EXISTS(SELECT 1 FROM public.bfe_accounting_entries e WHERE e.kind IN ('payment','amenity-payment') AND e.status='Posted' AND lower(btrim(e.fields->>'reference'))=lower(btrim(p_receipt))) OR EXISTS(SELECT 1 FROM public.bfe_receipts WHERE lower(btrim(or_number))=lower(btrim(p_receipt))) THEN RAISE EXCEPTION 'That receipt is already recorded. Reconcile it before retrying.' USING ERRCODE='22023'; END IF;
 charge:=public.bfe_approve_booking_with_fee_before_excel(p_id,p_version,p_rental,0,p_bond,p_note);
 payload:=jsonb_build_object('charge',charge::text,'amount',round(p_paid::numeric/100,2)::text,'date',(now() AT TIME ZONE 'Asia/Manila')::date::text,'reference',upper(btrim(p_receipt)),'memo',btrim(p_note));
 PERFORM public.bfe_validate_accounting_fields('amenity-payment',payload);
 INSERT INTO public.bfe_accounting_entries(id,kind,fields,status,creator_id,reviewer_id,review_note) VALUES(payment,'amenity-payment',payload,'Posted',auth.uid(),auth.uid(),'Verified booking payment and official receipt');
 INSERT INTO public.bfe_amenity_payments(entry_id,charge_id,amount_centavos) VALUES(payment,charge,p_paid);
 INSERT INTO public.bfe_accounting_audit(entry_id,actor_id,action,reference,after_values) VALUES(payment,auth.uid(),'Booking payment verified',upper(btrim(p_receipt)),payload);
 UPDATE public.bfe_booking_checkout SET verified_centavos=p_paid,receipt_number=upper(btrim(p_receipt)),verified_by=auth.uid(),verified_at=now(),payment_entry_id=payment WHERE booking_id=p_id;
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(b.owner_id,'community','Booking confirmed','Your payment was verified. Open the booking for your reference and receipt number.','/services/bookings','booking-payment:'||p_id::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
 RETURN payment;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_submit_booking_proof(uuid,text,bigint),public.bfe_approve_excel_booking(uuid,integer,bigint,bigint,bigint,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_submit_booking_proof(uuid,text,bigint),public.bfe_approve_excel_booking(uuid,integer,bigint,bigint,bigint,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
