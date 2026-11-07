-- Apply once after 008. New visitor passes, no legacy test record import.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_visitor_passes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL REFERENCES auth.users(id),client_id uuid NOT NULL,
 visitor text NOT NULL CHECK(char_length(btrim(visitor)) BETWEEN 2 AND 120), purpose text NOT NULL CHECK(char_length(btrim(purpose)) BETWEEN 5 AND 500),
 plate text NOT NULL DEFAULT '' CHECK(char_length(plate)<=30), lot_id uuid NOT NULL REFERENCES public.bfe_lots(id),
 valid_from timestamptz NOT NULL, valid_until timestamptz NOT NULL CHECK(valid_until>valid_from AND valid_until<=valid_from+interval '24 hours'),
 status text NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected','Cancelled','Entered','Exited')),
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(owner_id,client_id)
);
CREATE INDEX bfe_visitor_gate_queue ON public.bfe_visitor_passes(status,valid_from,valid_until);
CREATE TABLE public.bfe_visitor_audit (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,pass_id uuid NOT NULL REFERENCES public.bfe_visitor_passes(id),actor_id uuid NOT NULL,action text NOT NULL,note text NOT NULL,at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.bfe_visitor_passes ENABLE ROW LEVEL SECURITY;ALTER TABLE public.bfe_visitor_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_visitor_passes,public.bfe_visitor_audit FROM PUBLIC,anon,authenticated;REVOKE ALL ON SEQUENCE public.bfe_visitor_audit_id_seq FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_create_visitor_pass(p_client uuid,p_lot uuid,p_visitor text,p_purpose text,p_plate text,p_from timestamptz,p_until timestamptz) RETURNS uuid
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
 IF p_from<now()-interval '5 minutes' OR p_from>now()+interval '90 days' OR p_until<=now() OR p_until<=p_from OR p_until>p_from+interval '24 hours' THEN RAISE EXCEPTION 'Choose a future visit lasting up to 24 hours, within 90 days.' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM public.bfe_visitor_passes WHERE owner_id=auth.uid() AND created_at>now()-interval '1 minute')>=5 THEN RAISE EXCEPTION 'Please wait before submitting another pass.'; END IF;
 INSERT INTO public.bfe_visitor_passes(owner_id,client_id,lot_id,visitor,purpose,plate,valid_from,valid_until) VALUES(auth.uid(),p_client,p_lot,btrim(p_visitor),btrim(p_purpose),upper(btrim(p_plate)),p_from,p_until) RETURNING * INTO r;
 INSERT INTO public.bfe_visitor_audit(pass_id,actor_id,action,note) VALUES(r.id,auth.uid(),'Pending','Submitted for authorized review; entry not yet authorized');RETURN r.id;
END;$$;

CREATE FUNCTION public.bfe_update_visitor_pass(p_id uuid,p_version integer,p_status text,p_note text) RETURNS void
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
   IF NOT ('security'=ANY(public.bfe_current_roles())) OR NOT public.bfe_can('security','status','association') OR NOT ((r.status='Approved' AND p_status='Entered' AND r.valid_from<=now() AND r.valid_until>now()) OR (r.status='Entered' AND p_status='Exited')) THEN RAISE EXCEPTION 'On-post security permission and valid pass required.' USING ERRCODE='42501'; END IF;
   IF p_status='Entered' AND (cardinality(public.bfe_roles_for(r.owner_id))=0 OR NOT EXISTS(SELECT 1 FROM public.bfe_lot_memberships m JOIN public.bfe_lots l ON l.id=m.lot_id JOIN public.bfe_import_batches b ON b.id=l.batch_id WHERE m.lot_id=r.lot_id AND m.user_id=r.owner_id AND m.state='approved' AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now()) AND b.status='active')) THEN RAISE EXCEPTION 'Resident access was withdrawn. Refer to the office.' USING ERRCODE='42501'; END IF;
  ELSE RAISE EXCEPTION 'Pass action not permitted.' USING ERRCODE='22023'; END IF;
 END IF;
 IF p_version IS NULL OR r.version<>p_version THEN RAISE EXCEPTION 'Pass changed. Refresh before retrying.' USING ERRCODE='40001'; END IF;
 IF p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Provide a decision or gate note.' USING ERRCODE='22023'; END IF;
 UPDATE public.bfe_visitor_passes SET status=p_status,version=version+1 WHERE id=p_id;
 INSERT INTO public.bfe_visitor_audit(pass_id,actor_id,action,note) VALUES(p_id,auth.uid(),p_status,btrim(p_note));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(r.owner_id,'access','Visitor pass: '||p_status,'Open visitor passes to check the update.','/more/notifications','visitor:'||r.id::text||':'||(r.version+1)::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
END;$$;

CREATE FUNCTION public.bfe_visitor_dashboard(p_office boolean DEFAULT false,p_page integer DEFAULT 0,p_search text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb;n bigint;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT public.bfe_can('security','view',CASE WHEN p_office THEN 'association' ELSE 'own' END) THEN RAISE EXCEPTION 'Visitor pass access required.' USING ERRCODE='42501'; END IF;
 IF p_office IS NULL OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 OR p_search IS NULL OR length(p_search)>100 THEN RAISE EXCEPTION 'Invalid pass filters.' USING ERRCODE='22023'; END IF;
 WITH visible AS (
  SELECT r.*,l.physical_id,CASE WHEN status IN ('Pending','Approved') AND valid_until<=now() THEN 'Expired' ELSE status END AS effective_status
  FROM public.bfe_visitor_passes r JOIN public.bfe_lots l ON l.id=r.lot_id
  WHERE (NOT p_office AND r.owner_id=auth.uid() OR p_office AND (r.status='Entered' OR r.valid_until>now())) AND position(lower(p_search) IN lower(r.visitor||' '||r.plate||' '||l.physical_id))>0
 ), page AS(SELECT * FROM visible ORDER BY created_at DESC,id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(to_jsonb(page) ORDER BY created_at DESC,id),'[]') INTO n,rows FROM page;
 RETURN jsonb_build_object('rows',rows,'total',n,'can_create',public.bfe_can('security','create','own') AND public.bfe_current_roles() && ARRAY['homeowner','renter']::text[],
 'can_approve',p_office AND public.bfe_can('security','approve','association'),'can_gate',p_office AND 'security'=ANY(public.bfe_current_roles()) AND public.bfe_can('security','status','association'),
 'lots',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'physical_id',l.physical_id)) FROM public.bfe_lot_memberships m JOIN public.bfe_lots l ON l.id=m.lot_id JOIN public.bfe_import_batches b ON b.id=l.batch_id WHERE m.user_id=auth.uid() AND m.state='approved' AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now()) AND b.status='active'),'[]'));
END;$$;
REVOKE ALL ON FUNCTION public.bfe_create_visitor_pass(uuid,uuid,text,text,text,timestamptz,timestamptz),public.bfe_update_visitor_pass(uuid,integer,text,text),public.bfe_visitor_dashboard(boolean,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_create_visitor_pass(uuid,uuid,text,text,text,timestamptz,timestamptz),public.bfe_update_visitor_pass(uuid,integer,text,text),public.bfe_visitor_dashboard(boolean,integer,text) TO authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
