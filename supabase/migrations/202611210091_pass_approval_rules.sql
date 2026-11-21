-- Owner-run after 090. Owner request, 21 November 2026:
--  * Visitor passes and small delivery passes need no admin approval: they are
--    approved automatically when the resident submits them (audited).
--  * Gate passes still need approval by someone with security approve
--    permission (admin/office). Security staff who cannot approve no longer see
--    pending passes, so a gate pass appears for security only once approved.
-- Both functions are copied unchanged from 027 and 009 apart from those rules.
-- Grants are kept (CREATE OR REPLACE). Existing pending passes are not changed.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';

CREATE OR REPLACE FUNCTION public.bfe_create_community_pass(p_client uuid,p_lot uuid,p_visitor text,p_purpose text,p_plate text,p_from timestamptz,p_until timestamptz,p_kind text,p_arrival text,p_direction text,p_count integer,p_items text)
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
  -- Owner rule: visitor and small delivery passes need no office approval; gate passes stay Pending.
  IF p_kind IN ('visitor','small_delivery') THEN
   UPDATE public.bfe_visitor_passes SET status='Approved',version=version+1 WHERE id=rid AND status='Pending';
   IF FOUND THEN
    INSERT INTO public.bfe_visitor_audit(pass_id,actor_id,action,note) VALUES(rid,auth.uid(),'Approved','Approved automatically: visitor and small delivery passes do not need office approval.');
   END IF;
  END IF;
 END IF;
 RETURN rid;
END;$$;


CREATE OR REPLACE FUNCTION public.bfe_visitor_dashboard(p_office boolean DEFAULT false,p_page integer DEFAULT 0,p_search text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb;n bigint;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT public.bfe_can('security','view',CASE WHEN p_office THEN 'association' ELSE 'own' END) THEN RAISE EXCEPTION 'Visitor pass access required.' USING ERRCODE='42501'; END IF;
 IF p_office IS NULL OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 OR p_search IS NULL OR length(p_search)>100 THEN RAISE EXCEPTION 'Invalid pass filters.' USING ERRCODE='22023'; END IF;
 WITH visible AS (
  SELECT r.*,l.physical_id,CASE WHEN status IN ('Pending','Approved') AND valid_until<=now() THEN 'Expired' ELSE status END AS effective_status
  FROM public.bfe_visitor_passes r JOIN public.bfe_lots l ON l.id=r.lot_id
  WHERE (NOT p_office AND r.owner_id=auth.uid() OR p_office AND (r.status='Entered' OR r.valid_until>now()) AND (r.status<>'Pending' OR public.bfe_can('security','approve','association'))) AND position(lower(p_search) IN lower(r.visitor||' '||r.plate||' '||l.physical_id))>0
 ), page AS(SELECT * FROM visible ORDER BY created_at DESC,id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(to_jsonb(page) ORDER BY created_at DESC,id),'[]') INTO n,rows FROM page;
 RETURN jsonb_build_object('rows',rows,'total',n,'can_create',public.bfe_can('security','create','own') AND public.bfe_current_roles() && ARRAY['homeowner','renter']::text[],
 'can_approve',p_office AND public.bfe_can('security','approve','association'),'can_gate',p_office AND 'security'=ANY(public.bfe_current_roles()) AND public.bfe_can('security','status','association'),
 'lots',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'physical_id',l.physical_id)) FROM public.bfe_lot_memberships m JOIN public.bfe_lots l ON l.id=m.lot_id JOIN public.bfe_import_batches b ON b.id=l.batch_id WHERE m.user_id=auth.uid() AND m.state='approved' AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now()) AND b.status='active'),'[]'));
END;$$;

NOTIFY pgrst,'reload schema';
COMMIT;
