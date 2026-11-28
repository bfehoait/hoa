-- HOA.xlsx Helpdesk ownership and follow-up. AFTER 102. No member/committee assignments.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $$
DECLARE rule text;
BEGIN
 SELECT pg_get_expr(conbin,conrelid) INTO rule FROM pg_constraint WHERE conrelid='public.bfe_notifications'::regclass AND conname='bfe_notifications_path_check';
 IF rule IS NULL THEN RAISE EXCEPTION 'Review the notification path policy before installing Helpdesk routing.'; END IF;
 ALTER TABLE public.bfe_notifications DROP CONSTRAINT bfe_notifications_path_check;
 EXECUTE 'ALTER TABLE public.bfe_notifications ADD CONSTRAINT bfe_notifications_path_check CHECK (path IN (''/board/requests'',''/services/team-requests'') OR ('||rule||'))';
END;$$;
INSERT INTO public.bfe_tab_rules(subject_kind,subject_id,module,scope,mode) VALUES
 ('role','board','requests','association','edit'),
 ('committee','livelihood','requests','association','edit'),
 ('committee','data_governance','requests','association','edit'),
 ('committee','livelihood','livelihood','association','edit'),
 ('committee','data_governance','livelihood','association','edit')
ON CONFLICT(subject_kind,subject_id,module,scope) DO NOTHING;
CREATE OR REPLACE FUNCTION public.bfe_request_category_allowed_for(p_user uuid,p_category text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH active AS (
  SELECT a.id,a.committee_id FROM public.bfe_access_assignments a
  WHERE a.user_id=p_user AND a.revoked_at IS NULL AND a.starts_at<=now() AND (a.expires_at IS NULL OR a.expires_at>now())
 ), limits AS (
  SELECT committee_id AS area FROM active WHERE committee_id IN ('grievance','maintenance','livelihood','data_governance','board')
  UNION SELECT r FROM unnest(public.bfe_assigned_roles_for(p_user)) r WHERE r IN ('grievance','maintenance','livelihood','data_governance','board')
 )
 SELECT p_user IS NOT NULL AND (
  NOT EXISTS(SELECT 1 FROM limits)
  OR 'developer'=ANY(public.bfe_roles_for(p_user))
  OR EXISTS(SELECT 1 FROM active a JOIN public.bfe_access_grants g ON g.assignment_id=a.id
   WHERE a.committee_id NOT IN ('grievance','maintenance','livelihood','data_governance','board') AND g.module='requests' AND g.action='view'
    AND g.scope='association' AND g.effect='allow')
  OR EXISTS(SELECT 1 FROM public.bfe_tab_rules t
   WHERE t.module='requests' AND t.scope='association' AND t.mode IN ('view','edit') AND (
    (t.subject_kind='user' AND t.subject_id=p_user::text)
    OR (t.subject_kind='committee' AND t.subject_id NOT IN ('grievance','maintenance','livelihood','data_governance','board')
        AND t.subject_id IN (SELECT committee_id FROM active))))
  OR EXISTS(SELECT 1 FROM limits WHERE
   (area='grievance' AND p_category='Complaint')
   OR (area='board' AND p_category IN ('Concern','Idea'))
   OR (area IN ('livelihood','data_governance') AND p_category='Support')
   OR (area='maintenance' AND p_category='Maintenance'))
 );
$$;
CREATE OR REPLACE FUNCTION public.bfe_request_access(p_request_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT cardinality(public.bfe_current_roles())>0 AND EXISTS (
    SELECT 1 FROM public.bfe_requests r WHERE r.id=p_request_id AND (
      (r.owner_id=auth.uid() AND public.bfe_can('requests','view','own'))
      OR (public.bfe_can('requests','view','association')
          AND public.bfe_request_category_allowed_for(auth.uid(), r.category))
      OR 'developer'=ANY(public.bfe_current_roles())
    )
  );
$$;
CREATE OR REPLACE FUNCTION public.bfe_set_request_status(p_request_id uuid, p_expected_version integer, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.bfe_requests; v_old text;
BEGIN
  IF NOT public.bfe_can('requests','view','association') OR NOT public.bfe_can('requests','status','association') THEN
    RAISE EXCEPTION 'Office access is required.' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('Open','In progress','Resolved') OR p_expected_version IS NULL THEN
    RAISE EXCEPTION 'Choose a supported request status.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v FROM public.bfe_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This request is unavailable.' USING ERRCODE = '42501'; END IF;
  IF NOT public.bfe_request_category_allowed_for(auth.uid(), v.category) THEN
    RAISE EXCEPTION 'This request is outside your committee''s Help desk categories.' USING ERRCODE = '42501';
  END IF;
  IF v.status = p_status THEN RETURN to_jsonb(v); END IF;
  IF v.version <> p_expected_version THEN
    RAISE EXCEPTION 'This request changed. Refresh before updating its status.' USING ERRCODE = '40001';
  END IF;
  v_old := v.status;
  UPDATE public.bfe_requests SET status = p_status, version = version + 1, updated_at = now()
    WHERE id = p_request_id RETURNING * INTO v;
  INSERT INTO public.bfe_request_audit(request_id, actor_id, action, old_status, new_status)
    VALUES(p_request_id, auth.uid(), 'Status changed', v_old, p_status);
  RETURN to_jsonb(v);
END;
$$;
CREATE OR REPLACE FUNCTION public.bfe_request_business_context(p_request uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_request_business_details;category text;handle boolean;assignable boolean;
BEGIN
 IF NOT public.bfe_request_access(p_request) THEN RAISE EXCEPTION 'Request unavailable.' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.bfe_request_business_details WHERE request_id=p_request;
 SELECT x.category INTO category FROM public.bfe_requests x WHERE x.id=p_request;
 handle:=public.bfe_can('requests','view','association') AND public.bfe_can('requests','status','association') AND public.bfe_request_category_allowed_for(auth.uid(),category);
 assignable:=handle AND public.bfe_can('requests','assign','association');
 RETURN jsonb_build_object('details',coalesce(r.details,'{}'),'priority',coalesce(r.priority,'Untriaged'),
 'assignee_id',r.assignee_id,'assignee_name',(SELECT m.name FROM public.members m WHERE m.user_id=r.assignee_id AND m.status='Active' LIMIT 1),
 'resolution',coalesce(r.resolution,''),'version',coalesce(r.version,0),'can_handle',handle,'can_assign',assignable,
 'handlers',CASE WHEN assignable THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(m.name,'Account holder')) ORDER BY m.name,m.user_id),'[]') FROM public.members m
 WHERE m.user_id IS NOT NULL AND m.status='Active' AND (SELECT count(*) FROM public.members d WHERE d.user_id=m.user_id)=1
 AND public.bfe_request_category_allowed_for(m.user_id,category) AND public.bfe_can_for(m.user_id,'requests','view','association') AND public.bfe_can_for(m.user_id,'requests','reply','association')) ELSE '[]'::jsonb END);
