-- Owner-run after 089. Owner request, 21 November 2026: visitor passes may last
-- more than one day. Residents choose the start and end dates freely; the
-- previous 24-hour maximum is removed from the table rule and from
-- bfe_create_visitor_pass. Other rules are unchanged: the pass must start no
-- earlier than now (5-minute grace) and within 90 days, and must end after it
-- starts and in the future. Identity, membership, rate-limit, gate and approval
-- rules are copied unchanged from 009. Existing passes are not modified.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';

-- Drop the table rule that capped a pass at 24 hours, whatever name it was given.
DO $$
DECLARE c record;
BEGIN
 FOR c IN SELECT conname FROM pg_constraint
  WHERE conrelid='public.bfe_visitor_passes'::regclass AND contype='c'
   AND (pg_get_constraintdef(oid) ILIKE '%24:00:00%' OR pg_get_constraintdef(oid) ILIKE '%24 hours%')
 LOOP
  EXECUTE format('ALTER TABLE public.bfe_visitor_passes DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
ALTER TABLE public.bfe_visitor_passes DROP CONSTRAINT IF EXISTS bfe_visitor_passes_valid_window;
ALTER TABLE public.bfe_visitor_passes ADD CONSTRAINT bfe_visitor_passes_valid_window CHECK(valid_until>valid_from);

CREATE OR REPLACE FUNCTION public.bfe_create_visitor_pass(p_client uuid,p_lot uuid,p_visitor text,p_purpose text,p_plate text,p_from timestamptz,p_until timestamptz) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_visitor_passes;
BEGIN
 IF NOT (public.bfe_current_roles() && ARRAY['homeowner','renter']::text[]) OR NOT public.bfe_can('security','create','own') THEN RAISE EXCEPTION 'Resident visitor-pass permission required.' USING ERRCODE='42501'; END IF;
 IF p_client IS NULL OR p_visitor IS NULL OR p_purpose IS NULL OR p_plate IS NULL OR p_from IS NULL OR p_until IS NULL OR char_length(btrim(p_visitor)) NOT BETWEEN 2 AND 120 OR char_length(btrim(p_purpose)) NOT BETWEEN 5 AND 500 OR char_length(p_plate)>30 THEN RAISE EXCEPTION 'Check visitor details.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('visitor:'||auth.uid()::text,0));
 SELECT * INTO r FROM public.bfe_visitor_passes WHERE owner_id=auth.uid() AND client_id=p_client;
 IF FOUND THEN
  IF r.lot_id IS DISTINCT FROM p_lot OR r.visitor<>btrim(p_visitor) OR r.purpose<>btrim(p_purpose) OR r.plate<>upper(btrim(p_plate)) OR r.valid_from<>p_from OR r.valid_until<>p_until THEN RAISE EXCEPTION 'Submission reference already used.' USING ERRCODE='22023'; END IF;
  RETURN r.id;
 END IF;
 -- Physical lot access comes from the protected approved membership registry, never a typed unit label.
 IF NOT EXISTS(SELECT 1 FROM public.bfe_lot_memberships m JOIN public.bfe_lots l ON l.id=m.lot_id JOIN public.bfe_import_batches b ON b.id=l.batch_id WHERE m.lot_id=p_lot AND m.user_id=auth.uid() AND m.state='approved' AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now()) AND b.status='active') THEN RAISE EXCEPTION 'An approved active lot membership is required.' USING ERRCODE='42501'; END IF;
 IF p_from<now()-interval '5 minutes' OR p_from>now()+interval '90 days' OR p_until<=now() OR p_until<=p_from THEN RAISE EXCEPTION 'Choose a visit that starts within 90 days and ends after it starts.' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM public.bfe_visitor_passes WHERE owner_id=auth.uid() AND created_at>now()-interval '1 minute')>=5 THEN RAISE EXCEPTION 'Please wait before submitting another pass.'; END IF;
 INSERT INTO public.bfe_visitor_passes(owner_id,client_id,lot_id,visitor,purpose,plate,valid_from,valid_until) VALUES(auth.uid(),p_client,p_lot,btrim(p_visitor),btrim(p_purpose),upper(btrim(p_plate)),p_from,p_until) RETURNING * INTO r;
 INSERT INTO public.bfe_visitor_audit(pass_id,actor_id,action,note) VALUES(r.id,auth.uid(),'Pending','Submitted for authorized review; entry not yet authorized');RETURN r.id;
END;$$;

DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.bfe_visitor_passes'::regclass AND contype='c'
    AND (pg_get_constraintdef(oid) ILIKE '%24:00:00%' OR pg_get_constraintdef(oid) ILIKE '%24 hours%'))
  THEN RAISE EXCEPTION 'The 24-hour pass rule is still present.'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
