-- Apply after 041. Approval and actual issuance remain distinct.
-- Private, immutable issuance records; no official numbers or records seeded.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_request_issuances (
 record_id uuid PRIMARY KEY REFERENCES public.bfe_feature_records(id),
 module text NOT NULL CHECK(module IN ('vehicles','permits')),
 outcome text NOT NULL CHECK(outcome IN ('sticker','permit','vehicle_removed')),
 reference text NOT NULL CHECK(char_length(reference) BETWEEN 3 AND 120),
 valid_from date NOT NULL,
 valid_until date,
 issued_by uuid NOT NULL REFERENCES auth.users(id),
 issued_at timestamptz NOT NULL DEFAULT now(),
 snapshot jsonb NOT NULL,
 CHECK((outcome='vehicle_removed' AND valid_until IS NULL) OR (outcome<>'vehicle_removed' AND valid_until IS NOT NULL AND valid_until>=valid_from))
);
ALTER TABLE public.bfe_request_issuances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_request_issuances FROM PUBLIC,anon,authenticated;

-- Withdrawing a request cannot revoke or conceal an already issued document.
CREATE FUNCTION public.bfe_protect_issued_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status AND EXISTS(SELECT 1 FROM public.bfe_request_issuances WHERE record_id=OLD.id) THEN
  RAISE EXCEPTION 'Issuance is already recorded. Contact the office to review it.' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_protect_issued_request() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bfe_protect_issued_request BEFORE UPDATE OF status ON public.bfe_feature_records FOR EACH ROW EXECUTE FUNCTION public.bfe_protect_issued_request();

