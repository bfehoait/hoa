-- Apply after 069, together with the frontend notification-link update.
-- Resolves existing AND future notifications when read; does not rewrite history.
-- No roles, approvals, charges, bookings or notification read states are changed.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE OR REPLACE FUNCTION public.bfe_my_notifications(p_page integer DEFAULT 0,p_unread_only boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rows jsonb; v_total bigint; v_unread bigint;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 THEN
  RAISE EXCEPTION 'Active membership required.' USING ERRCODE='42501';
 END IF;
 IF p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 OR p_unread_only IS NULL THEN
  RAISE EXCEPTION 'Unsupported page.' USING ERRCODE='22023';
 END IF;
 SELECT count(*),count(*) FILTER(WHERE read_at IS NULL) INTO v_total,v_unread
 FROM public.bfe_notifications WHERE recipient_id=auth.uid();
 WITH raw_page AS (
  SELECT n.*,split_part(n.event_key,':',1) AS event,split_part(n.event_key,':',2) AS subject
  FROM public.bfe_notifications n
  WHERE recipient_id=auth.uid() AND (NOT p_unread_only OR read_at IS NULL)
  ORDER BY created_at DESC,id DESC OFFSET p_page*20 LIMIT 20
 ), page AS (
  SELECT n.*,CASE WHEN subject ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN subject::uuid END AS subject_uuid
  FROM raw_page n
 ), resolved AS (
  SELECT n.id,n.kind,n.title,n.body,n.created_at,n.read_at,
   CASE
    WHEN n.event IN ('booking','office-booking','visitor','handling') AND n.subject_uuid IS NOT NULL THEN
     CASE n.event WHEN 'visitor' THEN '/services/visitors' WHEN 'handling' THEN '/office/requests' ELSE '/services/bookings' END||'?record='||n.subject_uuid::text
    WHEN n.event='request-audit' THEN CASE WHEN a.request_id IS NOT NULL THEN n.path||'?record='||a.request_id::text ELSE '/more/notifications?unavailable=1' END
    WHEN n.event IN ('feature','issuance','household-application','garage-item') THEN
     CASE WHEN f.id IS NOT NULL THEN CASE f.module WHEN 'vehicles' THEN '/more/vehicles' WHEN 'permits' THEN '/more/permits' ELSE '/explore/'||f.module END||'?record='||f.id::text ELSE '/more/notifications?unavailable=1' END
    WHEN n.event='participation' THEN CASE WHEN activity.module IN ('booth-events','workshops','carpools') THEN '/services/participation?module='||activity.module||'&record='||participation.id::text ELSE '/more/notifications?unavailable=1' END
    WHEN n.event='office-property-link' THEN '/account'
    WHEN n.event='accounting' THEN '/office/finance'
    WHEN n.path='/more/notifications' THEN '/more/profile'
    ELSE n.path
   END AS path
  FROM page n
  LEFT JOIN public.bfe_request_audit a ON n.event='request-audit' AND a.id::text=n.subject
  LEFT JOIN public.bfe_garage_items item ON n.event='garage-item' AND item.id=n.subject_uuid
  LEFT JOIN public.bfe_feature_records f ON
   (n.event IN ('feature','issuance','household-application') AND f.id=n.subject_uuid)
   OR (n.event='garage-item' AND f.id=item.record_id)
  LEFT JOIN public.bfe_activity_participation participation ON n.event='participation' AND participation.id=n.subject_uuid
  LEFT JOIN public.bfe_feature_records activity ON activity.id=participation.activity_id
 )
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC,r.id DESC),'[]'::jsonb) INTO v_rows FROM resolved r;
 RETURN jsonb_build_object('rows',v_rows,'total',CASE WHEN p_unread_only THEN v_unread ELSE v_total END,'unread',v_unread);
END;$$;

-- Exact owned-record reads reuse the installed dashboards and their CURRENT
-- permission checks and serialization. Ranking finds records beyond page one.
-- Table lookups never return other owners' records. All operations stay read-only.
CREATE FUNCTION public.bfe_open_notification_record(p_kind text,p_id uuid,p_module text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; record_page integer;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 THEN
  RAISE EXCEPTION 'Active membership required.' USING ERRCODE='42501';
 END IF;
 IF p_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('booking','visitor','feature','participation') THEN
  RAISE EXCEPTION 'Select a valid item.' USING ERRCODE='22023';
 END IF;
 IF p_kind='booking' THEN
  result:=public.bfe_booking_dashboard(false,0);
  SELECT (ranked.position/20)::integer INTO record_page FROM (
   SELECT id,row_number() OVER(ORDER BY created_at DESC,id)-1 AS position
   FROM public.bfe_bookings WHERE owner_id=auth.uid()
  ) ranked WHERE id=p_id;
  IF record_page>0 THEN result:=public.bfe_booking_dashboard(false,record_page); END IF;
 ELSIF p_kind='visitor' THEN
  result:=public.bfe_community_pass_dashboard(false,0);
  SELECT (ranked.position/20)::integer INTO record_page FROM (
   SELECT r.id,row_number() OVER(ORDER BY r.created_at DESC,r.id)-1 AS position
   FROM public.bfe_visitor_passes r JOIN public.bfe_lots l ON l.id=r.lot_id WHERE r.owner_id=auth.uid()
  ) ranked WHERE id=p_id;
  IF record_page>0 THEN result:=public.bfe_community_pass_dashboard(false,record_page); END IF;
 ELSIF p_kind='feature' THEN
  result:=public.bfe_feature_dashboard(p_module,'mine',0,'');
  SELECT (ranked.position/20)::integer INTO record_page FROM (
   SELECT id,row_number() OVER(ORDER BY created_at DESC,id)-1 AS position
   FROM public.bfe_feature_records WHERE owner_id=auth.uid() AND module=p_module
  ) ranked WHERE id=p_id;
  IF record_page>0 THEN result:=public.bfe_feature_dashboard(p_module,'mine',record_page,''); END IF;
 ELSE
  result:=public.bfe_business_participation_dashboard(p_module,false,false,0);
  SELECT (ranked.position/20)::integer INTO record_page FROM (
   SELECT e.id,row_number() OVER(ORDER BY e.created_at DESC,e.id)-1 AS position
   FROM public.bfe_activity_participation e JOIN public.bfe_feature_records r ON r.id=e.activity_id
   WHERE e.owner_id=auth.uid() AND r.module=p_module
  ) ranked WHERE id=p_id;
  IF record_page>0 THEN result:=public.bfe_business_participation_dashboard(p_module,false,false,record_page); END IF;
 END IF;
 IF record_page IS NULL THEN RETURN NULL; END IF;
 RETURN (SELECT value FROM jsonb_array_elements(result->'rows') WHERE value->>'id'=p_id::text LIMIT 1);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_my_notifications(integer,boolean),public.bfe_open_notification_record(text,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_my_notifications(integer,boolean),public.bfe_open_notification_record(text,uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