END;$$;
CREATE OR REPLACE FUNCTION public.bfe_save_request_handling(p_request uuid,p_request_version integer,p_context_version integer,p_priority text,p_assignee uuid,p_resolution text,p_reference text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_requests; c public.bfe_request_business_details; before_value jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.bfe_can('requests','view','association') OR NOT public.bfe_can('requests','status','association') THEN RAISE EXCEPTION 'Office request handling permission required.' USING ERRCODE='42501'; END IF;
 IF p_priority IS NULL OR p_priority NOT IN ('Untriaged','Low','Normal','High','Urgent') OR p_resolution IS NULL OR char_length(btrim(p_resolution))>5000 OR p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Check priority, resolution and handling reference.' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM public.bfe_requests WHERE id=p_request FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Request unavailable.' USING ERRCODE='42501'; END IF;
 IF NOT public.bfe_request_category_allowed_for(auth.uid(),r.category) THEN RAISE EXCEPTION 'This request is outside your committee''s Help desk categories.' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.bfe_request_business_details WHERE request_id=p_request FOR UPDATE;
 IF p_request_version IS NULL OR p_request_version<>r.version OR p_context_version IS NULL OR p_context_version<>coalesce(c.version,0) THEN RAISE EXCEPTION 'Request changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
 IF r.status='Resolved' THEN RAISE EXCEPTION 'Reopen the request before changing its handling.' USING ERRCODE='22023'; END IF;
 IF p_assignee IS DISTINCT FROM c.assignee_id THEN
  IF NOT public.bfe_can('requests','assign','association') THEN RAISE EXCEPTION 'Request assignment permission required.' USING ERRCODE='42501'; END IF;
  IF p_assignee IS NOT NULL AND (NOT public.bfe_request_category_allowed_for(p_assignee,r.category) OR NOT public.bfe_can_for(p_assignee,'requests','view','association') OR NOT public.bfe_can_for(p_assignee,'requests','reply','association')) THEN RAISE EXCEPTION 'Choose an active authorized request handler.' USING ERRCODE='22023'; END IF;
 END IF;
 before_value:=jsonb_build_object('priority',coalesce(c.priority,'Untriaged'),'assignee_id',c.assignee_id,'resolution',coalesce(c.resolution,''));
 IF before_value=jsonb_build_object('priority',p_priority,'assignee_id',p_assignee,'resolution',btrim(p_resolution)) THEN RETURN public.bfe_request_business_context(p_request); END IF;
 INSERT INTO public.bfe_request_business_details(request_id,priority,assignee_id,resolution)
 VALUES(p_request,p_priority,p_assignee,btrim(p_resolution)) ON CONFLICT(request_id) DO UPDATE
 SET priority=EXCLUDED.priority,assignee_id=EXCLUDED.assignee_id,resolution=EXCLUDED.resolution,version=bfe_request_business_details.version+1,updated_at=now();
 UPDATE public.bfe_requests SET version=version+1,updated_at=now() WHERE id=p_request;
 INSERT INTO public.bfe_request_handling_audit(request_id,actor_id,reference,before_values,after_values)
 VALUES(p_request,auth.uid(),btrim(p_reference),before_value,jsonb_build_object('priority',p_priority,'assignee_id',p_assignee,'resolution',btrim(p_resolution)));
 IF p_assignee IS NOT NULL AND p_assignee IS DISTINCT FROM c.assignee_id THEN
  INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
  VALUES(p_assignee,'request','Request assigned','Open Helpdesk to review your assigned request.',CASE WHEN 'board'=ANY(public.bfe_roles_for(p_assignee)) THEN '/board/requests' WHEN public.bfe_roles_for(p_assignee) && ARRAY['admin','developer']::text[] THEN '/office/requests' ELSE '/services/team-requests' END,'handling:'||p_request||':'||(r.version+1));
 END IF;
 RETURN public.bfe_request_business_context(p_request);
END;$$;
CREATE OR REPLACE FUNCTION public.bfe_request_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.bfe_requests; target uuid; v_title text;
BEGIN
 SELECT * INTO v FROM public.bfe_requests WHERE id=NEW.request_id;
 v_title:=CASE NEW.action WHEN 'Created' THEN 'Request received' WHEN 'Replied' THEN 'New reply to your request' ELSE 'Your request status changed' END;
 IF NEW.action='Created' OR NEW.actor_id<>v.owner_id THEN
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 VALUES(v.owner_id,'request',v_title,left(v.title,120),'/services/requests','request-audit:'||NEW.id::text)
 ON CONFLICT(recipient_id,event_key) DO NOTHING;
 END IF;
 IF NEW.actor_id=v.owner_id THEN
 FOR target IN SELECT DISTINCT m.user_id FROM public.members m WHERE m.user_id IS NOT NULL AND m.user_id<>NEW.actor_id

 AND public.bfe_can_for(m.user_id,'requests','view','association')
 AND public.bfe_request_category_allowed_for(m.user_id,v.category) LOOP
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 VALUES(target,'request',CASE WHEN NEW.action='Created' THEN 'New resident request' ELSE 'Resident replied' END,
 'Open the request desk to review the activity.',CASE WHEN 'board'=ANY(public.bfe_roles_for(target)) AND NOT ('admin'=ANY(public.bfe_roles_for(target))) THEN '/board/requests' WHEN NOT (public.bfe_roles_for(target) && ARRAY['admin','developer']::text[]) THEN '/services/team-requests' ELSE '/office/requests' END,'request-audit:'||NEW.id::text)
 ON CONFLICT(recipient_id,event_key) DO NOTHING;
 END LOOP;
 END IF;
 RETURN NULL;
END;
$$;
CREATE OR REPLACE FUNCTION public.bfe_reply_request(p_request_id uuid, p_client_id uuid, p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.bfe_requests; m public.bfe_request_messages;
  v_uid uuid := auth.uid(); v_roles text[] := public.bfe_current_roles();
BEGIN
  IF NOT public.bfe_request_access(p_request_id) OR NOT (
    (public.bfe_can('requests','view','association') AND public.bfe_can('requests','reply','association')) OR
    (v_roles && ARRAY['homeowner','renter']::text[] AND public.bfe_can('requests','reply','own') AND EXISTS (
      SELECT 1 FROM public.bfe_requests WHERE id = p_request_id AND owner_id = v_uid
    ))
  ) THEN RAISE EXCEPTION 'You cannot reply to this request.' USING ERRCODE = '42501'; END IF;
  IF p_client_id IS NULL OR p_body IS NULL OR char_length(btrim(p_body)) NOT BETWEEN 1 AND 5000
     OR p_body !~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'Enter a reply of up to 5000 characters.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v FROM public.bfe_requests WHERE id = p_request_id FOR UPDATE;
  SELECT * INTO m FROM public.bfe_request_messages
    WHERE request_id = p_request_id AND author_id = v_uid AND client_id = p_client_id;
  IF FOUND THEN
    IF m.body <> btrim(p_body) THEN RAISE EXCEPTION 'This reply reference was already used.' USING ERRCODE = '22023'; END IF;
    RETURN to_jsonb(m);
  END IF;
  IF v.status = 'Resolved' THEN RAISE EXCEPTION 'This request is resolved. The office must reopen it before another reply.'; END IF;
  IF (SELECT count(*) FROM public.bfe_request_messages WHERE request_id = p_request_id
      AND author_id = v_uid AND created_at > now() - interval '1 minute') >= 10 THEN
    RAISE EXCEPTION 'Please wait before sending another reply.';
  END IF;
  INSERT INTO public.bfe_request_messages(request_id, author_id, author_kind, client_id, body)
    VALUES(p_request_id, v_uid, CASE WHEN public.bfe_can('requests','view','association') AND public.bfe_can('requests','reply','association') THEN 'Office' ELSE 'Resident' END,
      p_client_id, btrim(p_body)) RETURNING * INTO m;
  UPDATE public.bfe_requests SET updated_at = now(), version = version + 1 WHERE id = p_request_id;
  INSERT INTO public.bfe_request_audit(request_id, actor_id, action) VALUES(p_request_id, v_uid, 'Replied');
  RETURN to_jsonb(m);
END;
$$;
-- Notify the resident after handling edits as well as replies/status changes.
CREATE FUNCTION public.bfe_excel_handling_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 SELECT owner_id,'request','Your request was updated',left(title,120),'/services/requests','request-update:'||NEW.request_id::text||':'||NEW.id::text
 FROM public.bfe_requests WHERE id=NEW.request_id
 ON CONFLICT(recipient_id,event_key) DO NOTHING;
 RETURN NULL;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_excel_handling_notification() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bfe_excel_handling_notification AFTER INSERT ON public.bfe_request_handling_audit FOR EACH ROW EXECUTE FUNCTION public.bfe_excel_handling_notification();
-- Server-owned reminder job. Owner may schedule this function; clients cannot run it.
-- Once per unanswered resident message/request after three days.
CREATE FUNCTION public.bfe_send_helpdesk_followups() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record; sent integer:=0;
BEGIN
 FOR r IN SELECT pending.* FROM (
 SELECT x.*,coalesce((SELECT max(m.created_at) FROM public.bfe_request_messages m WHERE m.request_id=x.id AND m.author_kind='Resident'),x.created_at) AS awaiting_since FROM public.bfe_requests x
 WHERE x.status<>'Resolved'
 ) pending WHERE awaiting_since<=now()-interval '3 days'
 AND NOT EXISTS(SELECT 1 FROM public.bfe_request_messages m WHERE m.request_id=pending.id AND m.author_kind='Office' AND m.created_at>=pending.awaiting_since)
 AND NOT EXISTS(SELECT 1 FROM public.bfe_request_handling_audit h WHERE h.request_id=pending.id AND h.at>=pending.awaiting_since)
 LOOP
  INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
  SELECT DISTINCT m.user_id,'request','Request needs a reply',left(r.title,120),CASE WHEN 'board'=ANY(public.bfe_roles_for(m.user_id)) AND NOT ('admin'=ANY(public.bfe_roles_for(m.user_id))) THEN '/board/requests' WHEN NOT (public.bfe_roles_for(m.user_id) && ARRAY['admin','developer']::text[]) THEN '/services/team-requests' ELSE '/office/requests' END,'request-followup:'||r.id::text||':'||extract(epoch FROM r.awaiting_since)::text
  FROM public.members m WHERE public.bfe_can_for(m.user_id,'requests','reply','association')
  AND public.bfe_can_for(m.user_id,'requests','view','association') AND public.bfe_request_category_allowed_for(m.user_id,r.category)
  ON CONFLICT(recipient_id,event_key) DO NOTHING;
  sent:=sent+1;
 END LOOP;
 RETURN sent;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_send_helpdesk_followups() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
