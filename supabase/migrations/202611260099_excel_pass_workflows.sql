-- HOA.xlsx, pass flows B2-B9. Owner-run AFTER 098. Existing approved passes are preserved.
-- Visitor/small delivery: Security decision. Gate: Office decision then Security decision.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
ALTER TABLE public.bfe_visitor_passes ADD COLUMN office_approved_at timestamptz,
 ADD COLUMN security_approved_at timestamptz, ADD COLUMN walk_in boolean NOT NULL DEFAULT false,
 ADD COLUMN workflow_revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.bfe_visitor_passes ALTER COLUMN workflow_revision SET DEFAULT 2;
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
 END IF;
 UPDATE public.bfe_visitor_passes SET workflow_revision=2 WHERE id=rid AND NOT existed;
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
  WHERE (NOT p_office AND r.owner_id=auth.uid() OR p_office AND (r.status='Entered' OR r.valid_until>now())) AND position(lower(p_search) IN lower(r.visitor||' '||r.plate||' '||l.physical_id))>0
 ), page AS(SELECT * FROM visible ORDER BY created_at DESC,id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(to_jsonb(page) ORDER BY created_at DESC,id),'[]') INTO n,rows FROM page;
 RETURN jsonb_build_object('rows',rows,'total',n,'can_create',(public.bfe_can('security','create','own') AND public.bfe_current_roles() && ARRAY['homeowner','renter']::text[]) OR (p_office AND 'security'=ANY(public.bfe_current_roles()) AND public.bfe_can('security','status','association')),
 'can_approve',p_office AND (public.bfe_can('security','approve','association') OR ('security'=ANY(public.bfe_current_roles()) AND public.bfe_can('security','status','association'))),'can_gate',p_office AND 'security'=ANY(public.bfe_current_roles()) AND public.bfe_can('security','status','association'),
 'lots',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'physical_id',l.physical_id)) FROM public.bfe_lot_memberships m JOIN public.bfe_lots l ON l.id=m.lot_id JOIN public.bfe_import_batches b ON b.id=l.batch_id WHERE m.user_id=auth.uid() AND m.state='approved' AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now()) AND b.status='active'),'[]'));
END;$$;

CREATE FUNCTION public.bfe_security_pass_lots(p_search text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT coalesce('security'=ANY(public.bfe_current_roles()) AND public.bfe_can('security','status','association') AND public.bfe_can('security','view','association'),false) THEN RAISE EXCEPTION 'Security permission required.' USING ERRCODE='42501'; END IF;
 IF p_search IS NULL OR length(btrim(p_search)) NOT BETWEEN 2 AND 40 THEN RETURN '[]'::jsonb; END IF;
 RETURN coalesce((SELECT jsonb_agg(x) FROM (SELECT l.id,l.physical_id FROM public.bfe_lots l JOIN public.bfe_import_batches b ON b.id=l.batch_id AND b.status='active' WHERE position(lower(btrim(p_search)) IN lower(l.physical_id))>0 ORDER BY l.physical_id LIMIT 20) x),'[]'::jsonb);
END;$$;
CREATE FUNCTION public.bfe_create_walk_in_pass(p_client uuid,p_lot uuid,p_visitor text,p_purpose text,p_plate text,p_from timestamptz,p_until timestamptz,p_kind text,p_arrival text,p_count integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_visitor_passes;
BEGIN
 IF NOT coalesce('security'=ANY(public.bfe_current_roles()) AND public.bfe_can('security','status','association') AND public.bfe_can('security','view','association'),false) THEN RAISE EXCEPTION 'Security permission required.' USING ERRCODE='42501'; END IF;
 IF p_client IS NULL OR p_kind IS NULL OR p_kind NOT IN ('visitor','small_delivery') OR p_arrival IS NULL OR p_arrival NOT IN ('commute','vehicle') OR p_count IS NULL OR p_count NOT BETWEEN 1 AND 100 OR p_visitor IS NULL OR length(btrim(p_visitor)) NOT BETWEEN 2 AND 120 OR p_purpose IS NULL OR length(btrim(p_purpose)) NOT BETWEEN 5 AND 500 OR p_plate IS NULL OR length(p_plate)>30 OR (p_arrival='vehicle' AND length(btrim(p_plate))<2) OR (p_arrival='commute' AND btrim(p_plate)<>'') OR p_from IS NULL OR p_until IS NULL OR p_from<now()-interval '5 minutes' OR p_from>now()+interval '90 days' OR p_until<=p_from OR p_until<=now() THEN RAISE EXCEPTION 'Check the visit details and dates.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('visitor:'||auth.uid()::text,0));
 SELECT * INTO r FROM public.bfe_visitor_passes WHERE owner_id=auth.uid() AND client_id=p_client;
 IF FOUND THEN
  IF NOT r.walk_in OR r.lot_id IS DISTINCT FROM p_lot OR r.visitor<>btrim(p_visitor) OR r.purpose<>btrim(p_purpose) OR r.plate<>upper(btrim(p_plate)) OR r.valid_from<>p_from OR r.valid_until<>p_until OR r.pass_kind<>p_kind OR r.arrival_mode<>p_arrival OR r.party_count<>p_count THEN RAISE EXCEPTION 'Submission reference already used.' USING ERRCODE='22023'; END IF;
  RETURN r.id;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bfe_lots l JOIN public.bfe_import_batches b ON b.id=l.batch_id WHERE l.id=p_lot AND b.status='active') THEN RAISE EXCEPTION 'Choose an active property.' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM public.bfe_visitor_passes WHERE owner_id=auth.uid() AND created_at>now()-interval '1 minute')>=5 THEN RAISE EXCEPTION 'Please wait before submitting another pass.'; END IF;
 INSERT INTO public.bfe_visitor_passes(owner_id,client_id,lot_id,visitor,purpose,plate,valid_from,valid_until,pass_kind,arrival_mode,party_count,walk_in)
 VALUES(auth.uid(),p_client,p_lot,btrim(p_visitor),btrim(p_purpose),upper(btrim(p_plate)),p_from,p_until,p_kind,p_arrival,p_count,true) RETURNING * INTO r;
 INSERT INTO public.bfe_visitor_audit(pass_id,actor_id,action,note) VALUES(r.id,auth.uid(),'Pending','Walk-in recorded; Security must check ID and vehicle plate before approval');
 RETURN r.id;
