-- Apply after 043. Explicitly apply verified account/lot relationships.
-- Does not change registered ownership, remove other occupants or grant receipts.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_household_applications (
 record_id uuid PRIMARY KEY REFERENCES public.bfe_feature_records(id),
 membership_id uuid NOT NULL REFERENCES public.bfe_lot_memberships(id),
 target_id uuid NOT NULL REFERENCES auth.users(id),
 lot_id uuid NOT NULL REFERENCES public.bfe_lots(id),
 relationship text NOT NULL CHECK(relationship IN ('owner','renter','household')),
 reference text NOT NULL,
 applied_by uuid NOT NULL REFERENCES auth.users(id),
 applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bfe_household_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_household_applications FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bfe_household_application(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records; result jsonb;
BEGIN
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_id;
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR r.id IS NULL OR r.module<>'household-changes'
 OR NOT(public.bfe_can('property','view','association') OR (r.owner_id=auth.uid() AND public.bfe_can('property','view','own'))) THEN RAISE EXCEPTION 'Request unavailable.' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('physical_id',l.physical_id,'relationship',a.relationship,'state',m.state,'applied_at',a.applied_at)
 INTO result FROM public.bfe_household_applications a JOIN public.bfe_lots l ON l.id=a.lot_id JOIN public.bfe_lot_memberships m ON m.id=a.membership_id WHERE a.record_id=p_id;
 RETURN jsonb_build_object('application',result,'can_apply',r.status='Reviewed' AND public.bfe_can('people','view','association') AND public.bfe_can('property','manage','association') AND public.bfe_can('property','view','association'));
END;$$;
CREATE FUNCTION public.bfe_apply_household_request(p_id uuid,p_version integer,p_target uuid,p_lot uuid,p_expected jsonb,p_lot_version integer,p_relationship text,p_reference text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records; prior public.bfe_household_applications; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT public.bfe_can('people','view','association') OR NOT public.bfe_can('property','view','association') OR NOT public.bfe_can('property','manage','association') THEN RAISE EXCEPTION 'Account and property review permissions required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_id FOR UPDATE;
 IF r.id IS NULL OR r.module<>'household-changes' OR r.status<>'Reviewed' THEN RAISE EXCEPTION 'Complete the household review first.' USING ERRCODE='22023'; END IF;
 IF p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 100 OR p_target IS NULL OR p_lot IS NULL OR p_relationship IS NULL OR p_relationship NOT IN ('owner','renter','household') THEN RAISE EXCEPTION 'Select the verified account, lot, relationship and reference.' USING ERRCODE='22023'; END IF;
 SELECT * INTO prior FROM public.bfe_household_applications WHERE record_id=p_id;
 IF prior.record_id IS NOT NULL THEN
  IF prior.target_id=p_target AND prior.lot_id=p_lot AND prior.relationship=p_relationship AND prior.reference=btrim(p_reference) THEN RETURN; END IF;
  RAISE EXCEPTION 'The verified relationship was already applied. Refresh the request.' USING ERRCODE='40001'; END IF;
 IF p_version IS NULL OR r.version<>p_version THEN RAISE EXCEPTION 'Request changed. Refresh before applying.' USING ERRCODE='40001'; END IF;
 IF coalesce(r.fields->>'effective','')<>'' AND (r.fields->>'effective')::date>(now() AT TIME ZONE 'Asia/Manila')::date THEN RAISE EXCEPTION 'The proposed effective date has not arrived. Review the date before applying.' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM public.members WHERE user_id=p_target)<>1 THEN RAISE EXCEPTION 'Account identity is ambiguous. Review the member record first.' USING ERRCODE='22023'; END IF;
 result:=public.bfe_link_account_lot(p_target,p_lot,p_expected,p_lot_version,p_relationship,btrim(p_reference)||' / household request '||r.id::text);
 INSERT INTO public.bfe_household_applications(record_id,membership_id,target_id,lot_id,relationship,reference,applied_by)
 VALUES(r.id,(result->>'membership_id')::uuid,p_target,p_lot,p_relationship,btrim(p_reference),auth.uid());
 UPDATE public.bfe_feature_records SET version=version+1,updated_at=now() WHERE id=r.id;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note) VALUES(r.id,auth.uid(),'Relationship applied',btrim(p_reference));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 VALUES(r.owner_id,'community','Household relationship applied','The verified account–lot relationship was recorded. Registered ownership and receipt access are separate.','/explore/household-changes','household-application:'||r.id::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
END;$$;
CREATE FUNCTION public.bfe_protect_applied_household_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status AND EXISTS(SELECT 1 FROM public.bfe_household_applications WHERE record_id=OLD.id) THEN RAISE EXCEPTION 'The relationship is already applied. Review membership changes in the Lot register.' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_protect_applied_household_request() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bfe_protect_applied_household_request BEFORE UPDATE OF status ON public.bfe_feature_records FOR EACH ROW EXECUTE FUNCTION public.bfe_protect_applied_household_request();
CREATE FUNCTION public.bfe_office_household_queue(p_module text,p_page integer DEFAULT 0,p_search text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; rows jsonb; total bigint;
BEGIN
 IF p_module IS DISTINCT FROM 'household-changes' OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Check household queue filters.' USING ERRCODE='22023'; END IF;
 result:=public.bfe_feature_dashboard(p_module,'review',p_page,p_search);
 WITH visible AS MATERIALIZED (
  SELECT r.* FROM public.bfe_feature_records r WHERE r.module=p_module AND r.status='Reviewed'
  AND NOT EXISTS(SELECT 1 FROM public.bfe_household_applications a WHERE a.record_id=r.id)
  AND position(lower(p_search) IN lower(r.title||' '||r.detail))>0
 ), page AS (SELECT * FROM visible ORDER BY created_at,id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(to_jsonb(p) ORDER BY created_at,id),'[]'::jsonb) INTO total,rows FROM page p;
 RETURN result||jsonb_build_object('rows',rows,'total',total);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_household_application(uuid),public.bfe_apply_household_request(uuid,integer,uuid,uuid,jsonb,integer,text,text),public.bfe_office_household_queue(text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_household_application(uuid),public.bfe_apply_household_request(uuid,integer,uuid,uuid,jsonb,integer,text,text),public.bfe_office_household_queue(text,integer,text) TO authenticated;
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
NOTIFY pgrst,'reload schema'; COMMIT;
