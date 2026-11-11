-- Apply after 068. Office-confirmed booking charges use the existing Finance
-- draft -> submit -> independent post/reverse lifecycle. No charges are seeded.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
INSERT INTO public.bfe_accounting_form_definitions(kind,fields) VALUES
('amenity-charge','[{"key":"booking","label":"Booking reference","required":true},{"key":"rental","label":"Rental due (PHP)","type":"number","required":true},{"key":"reservation","label":"Additional reservation fee due (PHP)","type":"number","required":true},{"key":"bond","label":"Refundable bond due (PHP)","type":"number","required":true},{"key":"memo","label":"Office quote / rate and fee explanation","type":"textarea","required":true}]'),
('amenity-payment','[{"key":"charge","label":"Posted amenity charge reference","required":true},{"key":"amount","label":"Amount paid (PHP)","type":"number","required":true},{"key":"date","label":"Date paid","type":"date","required":true},{"key":"reference","label":"Official receipt / payment reference","required":true},{"key":"memo","label":"Payment verification notes","type":"textarea","required":true}]');

CREATE TABLE public.bfe_amenity_charges (
 entry_id uuid PRIMARY KEY REFERENCES public.bfe_accounting_entries(id),
 booking_id uuid NOT NULL REFERENCES public.bfe_bookings(id),
 rental_centavos bigint NOT NULL CHECK(rental_centavos>=0),
 reservation_centavos bigint NOT NULL CHECK(reservation_centavos>=0),
 bond_centavos bigint NOT NULL CHECK(bond_centavos>=0),
 amount_centavos bigint GENERATED ALWAYS AS (rental_centavos+reservation_centavos+bond_centavos) STORED,
 CHECK(rental_centavos+reservation_centavos+bond_centavos BETWEEN 0 AND 3000000000000)
);
CREATE INDEX bfe_amenity_charge_booking ON public.bfe_amenity_charges(booking_id);
CREATE TABLE public.bfe_amenity_payments (
 entry_id uuid PRIMARY KEY REFERENCES public.bfe_accounting_entries(id),
 charge_id uuid NOT NULL REFERENCES public.bfe_amenity_charges(entry_id),
 amount_centavos bigint NOT NULL CHECK(amount_centavos>0)
);
CREATE INDEX bfe_amenity_payment_charge ON public.bfe_amenity_payments(charge_id);
ALTER TABLE public.bfe_amenity_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_amenity_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_amenity_charges,public.bfe_amenity_payments FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_amenity_paid(p_charge uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(sum(p.amount_centavos),0) FROM public.bfe_amenity_payments p
 JOIN public.bfe_accounting_entries e ON e.id=p.entry_id AND e.status='Posted' WHERE p.charge_id=p_charge;
$$;
REVOKE ALL ON FUNCTION public.bfe_amenity_paid(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_amenity_accounting_effect() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE booking public.bfe_bookings; charge public.bfe_amenity_charges; amount bigint;
BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 IF NEW.kind NOT IN ('amenity-charge','amenity-payment','payment') THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('accounting-posting',0));
 IF NEW.status='Posted' AND NEW.kind IN ('payment','amenity-payment') AND EXISTS(
  SELECT 1 FROM public.bfe_accounting_entries e WHERE e.id<>NEW.id AND e.kind IN ('payment','amenity-payment') AND e.status='Posted'
  AND lower(btrim(e.fields->>'reference'))=lower(btrim(NEW.fields->>'reference'))
 ) THEN RAISE EXCEPTION 'A posted payment already uses this receipt reference.' USING ERRCODE='22023'; END IF;
 IF NEW.kind='payment' THEN RETURN NEW; END IF;
 IF NEW.status='Posted' THEN
  -- The existing decision RPC owns actor separation, permissions, version and audit.
  IF OLD.status<>'Submitted' OR NEW.creator_id=auth.uid() OR NEW.reviewer_id IS DISTINCT FROM auth.uid()
  OR NOT coalesce(public.bfe_can('finance','approve','association'),false) THEN
   RAISE EXCEPTION 'Independent Finance posting is required.' USING ERRCODE='42501';
  END IF;
  IF NEW.kind='amenity-charge' THEN
   SELECT * INTO booking FROM public.bfe_bookings WHERE id=(NEW.fields->>'booking')::uuid FOR SHARE;
   IF booking.id IS NULL OR booking.status<>'Approved' THEN RAISE EXCEPTION 'Approve the booking before posting its confirmed fee.' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM public.bfe_amenity_charges c JOIN public.bfe_accounting_entries e ON e.id=c.entry_id AND e.status='Posted' WHERE c.booking_id=booking.id) THEN
    RAISE EXCEPTION 'This booking already has a posted charge. Review or reverse it before correcting.' USING ERRCODE='22023';
   END IF;
   INSERT INTO public.bfe_amenity_charges(entry_id,booking_id,rental_centavos,reservation_centavos,bond_centavos)
   VALUES(NEW.id,booking.id,round((NEW.fields->>'rental')::numeric*100)::bigint,round((NEW.fields->>'reservation')::numeric*100)::bigint,round((NEW.fields->>'bond')::numeric*100)::bigint);
  ELSE
   SELECT c.* INTO charge FROM public.bfe_amenity_charges c JOIN public.bfe_accounting_entries e ON e.id=c.entry_id AND e.status='Posted' WHERE c.entry_id=(NEW.fields->>'charge')::uuid FOR SHARE OF c;
   amount:=round((NEW.fields->>'amount')::numeric*100)::bigint;
   IF charge.entry_id IS NULL OR amount IS NULL OR amount<=0 OR public.bfe_amenity_paid(charge.entry_id)+amount>charge.amount_centavos THEN
    RAISE EXCEPTION 'Payment exceeds the posted amenity charge or its remaining amount.' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM public.bfe_receipts WHERE lower(btrim(or_number))=lower(btrim(NEW.fields->>'reference'))) THEN
    RAISE EXCEPTION 'This reference belongs to an imported receipt. Reconcile it before recording another payment.' USING ERRCODE='22023'; END IF;
   INSERT INTO public.bfe_amenity_payments(entry_id,charge_id,amount_centavos) VALUES(NEW.id,charge.entry_id,amount);
  END IF;
 ELSIF NEW.status='Reversed' AND NEW.kind='amenity-charge' AND public.bfe_amenity_paid(NEW.id)>0 THEN
  RAISE EXCEPTION 'Reverse applied amenity payments before reversing the charge.' USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_amenity_accounting_effect() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bfe_amenity_accounting_effect AFTER UPDATE OF status ON public.bfe_accounting_entries
 FOR EACH ROW EXECUTE FUNCTION public.bfe_amenity_accounting_effect();