END;$$;
CREATE FUNCTION public.bfe_decide_checked_pass(p_id uuid,p_version integer,p_status text,p_note text,p_id_checked boolean,p_plate_checked boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_visitor_passes; guard boolean; office boolean; stage text;
BEGIN
 SELECT * INTO r FROM public.bfe_visitor_passes WHERE id=p_id FOR UPDATE;
 IF auth.uid() IS NULL OR coalesce(cardinality(public.bfe_current_roles()),0)=0 OR r.id IS NULL THEN RAISE EXCEPTION 'Pass unavailable.' USING ERRCODE='42501'; END IF;
 guard:=coalesce('security'=ANY(public.bfe_current_roles()) AND public.bfe_can('security','view','association') AND public.bfe_can('security','status','association'),false);
 office:=coalesce(public.bfe_can('security','view','association') AND public.bfe_can('security','approve','association'),false);
 IF p_version IS NULL OR r.version<>p_version THEN RAISE EXCEPTION 'Pass changed. Reopen it before retrying.' USING ERRCODE='40001'; END IF;
 IF p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Enter a decision or gate note.' USING ERRCODE='22023'; END IF;
 IF p_status='Cancelled' AND r.owner_id=auth.uid() AND public.bfe_can('security','view','own') AND r.status IN ('Pending','Approved') THEN stage:='Cancelled';
 ELSIF p_status IN ('Approved','Rejected') AND r.status='Pending' AND r.valid_until>now() THEN
  IF r.pass_kind='gate' AND r.office_approved_at IS NULL THEN
   IF NOT office THEN RAISE EXCEPTION 'Office approval is needed first.' USING ERRCODE='42501'; END IF;
   stage:=CASE WHEN p_status='Approved' THEN 'Office approved; awaiting Security' ELSE 'Rejected' END;
  ELSE
   IF NOT guard THEN RAISE EXCEPTION 'Security must review this pass.' USING ERRCODE='42501'; END IF;
   IF p_status='Approved' AND (p_id_checked IS DISTINCT FROM true OR (r.arrival_mode='vehicle' AND p_plate_checked IS DISTINCT FROM true)) THEN RAISE EXCEPTION 'Check the visitor ID and vehicle plate before approving.' USING ERRCODE='22023'; END IF;
   stage:=p_status;
  END IF;
 ELSIF guard AND ((p_status='Entered' AND r.status='Approved' AND r.valid_from<=now() AND r.valid_until>now()) OR (p_status='Exited' AND (r.status='Entered' OR (r.status='Approved' AND r.pass_kind='gate' AND r.direction='outbound' AND r.valid_from<=now() AND r.valid_until>now())))) THEN stage:=p_status;
 ELSE RAISE EXCEPTION 'This pass cannot receive that action.' USING ERRCODE='42501'; END IF;
 IF stage<>'Cancelled' AND NOT r.walk_in AND (coalesce(cardinality(public.bfe_roles_for(r.owner_id)),0)=0 OR NOT EXISTS(SELECT 1 FROM public.bfe_lot_memberships m JOIN public.bfe_lots l ON l.id=m.lot_id JOIN public.bfe_import_batches b ON b.id=l.batch_id WHERE m.user_id=r.owner_id AND m.lot_id=r.lot_id AND m.state='approved' AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now()) AND b.status='active')) THEN RAISE EXCEPTION 'Resident property access is no longer active. Refer to Office.' USING ERRCODE='42501'; END IF;
 UPDATE public.bfe_visitor_passes SET status=CASE WHEN stage='Office approved; awaiting Security' THEN 'Pending' ELSE p_status END,
 office_approved_at=CASE WHEN stage='Office approved; awaiting Security' THEN now() ELSE office_approved_at END,
 security_approved_at=CASE WHEN stage='Approved' THEN now() ELSE security_approved_at END,version=version+1 WHERE id=r.id;
 INSERT INTO public.bfe_visitor_audit(pass_id,actor_id,action,note) VALUES(r.id,auth.uid(),stage,btrim(p_note));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(r.owner_id,'access','Pass: '||stage,'Open your passes to check the update.','/more/notifications','visitor:'||r.id::text||':'||(r.version+1)::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
END;$$;
CREATE OR REPLACE FUNCTION public.bfe_update_visitor_pass(p_id uuid,p_version integer,p_status text,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM public.bfe_decide_checked_pass(p_id,p_version,p_status,p_note,false,false); END;$$;
REVOKE ALL ON FUNCTION public.bfe_security_pass_lots(text),public.bfe_create_walk_in_pass(uuid,uuid,text,text,text,timestamptz,timestamptz,text,text,integer),public.bfe_decide_checked_pass(uuid,integer,text,text,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_security_pass_lots(text),public.bfe_create_walk_in_pass(uuid,uuid,text,text,text,timestamptz,timestamptz,text,text,integer),public.bfe_decide_checked_pass(uuid,integer,text,text,boolean,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.bfe_office_operation_queue(p_kind text,p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; rows jsonb; n bigint;
BEGIN
 IF p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 OR p_kind IS NULL OR p_kind NOT IN ('booking','visitor') THEN RAISE EXCEPTION 'Invalid queue filters.' USING ERRCODE='22023'; END IF;
 IF p_kind='booking' THEN
  result:=public.bfe_booking_dashboard(true,0);
  WITH pending AS MATERIALIZED (
   SELECT r.*,f.name AS facility_name FROM public.bfe_bookings r JOIN public.bfe_facilities f ON f.id=r.facility_id
   WHERE r.status='Pending' AND r.starts_at>now()
  ), page AS (SELECT * FROM pending ORDER BY created_at,id OFFSET p_page*20 LIMIT 20)
  SELECT (SELECT count(*) FROM pending),coalesce(jsonb_agg(to_jsonb(p) ORDER BY created_at,id),'[]'::jsonb) INTO n,rows FROM page p;
 ELSE
  result:=public.bfe_community_pass_dashboard(true,0);
  WITH pending AS MATERIALIZED (
   SELECT r.*,l.physical_id,r.status AS effective_status FROM public.bfe_visitor_passes r JOIN public.bfe_lots l ON l.id=r.lot_id
   WHERE r.status='Pending' AND r.valid_until>now() AND (('security'=ANY(public.bfe_current_roles()) AND public.bfe_can('security','status','association')) OR (r.pass_kind='gate' AND r.office_approved_at IS NULL))
  ), page AS (SELECT * FROM pending ORDER BY created_at,id OFFSET p_page*20 LIMIT 20)
  SELECT (SELECT count(*) FROM pending),coalesce(jsonb_agg(to_jsonb(p) ORDER BY created_at,id),'[]'::jsonb) INTO n,rows FROM page p;
 END IF;
 RETURN result||jsonb_build_object('rows',rows,'total',n);
END;$$;
CREATE OR REPLACE FUNCTION public.bfe_office_review_inbox() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0
 OR NOT (public.bfe_current_roles() && ARRAY['admin','developer']::text[])
 OR NOT public.bfe_can('overview','summary','association') THEN
  RAISE EXCEPTION 'Office overview access required.' USING ERRCODE='42501'; END IF;
 WITH capabilities AS MATERIALIZED (
  SELECT m,public.bfe_can(m,'view','association') AS visible,
   public.bfe_can(m,'approve','association') AS approver,
   public.bfe_can(m,'status','association') AS reviewer,
   public.bfe_can(m,'publish','association') AS publisher,
   public.bfe_can(m,'manage','association') AS manager
  FROM unnest(ARRAY['registrations','property','calendar','security','requests','livelihood','transport','community','documents','finance','operations']) m
 ), queues AS (
  SELECT 'registrations' AS kind,'' AS module,count(*) FILTER(WHERE status='Pending') AS pending,0::bigint AS in_review,c.approver AS can_decide
  FROM public.registrations CROSS JOIN capabilities c WHERE c.m='registrations' AND c.visible GROUP BY c.approver
  UNION ALL
  SELECT 'lots','',count(*) FILTER(WHERE m.state='pending'),0,c.manager
  FROM public.bfe_lot_memberships m JOIN public.bfe_lots l ON l.id=m.lot_id
  JOIN public.bfe_import_batches b ON b.id=l.batch_id AND b.status='active'
  CROSS JOIN capabilities c WHERE c.m='property' AND c.visible GROUP BY c.manager
  UNION ALL
  SELECT 'bookings','',count(*) FILTER(WHERE status='Pending' AND starts_at>now()),0,c.approver
  FROM public.bfe_bookings CROSS JOIN capabilities c WHERE c.m='calendar' AND c.visible GROUP BY c.approver
  UNION ALL
  SELECT 'passes','',count(*) FILTER(WHERE status='Pending' AND valid_until>now() AND (('security'=ANY(public.bfe_current_roles()) AND public.bfe_can('security','status','association')) OR (pass_kind='gate' AND office_approved_at IS NULL))),0,c.approver
  FROM public.bfe_visitor_passes CROSS JOIN capabilities c WHERE c.m='security' AND c.visible GROUP BY c.approver
  UNION ALL
  SELECT 'feature',d.code,count(r.id) FILTER(WHERE r.status='Submitted' OR (r.status='Reviewed' AND r.module IN ('businesses','buy-sell','jobs','garage-sales','booth-events','workshops'))),count(r.id) FILTER(WHERE r.status='In review'),c.reviewer OR (d.publishable AND c.publisher)
  FROM public.bfe_feature_definitions d JOIN capabilities c ON c.m=d.capability AND c.visible
  LEFT JOIN public.bfe_feature_records r ON r.module=d.code AND (r.status IN ('Submitted','In review') OR (r.status='Reviewed' AND r.module IN ('businesses','buy-sell','jobs','garage-sales','booth-events','workshops')))
  -- Staff announcements publish directly; unfinished author uploads are not resident approvals.
  WHERE d.code<>'publishing' GROUP BY d.code,d.publishable,c.reviewer,c.publisher
  UNION ALL
  SELECT 'household','household-changes',count(*),0,c.manager AND public.bfe_can('people','view','association')
  FROM public.bfe_feature_records r JOIN capabilities c ON c.m='property' AND c.visible
  WHERE r.module='household-changes' AND r.status='Reviewed' AND NOT EXISTS(SELECT 1 FROM public.bfe_household_applications a WHERE a.record_id=r.id) GROUP BY c.manager
  UNION ALL
  SELECT 'issuance',r.module,count(*),0,c.reviewer
  FROM public.bfe_feature_records r JOIN capabilities c ON c.m='property' AND c.visible
  WHERE r.module IN ('vehicles','permits') AND r.status='Reviewed' AND NOT EXISTS(SELECT 1 FROM public.bfe_request_issuances i WHERE i.record_id=r.id) GROUP BY r.module,c.reviewer
  UNION ALL
  SELECT 'participation',r.module,count(*) FILTER(WHERE e.status='Pending'),0,c.approver
  FROM public.bfe_activity_participation e JOIN public.bfe_feature_records r ON r.id=e.activity_id
  JOIN capabilities c ON c.m=CASE WHEN r.module='carpools' THEN 'transport' ELSE 'livelihood' END AND c.visible
  WHERE r.module IN ('carpools','booth-events','workshops') GROUP BY r.module,c.approver
  UNION ALL
  SELECT 'requests','',count(*) FILTER(WHERE status='Open'),count(*) FILTER(WHERE status='In progress'),c.reviewer
  FROM public.bfe_requests CROSS JOIN capabilities c WHERE c.m='requests' AND c.visible GROUP BY c.reviewer
  UNION ALL
  SELECT 'shuttle','',count(*) FILTER(WHERE status='Waiting for Shuttle' AND expires_at>now()),count(*) FILTER(WHERE status IN ('Accepted','On the way','Arrived') AND expires_at>now()),false
  FROM public.bfe_shuttle_requests CROSS JOIN capabilities c WHERE c.m='transport' AND c.visible GROUP BY c.visible
 ) SELECT jsonb_build_object('queues',coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.kind,q.module),'[]'::jsonb)) INTO result FROM queues q;
 RETURN result;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_office_operation_queue(text,integer),public.bfe_office_review_inbox() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_office_operation_queue(text,integer),public.bfe_office_review_inbox() TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
