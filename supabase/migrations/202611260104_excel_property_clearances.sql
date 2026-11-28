-- HOA.xlsx permits and vehicle follow-up. AFTER 103. Uses actual issuance records.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $$
DECLARE rule text;
BEGIN
 SELECT pg_get_expr(conbin,conrelid) INTO rule FROM pg_constraint WHERE conrelid='public.bfe_notifications'::regclass AND conname='bfe_notifications_path_check';
 IF rule IS NULL THEN RAISE EXCEPTION 'Review notification paths first.'; END IF;
 ALTER TABLE public.bfe_notifications DROP CONSTRAINT bfe_notifications_path_check;
 EXECUTE 'ALTER TABLE public.bfe_notifications ADD CONSTRAINT bfe_notifications_path_check CHECK (path IN (''/more/vehicles'',''/more/permits'') OR ('||rule||'))';
END;$$;
CREATE TABLE public.bfe_move_clearances (
 record_id uuid PRIMARY KEY REFERENCES public.bfe_feature_records(id),
 status text NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected')),
 version integer NOT NULL DEFAULT 1, checked_by uuid REFERENCES auth.users(id),checked_at timestamptz,note text NOT NULL DEFAULT ''
);
ALTER TABLE public.bfe_move_clearances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_move_clearances FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bfe_excel_property_reviewed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='Reviewed' AND OLD.status IS DISTINCT FROM NEW.status THEN
  IF NEW.module='permits' AND NEW.fields->>'permit' IN ('Move-in clearance','Move-out clearance') THEN
   INSERT INTO public.bfe_move_clearances(record_id) VALUES(NEW.id) ON CONFLICT DO NOTHING;
   INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
   VALUES(NEW.owner_id,'community','Office approved your move request','Security must check and approve your move before the clearance is issued.','/more/permits','move-office:'||NEW.id::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
  ELSIF NEW.module='vehicles' AND NEW.fields->>'request' IS DISTINCT FROM 'Remove a vehicle' THEN
   INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
   VALUES(NEW.owner_id,'community','Vehicle request approved','Visit the HOA office for sticker installation.','/more/vehicles','vehicle-installation:'||NEW.id::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
  END IF;
 END IF;
 RETURN NULL;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_excel_property_reviewed() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bfe_excel_property_reviewed AFTER UPDATE OF status ON public.bfe_feature_records FOR EACH ROW EXECUTE FUNCTION public.bfe_excel_property_reviewed();
CREATE FUNCTION public.bfe_excel_move_issue_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.bfe_feature_records WHERE id=NEW.record_id AND module='permits' AND fields->>'permit' IN ('Move-in clearance','Move-out clearance'))
 AND NOT EXISTS(SELECT 1 FROM public.bfe_move_clearances WHERE record_id=NEW.record_id AND status='Approved') THEN
 RAISE EXCEPTION 'Security must approve the move before issuing its clearance.' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_excel_move_issue_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bfe_excel_move_issue_guard BEFORE INSERT ON public.bfe_request_issuances FOR EACH ROW EXECUTE FUNCTION public.bfe_excel_move_issue_guard();
CREATE FUNCTION public.bfe_move_clearance_queue() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT coalesce('security'=ANY(public.bfe_current_roles()) AND public.bfe_can('security','view','association') AND public.bfe_can('security','status','association'),false) THEN RAISE EXCEPTION 'Security check permission required.' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (
  SELECT c.*,r.title,r.fields->>'permit' AS permit,r.fields->>'start' AS date,r.fields->>'unit' AS unit
  FROM public.bfe_move_clearances c JOIN public.bfe_feature_records r ON r.id=c.record_id
  WHERE c.status='Pending' AND r.status='Reviewed' ORDER BY r.created_at,c.record_id LIMIT 50
 ) x),'[]'::jsonb);
END;$$;
CREATE FUNCTION public.bfe_decide_move_clearance(p_id uuid,p_version integer,p_status text,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.bfe_move_clearances;r public.bfe_feature_records;
BEGIN
 IF NOT coalesce('security'=ANY(public.bfe_current_roles()) AND public.bfe_can('security','view','association') AND public.bfe_can('security','status','association'),false) THEN RAISE EXCEPTION 'Security check permission required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_id FOR UPDATE;
 SELECT * INTO c FROM public.bfe_move_clearances WHERE record_id=p_id FOR UPDATE;
 IF c.record_id IS NULL OR r.status<>'Reviewed' THEN RAISE EXCEPTION 'Move request unavailable.' USING ERRCODE='42501'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('Approved','Rejected') OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Check the move and enter your decision note.' USING ERRCODE='22023'; END IF;
 IF c.status=p_status AND c.checked_by=auth.uid() AND c.note=btrim(p_note) THEN RETURN; END IF;
 IF c.status<>'Pending' OR p_version IS NULL OR c.version<>p_version THEN RAISE EXCEPTION 'Move request changed. Reopen it.' USING ERRCODE='40001'; END IF;
 UPDATE public.bfe_move_clearances SET status=p_status,version=version+1,checked_by=auth.uid(),checked_at=now(),note=btrim(p_note) WHERE record_id=p_id;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note) VALUES(p_id,auth.uid(),'Security '||p_status,btrim(p_note));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 VALUES(r.owner_id,'community','Security: Move '||p_status,'Open your move request for the decision.','/more/permits','move-security:'||p_id::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
END;$$;
CREATE FUNCTION public.bfe_issued_permit(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records;i public.bfe_request_issuances;
BEGIN
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_id;
 IF auth.uid() IS NULL OR coalesce(cardinality(public.bfe_current_roles()),0)=0 OR r.module IS DISTINCT FROM 'permits' OR NOT coalesce((r.owner_id=auth.uid() AND public.bfe_can('property','view','own')) OR public.bfe_can('property','view','association'),false) THEN RAISE EXCEPTION 'Permit unavailable.' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM public.bfe_request_issuances WHERE record_id=p_id AND outcome='permit';
 IF i.record_id IS NULL THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('reference',i.reference,'valid_from',i.valid_from,'valid_until',i.valid_until,'issued_at',i.issued_at,'title',r.title,'permit',r.fields->>'permit','unit',r.fields->>'unit');
END;$$;
REVOKE ALL ON FUNCTION public.bfe_move_clearance_queue(),public.bfe_decide_move_clearance(uuid,integer,text,text),public.bfe_issued_permit(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_move_clearance_queue(),public.bfe_decide_move_clearance(uuid,integer,text,text),public.bfe_issued_permit(uuid) TO authenticated;
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
    WHEN n.event IN ('request-update','request-followup','move-office','move-security','vehicle-installation','booking-payment') AND n.subject_uuid IS NOT NULL THEN n.path||'?record='||n.subject_uuid::text
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
NOTIFY pgrst,'reload schema';
COMMIT;
