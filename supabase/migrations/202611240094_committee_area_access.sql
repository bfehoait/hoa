-- Owner-run after 093. Owner request, 24 November 2026: Finance, Grievance and
-- Maintenance use the existing access committees, limited to their area.
--  * Default committee access rules (editable later in access settings):
--    Finance -> finance (edit); Grievance and Maintenance -> requests (edit).
--    Existing rules for the same committee and area are kept.
--  * Help desk categories: a Grievance member handles only Violation or
--    Complaint and Concern and Suggestion requests (Complaint, Concern, Idea);
--    a Maintenance member handles only Maintenance Issue requests. People not
--    on those committees, developers, and members given wider Help desk access
--    personally (individual rule or grant, or another committee's rule) are not
--    limited. Applied to request visibility (and so replies and messages),
--    status changes, request handling and new-request notifications.
-- The four Help desk functions are copied unchanged from 004 and 048 apart
-- from the category check.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';

INSERT INTO public.bfe_tab_rules(subject_kind,subject_id,module,scope,mode) VALUES
 ('committee','finance','finance','association','edit'),
 ('committee','grievance','requests','association','edit'),
 ('committee','maintenance','requests','association','edit')
ON CONFLICT(subject_kind,subject_id,module,scope) DO NOTHING;

CREATE OR REPLACE FUNCTION public.bfe_request_category_allowed_for(p_user uuid,p_category text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH active AS (
  SELECT a.id,a.committee_id FROM public.bfe_access_assignments a
  WHERE a.user_id=p_user AND a.revoked_at IS NULL AND a.starts_at<=now() AND (a.expires_at IS NULL OR a.expires_at>now())
 )
 SELECT p_user IS NOT NULL AND (
  NOT EXISTS(SELECT 1 FROM active WHERE committee_id IN ('grievance','maintenance'))
  OR 'developer'=ANY(public.bfe_roles_for(p_user))
  OR EXISTS(SELECT 1 FROM active a JOIN public.bfe_access_grants g ON g.assignment_id=a.id
   WHERE a.committee_id NOT IN ('grievance','maintenance') AND g.module='requests' AND g.action='view'
    AND g.scope='association' AND g.effect='allow')
  OR EXISTS(SELECT 1 FROM public.bfe_tab_rules t
   WHERE t.module='requests' AND t.scope='association' AND t.mode IN ('view','edit') AND (
    (t.subject_kind='user' AND t.subject_id=p_user::text)
    OR (t.subject_kind='committee' AND t.subject_id NOT IN ('grievance','maintenance')
        AND t.subject_id IN (SELECT committee_id FROM active))))
  OR EXISTS(SELECT 1 FROM active WHERE
   (committee_id='grievance' AND p_category IN ('Complaint','Concern','Idea'))
   OR (committee_id='maintenance' AND p_category='Maintenance'))
 );
$$;
REVOKE ALL ON FUNCTION public.bfe_request_category_allowed_for(uuid,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.bfe_request_access(p_request_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT cardinality(public.bfe_current_roles())>0 AND EXISTS (
    SELECT 1 FROM public.bfe_requests r WHERE r.id=p_request_id AND (
      (r.owner_id=auth.uid() AND public.bfe_can('requests','view','own'))
      OR (public.bfe_current_roles() && ARRAY['admin','developer']::text[] AND public.bfe_can('requests','view','association')
          AND public.bfe_request_category_allowed_for(auth.uid(), r.category))
      OR 'developer'=ANY(public.bfe_current_roles())
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.bfe_set_request_status(p_request_id uuid, p_expected_version integer, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.bfe_requests; v_old text;
BEGIN
  IF NOT (public.bfe_current_roles() && ARRAY['admin','developer']::text[]) OR NOT public.bfe_can('requests','view','association') OR NOT public.bfe_can('requests','status','association') THEN
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

CREATE OR REPLACE FUNCTION public.bfe_save_request_handling(p_request uuid,p_request_version integer,p_context_version integer,p_priority text,p_assignee uuid,p_resolution text,p_reference text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_requests; c public.bfe_request_business_details; before_value jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT ('admin'=ANY(public.bfe_current_roles())) OR NOT public.bfe_can('requests','view','association') OR NOT public.bfe_can('requests','status','association') THEN RAISE EXCEPTION 'Office request handling permission required.' USING ERRCODE='42501'; END IF;
 IF p_priority IS NULL OR p_priority NOT IN ('Untriaged','Low','Normal','High','Urgent') OR p_resolution IS NULL OR char_length(btrim(p_resolution))>5000 OR p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Check priority, resolution and handling reference.' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM public.bfe_requests WHERE id=p_request FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Request unavailable.' USING ERRCODE='42501'; END IF;
 IF NOT public.bfe_request_category_allowed_for(auth.uid(),r.category) THEN RAISE EXCEPTION 'This request is outside your committee''s Help desk categories.' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.bfe_request_business_details WHERE request_id=p_request FOR UPDATE;
 IF p_request_version IS NULL OR p_request_version<>r.version OR p_context_version IS NULL OR p_context_version<>coalesce(c.version,0) THEN RAISE EXCEPTION 'Request changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
 IF r.status='Resolved' THEN RAISE EXCEPTION 'Reopen the request before changing its handling.' USING ERRCODE='22023'; END IF;
 IF p_assignee IS DISTINCT FROM c.assignee_id THEN
  IF NOT public.bfe_can('requests','assign','association') THEN RAISE EXCEPTION 'Request assignment permission required.' USING ERRCODE='42501'; END IF;
  IF p_assignee IS NOT NULL AND (NOT ('admin'=ANY(public.bfe_roles_for(p_assignee))) OR NOT public.bfe_can_for(p_assignee,'requests','view','association') OR NOT public.bfe_can_for(p_assignee,'requests','reply','association')) THEN RAISE EXCEPTION 'Choose an active authorized request handler.' USING ERRCODE='22023'; END IF;
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
  VALUES(p_assignee,'request','Request assigned','Open Helpdesk to review your assigned request.','/office/requests','handling:'||p_request||':'||(r.version+1));
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
 AND public.bfe_roles_for(m.user_id) && ARRAY['admin','developer']::text[]
 AND public.bfe_can_for(m.user_id,'requests','view','association')
 AND public.bfe_request_category_allowed_for(m.user_id,v.category) LOOP
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 VALUES(target,'request',CASE WHEN NEW.action='Created' THEN 'New resident request' ELSE 'Resident replied' END,
 'Open the request desk to review the activity.','/office/requests','request-audit:'||NEW.id::text)
 ON CONFLICT(recipient_id,event_key) DO NOTHING;
 END LOOP;
 END IF;
 RETURN NULL;
END;
$$;

NOTIFY pgrst,'reload schema';
COMMIT;