CREATE FUNCTION public.bfe_request_issuance(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records; result jsonb;
BEGIN
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_id;
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR r.id IS NULL OR r.module NOT IN ('vehicles','permits')
 OR NOT(public.bfe_can('property','view','association') OR (r.owner_id=auth.uid() AND public.bfe_can('property','view','own'))) THEN
  RAISE EXCEPTION 'Request unavailable.' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('outcome',outcome,'reference',reference,'valid_from',valid_from,'valid_until',valid_until,'issued_at',issued_at) INTO result FROM public.bfe_request_issuances WHERE record_id=p_id;
 RETURN jsonb_build_object('issuance',result,'can_issue',r.status='Reviewed' AND public.bfe_can('property','view','association') AND public.bfe_can('property','status','association'));
END;$$;

CREATE FUNCTION public.bfe_issue_request(p_id uuid,p_version integer,p_reference text,p_valid_from date,p_valid_until date,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records; prior public.bfe_request_issuances; kind text;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT public.bfe_can('property','view','association') OR NOT public.bfe_can('property','status','association') THEN
  RAISE EXCEPTION 'Property issuance permission required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_id FOR UPDATE;
 IF r.id IS NULL OR r.module NOT IN ('vehicles','permits') OR r.status<>'Reviewed' THEN
  RAISE EXCEPTION 'Approve the request before recording issuance.' USING ERRCODE='22023'; END IF;
 IF p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 120 OR p_valid_from IS NULL OR NOT isfinite(p_valid_from) OR (p_valid_until IS NOT NULL AND NOT isfinite(p_valid_until)) OR p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 5 AND 1000 THEN
  RAISE EXCEPTION 'Enter the official reference, effective date and issuance note.' USING ERRCODE='22023'; END IF;
 kind:=CASE WHEN r.module='permits' THEN 'permit' WHEN r.fields->>'request'='Remove a vehicle' THEN 'vehicle_removed' ELSE 'sticker' END;
 IF (kind='vehicle_removed' AND p_valid_until IS NOT NULL) OR (kind<>'vehicle_removed' AND (p_valid_until IS NULL OR p_valid_until<p_valid_from)) THEN
  RAISE EXCEPTION 'Check validity dates. Vehicle removal has no expiry; stickers and permits need an expiry.' USING ERRCODE='22023'; END IF;
 SELECT * INTO prior FROM public.bfe_request_issuances WHERE record_id=p_id;
 IF prior.record_id IS NOT NULL THEN
  IF prior.reference=btrim(p_reference) AND prior.valid_from=p_valid_from AND prior.valid_until IS NOT DISTINCT FROM p_valid_until THEN RETURN; END IF;
  RAISE EXCEPTION 'Issuance already recorded. Refresh the request.' USING ERRCODE='40001'; END IF;
 IF p_version IS NULL OR p_version<>r.version THEN RAISE EXCEPTION 'Request changed. Refresh before issuing.' USING ERRCODE='40001'; END IF;
 INSERT INTO public.bfe_request_issuances(record_id,module,outcome,reference,valid_from,valid_until,issued_by,snapshot)
 VALUES(r.id,r.module,kind,btrim(p_reference),p_valid_from,p_valid_until,auth.uid(),jsonb_build_object('title',r.title,'fields',r.fields));
 UPDATE public.bfe_feature_records SET version=version+1,updated_at=now() WHERE id=r.id;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note) VALUES(r.id,auth.uid(),CASE WHEN kind='vehicle_removed' THEN 'Vehicle removal recorded' ELSE 'Issued' END,btrim(p_note));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 VALUES(r.owner_id,'community',CASE WHEN kind='vehicle_removed' THEN 'Vehicle removal recorded' ELSE 'Request issued' END,'Open your request to see its official reference and validity.',CASE WHEN r.module='vehicles' THEN '/more/vehicles' ELSE '/more/permits' END,'issuance:'||r.id::text)
 ON CONFLICT(recipient_id,event_key) DO NOTHING;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_request_issuance(uuid),public.bfe_issue_request(uuid,integer,text,date,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_request_issuance(uuid),public.bfe_issue_request(uuid,integer,text,date,date,text) TO authenticated;
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
  SELECT 'passes','',count(*) FILTER(WHERE status='Pending' AND valid_until>now()),0,c.approver
  FROM public.bfe_visitor_passes CROSS JOIN capabilities c WHERE c.m='security' AND c.visible GROUP BY c.approver
  UNION ALL
  SELECT 'feature',d.code,count(r.id) FILTER(WHERE r.status='Submitted' OR (r.status='Reviewed' AND r.module IN ('businesses','buy-sell','jobs','garage-sales','booth-events','workshops'))),count(r.id) FILTER(WHERE r.status='In review'),c.reviewer OR (d.publishable AND c.publisher)
  FROM public.bfe_feature_definitions d JOIN capabilities c ON c.m=d.capability AND c.visible
  LEFT JOIN public.bfe_feature_records r ON r.module=d.code AND (r.status IN ('Submitted','In review') OR (r.status='Reviewed' AND r.module IN ('businesses','buy-sell','jobs','garage-sales','booth-events','workshops')))
  -- Staff announcements publish directly; unfinished author uploads are not resident approvals.
  WHERE d.code<>'publishing' GROUP BY d.code,d.publishable,c.reviewer,c.publisher
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
CREATE FUNCTION public.bfe_office_issuance_queue(p_module text,p_page integer DEFAULT 0,p_search text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; rows jsonb; total bigint;
BEGIN
 IF p_module IS NULL OR p_module NOT IN ('vehicles','permits') OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Check issuance queue filters.' USING ERRCODE='22023'; END IF;
 result:=public.bfe_feature_dashboard(p_module,'review',p_page,p_search);
 WITH visible AS MATERIALIZED (
  SELECT r.* FROM public.bfe_feature_records r WHERE r.module=p_module AND r.status='Reviewed'
  AND NOT EXISTS(SELECT 1 FROM public.bfe_request_issuances i WHERE i.record_id=r.id)
  AND position(lower(p_search) IN lower(r.title||' '||r.detail))>0
 ), page AS (SELECT * FROM visible ORDER BY created_at,id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(to_jsonb(p) ORDER BY created_at,id),'[]'::jsonb) INTO total,rows FROM page p;
 RETURN result||jsonb_build_object('rows',rows,'total',total);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_office_issuance_queue(text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_office_issuance_queue(text,integer,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