CREATE FUNCTION public.bfe_amenity_charge_json(p_charge uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('id',c.entry_id,'booking_id',c.booking_id,'facility_name',f.name,'starts_at',b.starts_at,
 'rental_centavos',c.rental_centavos::text,'reservation_centavos',c.reservation_centavos::text,'bond_centavos',c.bond_centavos::text,
 'amount_centavos',c.amount_centavos::text,'paid_centavos',public.bfe_amenity_paid(c.entry_id)::text,
 'balance_centavos',(c.amount_centavos-public.bfe_amenity_paid(c.entry_id))::text)
 FROM public.bfe_amenity_charges c JOIN public.bfe_accounting_entries e ON e.id=c.entry_id AND e.status='Posted'
 JOIN public.bfe_bookings b ON b.id=c.booking_id JOIN public.bfe_facilities f ON f.id=b.facility_id WHERE c.entry_id=p_charge;
$$;
REVOKE ALL ON FUNCTION public.bfe_amenity_charge_json(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_my_account_balance(p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE hoa jsonb; other numeric; n bigint; rows jsonb;
BEGIN
 -- Reuse the existing caller/active membership/Finance and linked-lot checks.
 hoa:=public.bfe_my_hoa_balance(0);
 IF p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Check charge page.' USING ERRCODE='22023'; END IF;
 WITH visible AS MATERIALIZED (
  SELECT c.*,b.starts_at FROM public.bfe_amenity_charges c JOIN public.bfe_accounting_entries e ON e.id=c.entry_id AND e.status='Posted'
  JOIN public.bfe_bookings b ON b.id=c.booking_id AND b.owner_id=auth.uid()
 ), page AS (SELECT * FROM visible ORDER BY starts_at DESC,entry_id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT coalesce(sum(amount_centavos-public.bfe_amenity_paid(entry_id)),0) FROM visible),
 (SELECT count(*) FROM visible),(SELECT coalesce(jsonb_agg(public.bfe_amenity_charge_json(entry_id) ORDER BY starts_at DESC,entry_id),'[]') FROM page)
 INTO other,n,rows;
 RETURN jsonb_build_object('hoa',hoa,'scope','posted_hoa_and_amenities','other_balance_centavos',other::text,
 'total_balance_centavos',((hoa->>'hoa_balance_centavos')::numeric+other)::text,'amenity_charge_count',n,'rows',rows);
END;$$;

CREATE FUNCTION public.bfe_booking_charge(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE booking public.bfe_bookings; charge_id uuid;
BEGIN
 SELECT * INTO booking FROM public.bfe_bookings WHERE id=p_id;
 IF auth.uid() IS NULL OR coalesce(cardinality(public.bfe_current_roles()),0)=0 OR booking.id IS NULL OR NOT coalesce(
  (booking.owner_id=auth.uid() AND public.bfe_can('calendar','view','own') AND public.bfe_can('finance','view','own')) OR
  (public.bfe_can('calendar','view','association') AND public.bfe_can('finance','view','association')),false) THEN
  RAISE EXCEPTION 'Booking fee access required.' USING ERRCODE='42501'; END IF;
 SELECT c.entry_id INTO charge_id FROM public.bfe_amenity_charges c JOIN public.bfe_accounting_entries e ON e.id=c.entry_id AND e.status='Posted' WHERE c.booking_id=p_id;
 RETURN jsonb_build_object('charge',public.bfe_amenity_charge_json(charge_id),
 'can_create',booking.status='Approved' AND charge_id IS NULL AND public.bfe_can('finance','view','association') AND public.bfe_can('finance','create','association'));
END;$$;
REVOKE ALL ON FUNCTION public.bfe_my_account_balance(integer),public.bfe_booking_charge(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_my_account_balance(integer),public.bfe_booking_charge(uuid) TO authenticated;

DO $preview$
DECLARE body text; definition text; marker text:='''bfe_my_hoa_balance''';
BEGIN
 SELECT prosrc,pg_get_functiondef(oid) INTO body,definition FROM pg_proc WHERE oid=to_regprocedure('public.bfe_account_preview_read(uuid,text,jsonb)') AND prosecdef;
 IF body IS NULL OR position('p_name NOT IN' IN body)=0 OR position('s.target_id::text' IN body)=0 OR position('bfe_member_inspection_audit' IN body)=0 OR position(body IN definition)=0
 OR (SELECT count(*) FROM regexp_matches(body,marker,'g'))<>1 THEN RAISE EXCEPTION 'Review the authorized account-preview dispatcher before adding account charge reads.'; END IF;
 EXECUTE replace(definition,body,replace(body,marker,marker||',''bfe_my_account_balance'',''bfe_booking_charge'''));
END;$preview$;
NOTIFY pgrst,'reload schema'; COMMIT;
