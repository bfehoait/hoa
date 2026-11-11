-- Extends the dedicated visitor-pass and amenity services. No new pass store.
-- No facilities, rates, member grants or synthetic records are inserted.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
ALTER TABLE public.bfe_visitor_passes
 ADD COLUMN pass_kind text NOT NULL DEFAULT 'visitor' CHECK(pass_kind IN ('visitor','gate','small_delivery')),
 ADD COLUMN arrival_mode text NOT NULL DEFAULT 'commute' CHECK(arrival_mode IN ('commute','vehicle')),
 ADD COLUMN direction text NOT NULL DEFAULT 'inbound' CHECK(direction IN ('inbound','outbound')),
 ADD COLUMN party_count integer NOT NULL DEFAULT 1 CHECK(party_count BETWEEN 1 AND 100),
 ADD COLUMN items text NOT NULL DEFAULT '' CHECK(char_length(items)<=2000);
UPDATE public.bfe_visitor_passes SET arrival_mode='vehicle' WHERE btrim(plate)<>'';

CREATE FUNCTION public.bfe_create_community_pass(p_client uuid,p_lot uuid,p_visitor text,p_purpose text,p_plate text,p_from timestamptz,p_until timestamptz,p_kind text,p_arrival text,p_direction text,p_count integer,p_items text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_visitor_passes; rid uuid; existed boolean;
BEGIN
 IF p_kind IS NULL OR p_kind NOT IN ('visitor','gate','small_delivery')
 OR p_arrival IS NULL OR p_arrival NOT IN ('commute','vehicle')
 OR p_direction IS NULL OR p_direction NOT IN ('inbound','outbound')
 OR (p_kind<>'gate' AND p_direction<>'inbound')
 OR p_count IS NULL OR p_count NOT BETWEEN 1 AND 100
 OR p_items IS NULL OR char_length(btrim(p_items))>2000
 OR (p_kind='gate' AND char_length(btrim(p_items))<3)
 OR (p_arrival='vehicle' AND char_length(btrim(coalesce(p_plate,'')))<2)
 OR (p_arrival='commute' AND btrim(coalesce(p_plate,''))<>'') THEN
  RAISE EXCEPTION 'Check pass type, arrival, plate, people and items.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('visitor:'||auth.uid()::text,0));
 SELECT * INTO r FROM public.bfe_visitor_passes WHERE owner_id=auth.uid() AND client_id=p_client;
 existed:=FOUND;
 -- Reuse 009's identity, membership, rate, time and request validation.
 rid:=public.bfe_create_visitor_pass(p_client,p_lot,p_visitor,p_purpose,p_plate,p_from,p_until);
 IF existed THEN
  IF r.pass_kind<>p_kind OR r.arrival_mode<>p_arrival OR r.direction<>p_direction OR r.party_count<>p_count OR r.items<>btrim(p_items) THEN
   RAISE EXCEPTION 'Submission reference already used.' USING ERRCODE='22023'; END IF;
 ELSE
  UPDATE public.bfe_visitor_passes SET pass_kind=p_kind,arrival_mode=p_arrival,direction=p_direction,party_count=p_count,items=btrim(p_items) WHERE id=rid;
 END IF;
 RETURN rid;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_create_community_pass(uuid,uuid,text,text,text,timestamptz,timestamptz,text,text,text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_create_community_pass(uuid,uuid,text,text,text,timestamptz,timestamptz,text,text,text,integer,text) TO authenticated;

CREATE FUNCTION public.bfe_community_pass_dashboard(p_office boolean DEFAULT false,p_page integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 result:=public.bfe_visitor_dashboard(p_office,p_page,'');
 RETURN jsonb_set(result,'{lots}',coalesce((SELECT jsonb_agg(x.value||jsonb_build_object('homeowner',coalesce(l.corrected_homeowner,l.recorded_homeowner),'phase',l.phase,'block',l.block,'lot',l.lot))
 FROM jsonb_array_elements(result->'lots') x JOIN public.bfe_lots l ON l.id=(x.value->>'id')::uuid),'[]'::jsonb));
END;$$;
REVOKE ALL ON FUNCTION public.bfe_community_pass_dashboard(boolean,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_community_pass_dashboard(boolean,integer) TO authenticated;

-- All three pass types use the existing gate lifecycle, notes and audit.
-- Retain old generic records for staff inspection; stop new resident duplicates.
UPDATE public.bfe_feature_definitions SET resident_create=false WHERE code IN ('gate-passes','walk-ins');

CREATE FUNCTION public.bfe_amenity_hours_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s timestamp:=NEW.starts_at AT TIME ZONE 'Asia/Manila'; e timestamp:=NEW.ends_at AT TIME ZONE 'Asia/Manila';
BEGIN
 IF s::date<>e::date OR s::time<time '07:00' OR e::time>time '22:00' THEN
  RAISE EXCEPTION 'Choose an amenity time between 7 AM and 10 PM.' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_amenity_hours_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bfe_amenity_hours_guard BEFORE INSERT OR UPDATE OF starts_at,ends_at ON public.bfe_bookings FOR EACH ROW EXECUTE FUNCTION public.bfe_amenity_hours_guard();
-- Preserve 009 approval, version, expiry and lot checks; outbound gate passes
-- can be released directly from Approved without a fictitious entry event.
CREATE OR REPLACE FUNCTION public.bfe_update_visitor_pass(p_id uuid,p_version integer,p_status text,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_visitor_passes;
BEGIN
 SELECT * INTO r FROM public.bfe_visitor_passes WHERE id=p_id FOR UPDATE;
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR r.id IS NULL THEN RAISE EXCEPTION 'Pass unavailable.' USING ERRCODE='42501'; END IF;
 IF p_status='Cancelled' AND r.owner_id=auth.uid() AND public.bfe_can('security','view','own') THEN
  IF r.status NOT IN ('Pending','Approved') THEN RAISE EXCEPTION 'Pass cannot be cancelled.'; END IF;
 ELSE
  IF NOT public.bfe_can('security','view','association') THEN RAISE EXCEPTION 'Security access required.' USING ERRCODE='42501'; END IF;
  IF p_status IN ('Approved','Rejected') THEN
   IF r.status<>'Pending' OR r.valid_until<=now() OR NOT public.bfe_can('security','approve','association') THEN RAISE EXCEPTION 'Pass approval permission and current pending pass required.' USING ERRCODE='42501'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.bfe_lot_memberships m JOIN public.bfe_lots l ON l.id=m.lot_id JOIN public.bfe_import_batches b ON b.id=l.batch_id WHERE m.lot_id=r.lot_id AND m.user_id=r.owner_id AND m.state='approved' AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now()) AND b.status='active') OR cardinality(public.bfe_roles_for(r.owner_id))=0 THEN RAISE EXCEPTION 'Resident membership is no longer valid.' USING ERRCODE='42501'; END IF;
  ELSIF p_status IN ('Entered','Exited') THEN
   IF NOT ('security'=ANY(public.bfe_current_roles())) OR NOT public.bfe_can('security','status','association') OR NOT ((r.status='Approved' AND ((p_status='Entered' AND r.direction='inbound') OR (p_status='Exited' AND r.direction='outbound')) AND r.valid_from<=now() AND r.valid_until>now()) OR (r.status='Entered' AND p_status='Exited')) THEN RAISE EXCEPTION 'On-post security permission and valid pass required.' USING ERRCODE='42501'; END IF;
   IF (p_status='Entered' OR (p_status='Exited' AND r.status='Approved')) AND (cardinality(public.bfe_roles_for(r.owner_id))=0 OR NOT EXISTS(SELECT 1 FROM public.bfe_lot_memberships m JOIN public.bfe_lots l ON l.id=m.lot_id JOIN public.bfe_import_batches b ON b.id=l.batch_id WHERE m.lot_id=r.lot_id AND m.user_id=r.owner_id AND m.state='approved' AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now()) AND b.status='active')) THEN RAISE EXCEPTION 'Resident access was withdrawn. Refer to the office.' USING ERRCODE='42501'; END IF;
  ELSE RAISE EXCEPTION 'Pass action not permitted.' USING ERRCODE='22023'; END IF;
 END IF;
 IF p_version IS NULL OR r.version<>p_version THEN RAISE EXCEPTION 'Pass changed. Refresh before retrying.' USING ERRCODE='40001'; END IF;
 IF p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Provide a decision or gate note.' USING ERRCODE='22023'; END IF;
 UPDATE public.bfe_visitor_passes SET status=p_status,version=version+1 WHERE id=p_id;
 INSERT INTO public.bfe_visitor_audit(pass_id,actor_id,action,note) VALUES(p_id,auth.uid(),p_status,btrim(p_note));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(r.owner_id,'access','Visitor pass: '||p_status,'Open visitor passes to check the update.','/more/notifications','visitor:'||r.id::text||':'||(r.version+1)::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
END;$$;
NOTIFY pgrst,'reload schema'; COMMIT;
