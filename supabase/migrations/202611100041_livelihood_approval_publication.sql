-- Apply after 040. Six-category Livelihood feed; no records or grants are added.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE OR REPLACE FUNCTION public.bfe_marketplace_feed(p_module text DEFAULT '',p_category text DEFAULT '',p_search text DEFAULT '',p_sort text DEFAULT 'latest',p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb; total bigint; postable jsonb;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0
 OR NOT (public.bfe_can('livelihood','view','approved') OR public.bfe_can('livelihood','view','own') OR public.bfe_can('livelihood','view','association')) THEN
  RAISE EXCEPTION 'Community marketplace access required.' USING ERRCODE='42501'; END IF;
 IF p_module IS NULL OR p_module NOT IN ('','businesses','buy-sell','jobs','garage-sales','booth-events','workshops') OR p_category IS NULL OR length(p_category)>80 OR p_search IS NULL OR length(p_search)>100 OR p_sort IS NULL OR p_sort NOT IN ('latest','price_low','price_high') OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN
  RAISE EXCEPTION 'Check marketplace filters.' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(d.code ORDER BY d.code),'[]') INTO postable FROM public.bfe_feature_definitions d
 WHERE d.code IN ('businesses','buy-sell','jobs','garage-sales','booth-events','workshops') AND
 ((d.resident_create AND public.bfe_current_roles() && ARRAY['homeowner','renter']::text[] AND public.bfe_can('livelihood','create','own')) OR public.bfe_can('livelihood','create','association'));
 WITH visible AS (
  SELECT r.*,CASE WHEN r.module='buy-sell' AND r.fields->>'price' ~ '^[0-9]+([.][0-9]+)?$' THEN (r.fields->>'price')::numeric ELSE NULL END AS asking_price
  FROM public.bfe_feature_records r WHERE r.module IN ('businesses','buy-sell','jobs','garage-sales','booth-events','workshops')
  AND r.status='Published' AND r.publication_consent AND r.expires_at>now()
  AND (r.audience='members' OR r.audience=ANY(public.bfe_current_roles()))
  AND (p_module='' OR r.module=p_module) AND (p_category='' OR r.fields->>'category'=p_category)
  AND position(lower(p_search) IN lower(coalesce(r.public_title,'')||' '||coalesce(r.public_body,'')))>0
 ), page AS (
  SELECT * FROM visible ORDER BY
   CASE WHEN p_sort='price_low' THEN asking_price END ASC NULLS LAST,
   CASE WHEN p_sort='price_high' THEN asking_price END DESC NULLS LAST,
   created_at DESC,id OFFSET p_page*20 LIMIT 20
 )
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(jsonb_build_object(
  'id',id,'module',module,'title',public_title,'detail',public_body,'status',status,'expires_at',expires_at,'created_at',created_at,
  'fields',jsonb_strip_nulls(jsonb_build_object('category',fields->>'category','condition',fields->>'condition','price',CASE WHEN asking_price IS NOT NULL THEN fields->>'price' ELSE NULL END)))
  ORDER BY CASE WHEN p_sort='price_low' THEN asking_price END ASC NULLS LAST,
   CASE WHEN p_sort='price_high' THEN asking_price END DESC NULLS LAST,created_at DESC,id),'[]') INTO total,rows FROM page;
 RETURN jsonb_build_object('rows',rows,'total',total,'postable_modules',postable,
  'can_manage_own',public.bfe_can('livelihood','view','own') OR public.bfe_can('livelihood','view','association'));
