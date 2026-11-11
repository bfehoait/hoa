-- Apply after 037. Read-only review aggregation over existing submissions.
-- No records are copied, approved or seeded. No decision permissions are granted.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.bfe_office_review_inbox() RETURNS jsonb
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
  SELECT 'feature',d.code,count(r.id) FILTER(WHERE r.status='Submitted'),count(r.id) FILTER(WHERE r.status='In review'),c.reviewer OR (d.publishable AND c.publisher)
  FROM public.bfe_feature_definitions d JOIN capabilities c ON c.m=d.capability AND c.visible
  LEFT JOIN public.bfe_feature_records r ON r.module=d.code AND r.status IN ('Submitted','In review')
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
REVOKE ALL ON FUNCTION public.bfe_office_review_inbox() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_office_review_inbox() TO authenticated;

-- Pending-only projections keep older submissions from being buried behind
-- completed history. Reuse the established dashboard's authorization/envelope.
CREATE FUNCTION public.bfe_office_feature_queue(p_module text,p_page integer DEFAULT 0,p_search text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; rows jsonb; n bigint;
BEGIN
 IF p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Invalid page.' USING ERRCODE='22023'; END IF;
 result:=public.bfe_feature_dashboard(p_module,'review',0,p_search);
 WITH pending AS MATERIALIZED (
  SELECT r.* FROM public.bfe_feature_records r WHERE r.module=p_module AND r.status IN ('Submitted','In review')
  AND position(lower(p_search) IN lower(r.title||' '||r.detail))>0
 ), page AS (SELECT * FROM pending ORDER BY created_at,id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM pending),coalesce(jsonb_agg(to_jsonb(p) ORDER BY created_at,id),'[]'::jsonb) INTO n,rows FROM page p;
 RETURN result||jsonb_build_object('rows',rows,'total',n);
END;$$;
CREATE FUNCTION public.bfe_office_operation_queue(p_kind text,p_page integer DEFAULT 0) RETURNS jsonb
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
   WHERE r.status='Pending' AND r.valid_until>now()
  ), page AS (SELECT * FROM pending ORDER BY created_at,id OFFSET p_page*20 LIMIT 20)
  SELECT (SELECT count(*) FROM pending),coalesce(jsonb_agg(to_jsonb(p) ORDER BY created_at,id),'[]'::jsonb) INTO n,rows FROM page p;
 END IF;
 RETURN result||jsonb_build_object('rows',rows,'total',n);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_office_feature_queue(text,integer,text),public.bfe_office_operation_queue(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_office_feature_queue(text,integer,text),public.bfe_office_operation_queue(text,integer) TO authenticated;
CREATE FUNCTION public.bfe_office_participation_queue(p_module text,p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; rows jsonb; n bigint;
BEGIN
 result:=public.bfe_participation_dashboard(p_module,true,p_page);
 WITH pending AS MATERIALIZED (
  SELECT e.*,r.public_title AS activity_title FROM public.bfe_activity_participation e
  JOIN public.bfe_feature_records r ON r.id=e.activity_id WHERE r.module=p_module AND e.status='Pending'
 ), page AS (SELECT * FROM pending ORDER BY created_at,id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM pending),coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('history',coalesce((
  SELECT jsonb_agg(jsonb_build_object('action',a.action,'note',a.note,'at',a.at) ORDER BY a.id DESC)
  FROM (SELECT * FROM public.bfe_participation_audit WHERE participation_id=p.id ORDER BY id DESC LIMIT 100) a
 ),'[]'::jsonb)) ORDER BY created_at,id),'[]'::jsonb) INTO n,rows FROM page p;
 RETURN result||jsonb_build_object('rows',rows,'total',n);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_office_participation_queue(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_office_participation_queue(text,integer) TO authenticated;

-- Pending property claims need a discoverable, paginated path to their lot review.
CREATE FUNCTION public.bfe_pending_lot_links(p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT public.bfe_can('property','view','association') THEN
  RAISE EXCEPTION 'Property review access required.' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Invalid page.' USING ERRCODE='22023'; END IF;
 WITH pending AS MATERIALIZED (
  SELECT l.id,l.physical_id,count(*) AS pending
  FROM public.bfe_lot_memberships m JOIN public.bfe_lots l ON l.id=m.lot_id
  JOIN public.bfe_import_batches b ON b.id=l.batch_id AND b.status='active'
  WHERE m.state='pending' GROUP BY l.id,l.physical_id
 ), page AS (SELECT * FROM pending ORDER BY physical_id,id OFFSET p_page*20 LIMIT 20)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM pending),'rows',coalesce(jsonb_agg(to_jsonb(p) ORDER BY physical_id,id),'[]'::jsonb)) INTO result FROM page p;
 RETURN result;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_pending_lot_links(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_pending_lot_links(integer) TO authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