END;$$;
REVOKE ALL ON FUNCTION public.bfe_marketplace_feed(text,text,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_marketplace_feed(text,text,text,text,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.bfe_review_feature(p_id uuid,p_version integer,p_status text,p_note text,p_public_title text DEFAULT NULL,p_public_body text DEFAULT NULL,p_audience text DEFAULT NULL,p_expires timestamptz DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records; d public.bfe_feature_definitions;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 THEN RAISE EXCEPTION 'Active membership required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_id FOR UPDATE;
 SELECT * INTO d FROM public.bfe_feature_definitions WHERE code=r.module;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Record unavailable.' USING ERRCODE='42501'; END IF;
 IF p_status='Withdrawn' AND r.owner_id=auth.uid() THEN
  IF NOT (public.bfe_can(d.capability,'create','own') OR public.bfe_can(d.capability,'create','association')) THEN RAISE EXCEPTION 'Edit permission required.' USING ERRCODE='42501';END IF;
  IF r.status IN ('Withdrawn','Rejected') THEN RAISE EXCEPTION 'Record already closed.'; END IF;
 ELSE
  IF NOT public.bfe_can(d.capability,'view','association') OR NOT public.bfe_can(d.capability,CASE WHEN p_status='Published' THEN 'publish' ELSE 'status' END,'association') THEN RAISE EXCEPTION 'Feature review permission required.' USING ERRCODE='42501'; END IF;
  IF NOT ((r.status='Submitted' AND (p_status IN ('In review','Rejected') OR (p_status='Published' AND r.module IN ('businesses','buy-sell','jobs','garage-sales','booth-events','workshops')))) OR (r.status='In review' AND p_status IN ('Reviewed','Rejected','Published')) OR (r.status='Reviewed' AND p_status='Published' AND d.publishable) OR (r.status='Published' AND p_status='Withdrawn')) THEN RAISE EXCEPTION 'Status transition not permitted.' USING ERRCODE='22023'; END IF;
  IF p_status='Published' AND (NOT d.publishable OR NOT r.publication_consent OR p_public_title IS NULL OR p_public_body IS NULL OR char_length(btrim(p_public_title)) NOT BETWEEN 3 AND 120 OR char_length(btrim(p_public_body)) NOT BETWEEN 10 AND 5000 OR p_audience IS NULL OR p_audience NOT IN ('members','homeowner','renter','board','security','driver') OR p_expires IS NULL OR p_expires<=now() OR p_expires>now()+interval '366 days') THEN RAISE EXCEPTION 'Publication needs consent, reviewed public text, audience and future expiry within one year.' USING ERRCODE='22023'; END IF;
 END IF;
 IF r.module IN ('businesses','buy-sell','jobs','garage-sales','booth-events','workshops') AND p_status='Reviewed' THEN
  RAISE EXCEPTION 'Use Approve and publish to make this listing visible.' USING ERRCODE='22023'; END IF;
 IF p_status='Published' AND EXISTS(SELECT 1 FROM public.bfe_listing_assets a WHERE a.record_id=r.id AND a.cover_path IS NOT NULL AND NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='bfe-listing-covers' AND o.name=a.cover_path)) THEN
  RAISE EXCEPTION 'Finish or remove the incomplete cover upload before publication.' USING ERRCODE='22023'; END IF;
 IF p_version IS NULL OR r.version<>p_version THEN RAISE EXCEPTION 'Record changed. Refresh before retrying.' USING ERRCODE='40001'; END IF;
 IF p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 5 AND 1000 OR p_note !~ '[^[:space:]]' THEN RAISE EXCEPTION 'Provide a review reason.' USING ERRCODE='22023'; END IF;
 UPDATE public.bfe_feature_records SET status=p_status,version=version+1,updated_at=now(),public_title=CASE WHEN p_status='Published' THEN btrim(p_public_title) ELSE public_title END,public_body=CASE WHEN p_status='Published' THEN btrim(p_public_body) ELSE public_body END,audience=CASE WHEN p_status='Published' THEN p_audience ELSE audience END,expires_at=CASE WHEN p_status='Published' THEN p_expires ELSE expires_at END WHERE id=p_id;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note) VALUES(p_id,auth.uid(),p_status,btrim(p_note));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(r.owner_id,'community','Submission: '||p_status,'Open your submission to check its review history.','/more/notifications','feature:'||r.id::text||':'||(r.version+1)::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
END;$$;
-- Legacy reviewed listings remain actionable until explicitly published.
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
CREATE OR REPLACE FUNCTION public.bfe_office_feature_queue(p_module text,p_page integer DEFAULT 0,p_search text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; rows jsonb; n bigint;
BEGIN
 IF p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Invalid page.' USING ERRCODE='22023'; END IF;
 result:=public.bfe_feature_dashboard(p_module,'review',0,p_search);
 WITH pending AS MATERIALIZED (
  SELECT r.* FROM public.bfe_feature_records r WHERE r.module=p_module AND (r.status IN ('Submitted','In review') OR (r.status='Reviewed' AND r.module IN ('businesses','buy-sell','jobs','garage-sales','booth-events','workshops')))
  AND position(lower(p_search) IN lower(r.title||' '||r.detail))>0
 ), page AS (SELECT * FROM pending ORDER BY created_at,id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM pending),coalesce(jsonb_agg(to_jsonb(p) ORDER BY created_at,id),'[]'::jsonb) INTO n,rows FROM page p;
 RETURN result||jsonb_build_object('rows',rows,'total',n);
END;$$;
NOTIFY pgrst,'reload schema'; COMMIT;
