-- Owner-run after 094. Owner request, 24 November 2026: Finance, Grievance and
-- Maintenance become member roles (selectable as a main or additional role),
-- not only access committees.
--  * The roles are office roles: on the server they include the office admin
--    role, so the existing office checks apply, but they do not inherit rules
--    written for "all office admins". Each role gets its own area by default
--    (editable later in access settings): Finance -> finance (edit);
--    Grievance and Maintenance -> Help desk (edit).
--  * Grievance and Maintenance roles handle only their Help desk categories,
--    as the 094 committees do (Complaint, Concern and Idea; Maintenance).
--  * Access managers can assign the roles and filter members by them.
-- bfe_update_member_access (014) and bfe_filtered_access_members (040) are
-- copied unchanged apart from the accepted role lists.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';

-- Roles exactly as recorded on the member, without implied roles.
CREATE OR REPLACE FUNCTION public.bfe_assigned_roles_for(p_user_id uuid) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(array_agg(DISTINCT assigned.role),ARRAY[]::text[])
 FROM public.members m CROSS JOIN LATERAL unnest(array_prepend(m.role,coalesce(m.extra_roles,ARRAY[]::text[]))) assigned(role)
 WHERE m.user_id=p_user_id AND m.status='Active'
 AND assigned.role=ANY(ARRAY['admin','developer','homeowner','renter','board','security','driver','finance','grievance','maintenance']::text[])
 AND (SELECT count(*) FROM public.members d WHERE d.user_id=p_user_id)=1;
$$;
REVOKE ALL ON FUNCTION public.bfe_assigned_roles_for(uuid) FROM PUBLIC,anon,authenticated;

-- Office roles include the office admin role for the existing office checks.
CREATE OR REPLACE FUNCTION public.bfe_roles_for(p_user_id uuid) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN r && ARRAY['finance','grievance','maintenance']::text[] AND NOT ('admin'=ANY(r))
  THEN array_append(r,'admin') ELSE r END
 FROM (SELECT public.bfe_assigned_roles_for(p_user_id) AS r) x;
$$;
CREATE OR REPLACE FUNCTION public.bfe_current_roles() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.bfe_roles_for(auth.uid());
$$;

-- Role rules follow the recorded roles, so rules written for all office
-- admins do not widen a Finance, Grievance or Maintenance role.
CREATE OR REPLACE FUNCTION public.bfe_tab_mode_for(p_user_id uuid,p_module text,p_scope text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE roles text[]:=public.bfe_roles_for(p_user_id);held text[]:=public.bfe_assigned_roles_for(p_user_id);chosen text;
BEGIN
 IF cardinality(roles)=0 OR 'developer'=ANY(roles) THEN RETURN NULL;END IF;
 SELECT mode INTO chosen FROM public.bfe_tab_rules WHERE subject_kind='user' AND subject_id=p_user_id::text AND module=p_module AND scope=p_scope;
 IF chosen IS NULL THEN
  SELECT CASE WHEN count(*)=0 THEN NULL WHEN bool_or(t.mode='hidden') THEN 'hidden' WHEN bool_or(t.mode='edit') THEN 'edit' ELSE 'view' END INTO chosen
  FROM public.bfe_tab_rules t WHERE t.module=p_module AND t.scope=p_scope AND (
   (t.subject_kind='role' AND t.subject_id=ANY(held)) OR
   (t.subject_kind='committee' AND EXISTS(SELECT 1 FROM public.bfe_access_assignments a WHERE a.user_id=p_user_id AND a.committee_id=t.subject_id AND a.revoked_at IS NULL AND a.starts_at<=now() AND (a.expires_at IS NULL OR a.expires_at>now()))));
 END IF;
 RETURN chosen;
END;$$;

INSERT INTO public.bfe_tab_rules(subject_kind,subject_id,module,scope,mode) VALUES
 ('role','finance','finance','association','edit'),
 ('role','grievance','requests','association','edit'),
 ('role','maintenance','requests','association','edit')
ON CONFLICT(subject_kind,subject_id,module,scope) DO NOTHING;

-- 094's category limit, now also for the Grievance and Maintenance roles.
CREATE OR REPLACE FUNCTION public.bfe_request_category_allowed_for(p_user uuid,p_category text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH active AS (
  SELECT a.id,a.committee_id FROM public.bfe_access_assignments a
  WHERE a.user_id=p_user AND a.revoked_at IS NULL AND a.starts_at<=now() AND (a.expires_at IS NULL OR a.expires_at>now())
 ), limits AS (
  SELECT committee_id AS area FROM active WHERE committee_id IN ('grievance','maintenance')
  UNION SELECT r FROM unnest(public.bfe_assigned_roles_for(p_user)) r WHERE r IN ('grievance','maintenance')
 )
 SELECT p_user IS NOT NULL AND (
  NOT EXISTS(SELECT 1 FROM limits)
  OR 'developer'=ANY(public.bfe_roles_for(p_user))
  OR EXISTS(SELECT 1 FROM active a JOIN public.bfe_access_grants g ON g.assignment_id=a.id
   WHERE a.committee_id NOT IN ('grievance','maintenance') AND g.module='requests' AND g.action='view'
    AND g.scope='association' AND g.effect='allow')
  OR EXISTS(SELECT 1 FROM public.bfe_tab_rules t
   WHERE t.module='requests' AND t.scope='association' AND t.mode IN ('view','edit') AND (
    (t.subject_kind='user' AND t.subject_id=p_user::text)
    OR (t.subject_kind='committee' AND t.subject_id NOT IN ('grievance','maintenance')
        AND t.subject_id IN (SELECT committee_id FROM active))))
  OR EXISTS(SELECT 1 FROM limits WHERE
   (area='grievance' AND p_category IN ('Complaint','Concern','Idea'))
   OR (area='maintenance' AND p_category='Maintenance'))
 );
$$;

CREATE OR REPLACE FUNCTION public.bfe_update_member_access(p_user_id uuid,p_role text,p_extra text[],p_status text,p_reference text,p_expected jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_roles text[]; v_old jsonb; v_after jsonb; v_setting text; v_developer_count bigint;
BEGIN
 IF NOT ('developer'=ANY(public.bfe_current_roles())) AND (p_user_id=auth.uid() OR 'developer'=ANY(public.bfe_roles_for(p_user_id)) OR 'developer'=ANY(p_extra)) THEN RAISE EXCEPTION 'Only a developer may change this protected account.' USING ERRCODE='42501';END IF;
 IF NOT public.bfe_is_access_manager() THEN RAISE EXCEPTION 'Access manager required.' USING ERRCODE='42501';END IF;
 IF p_user_id IS NULL OR p_role IS NULL OR p_role NOT IN ('admin','homeowner','renter','board','security','driver','finance','grievance','maintenance')
 OR p_extra IS NULL OR cardinality(p_extra)>10 OR array_position(p_extra,NULL) IS NOT NULL
 OR NOT(p_extra <@ ARRAY['admin','homeowner','renter','board','security','driver','developer','finance','grievance','maintenance']::text[])
 OR p_status IS NULL OR p_status NOT IN ('Active','Suspended') OR p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 THEN
 RAISE EXCEPTION 'Check the role, status and approval reference.' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('bfe-developer-role-changes',0));
 IF (SELECT count(*) FROM public.members WHERE user_id=p_user_id)<>1 THEN RAISE EXCEPTION 'Exactly one linked member is required.' USING ERRCODE='22023';END IF;
 SELECT jsonb_build_object('role',role,'extra_roles',extra_roles,'status',status) INTO v_old FROM public.members WHERE user_id=p_user_id FOR UPDATE;
 IF p_expected IS NULL OR v_old IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Member access changed. Reload before saving.' USING ERRCODE='40001';END IF;
 IF v_old=jsonb_build_object('role',p_role,'extra_roles',p_extra,'status',p_status) THEN RETURN;END IF;
 SELECT array_agg(DISTINCT r ORDER BY r) INTO v_roles FROM unnest(array_prepend(p_role,p_extra)) r;
 IF 'developer'=ANY(public.bfe_roles_for(p_user_id)) AND (p_status<>'Active' OR NOT('developer'=ANY(v_roles))) THEN
 SELECT count(DISTINCT m.user_id) INTO v_developer_count FROM public.members m WHERE 'developer'=ANY(public.bfe_roles_for(m.user_id));
 IF v_developer_count<=1 THEN RAISE EXCEPTION 'Keep at least one active developer account.' USING ERRCODE='22023';END IF;
 END IF;
 v_setting:=coalesce(current_setting('app.claiming',true),'');
 PERFORM set_config('app.claiming','on',true);
 UPDATE public.members SET role=p_role,extra_roles=p_extra,status=p_status WHERE user_id=p_user_id;
 PERFORM set_config('app.claiming',v_setting,true);
 SELECT jsonb_build_object('role',role,'extra_roles',extra_roles,'status',status) INTO v_after FROM public.members WHERE user_id=p_user_id;
 IF v_after->>'role' IS DISTINCT FROM p_role OR v_after->>'status' IS DISTINCT FROM p_status OR v_after->'extra_roles' IS DISTINCT FROM to_jsonb(p_extra) THEN RAISE EXCEPTION 'The member guard did not accept the requested access change.' USING ERRCODE='42501';END IF;
 IF NOT ('developer'=ANY(public.bfe_current_roles())) AND EXISTS(
 SELECT 1 FROM unnest(ARRAY['overview','people','registrations','profiles','property','requests','messages','operations','finance','calendar','security','community','hotlines','livelihood','transport','documents','elections','reports','audit','access','technical']) m
 CROSS JOIN unnest(ARRAY['view','summary','create','reply','status','assign','publish','approve','export','manage','monitor']) a
 CROSS JOIN unnest(ARRAY['own','approved','assigned','association']) s
 WHERE public.bfe_can_for(p_user_id,m,a,s) AND NOT public.bfe_can(m,a,s)) THEN RAISE EXCEPTION 'This role change exceeds your management authority.' USING ERRCODE='42501';END IF;
 INSERT INTO public.bfe_account_audit(actor_id,target_id,action,details) VALUES(auth.uid(),p_user_id,'Member access updated',jsonb_build_object('before',v_old,'after',v_after,'reference',btrim(p_reference)));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(p_user_id,'access','Account access changed','Your account roles or status changed. Sign in again to review access.','/more/profile','member-access:'||gen_random_uuid()::text);
END;
$$;

CREATE OR REPLACE FUNCTION public.bfe_filtered_access_members(p_search text DEFAULT '',p_role text DEFAULT '',p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb; n bigint; exact boolean:=position('@' IN coalesce(p_search,''))>0;
BEGIN
 IF NOT public.bfe_is_access_manager() THEN RAISE EXCEPTION 'Access manager required.' USING ERRCODE='42501'; END IF;
 IF p_search IS NULL OR length(p_search)>(CASE WHEN exact THEN 254 ELSE 100 END) OR p_role IS NULL
 OR p_role NOT IN ('','homeowner','renter','admin','board','security','driver','developer','finance','grievance','maintenance') OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN
  RAISE EXCEPTION 'Invalid account filters.' USING ERRCODE='22023'; END IF;
 WITH visible AS MATERIALIZED (
  SELECT m.user_id,m.name,m.unit,m.role,m.extra_roles,m.status FROM public.members m
  WHERE m.user_id IS NOT NULL AND (SELECT count(*) FROM public.members d WHERE d.user_id=m.user_id)=1
  AND (p_role='' OR m.role=p_role OR p_role=ANY(coalesce(m.extra_roles,'{}'::text[])))
  AND CASE WHEN exact THEN lower(btrim(m.email))=lower(btrim(p_search))
   ELSE position(lower(p_search) IN lower(coalesce(m.name,'')||' '||coalesce(m.unit,'')))>0 END
 ), page AS (SELECT * FROM visible ORDER BY name,user_id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.name,p.user_id),'[]'::jsonb) INTO n,rows FROM page p;
 RETURN jsonb_build_object('rows',rows,'total',n,'lookup_mode',CASE WHEN exact THEN 'email_exact' ELSE 'name_unit' END);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_filtered_access_members(text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_filtered_access_members(text,text,integer) TO authenticated;
-- Document download history and approvals stay with recorded office admins:
-- the 092/093 functions below are unchanged apart from that role check.
CREATE OR REPLACE FUNCTION public.bfe_document_download_history(p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb; n bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.bfe_assigned_roles_for(auth.uid()) && ARRAY['admin','developer']::text[]) THEN
  RAISE EXCEPTION 'Download history is available to admins.' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Invalid page.' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO n FROM public.bfe_document_downloads;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'document',x.document,'downloaded_at',x.downloaded_at,'name',x.name,'unit',x.unit) ORDER BY x.downloaded_at DESC,x.id),'[]'::jsonb) INTO rows
 FROM (
  SELECT d.id,d.document,d.downloaded_at,
   coalesce((SELECT nullif(btrim(m.name),'') FROM public.members m WHERE m.user_id=d.user_id LIMIT 1),'Unknown member') AS name,
   (SELECT nullif(btrim(m.unit),'') FROM public.members m WHERE m.user_id=d.user_id LIMIT 1) AS unit
  FROM public.bfe_document_downloads d ORDER BY d.downloaded_at DESC,d.id OFFSET p_page*20 LIMIT 20
 ) x;
 RETURN jsonb_build_object('rows',rows,'total',n);
END;$$;

CREATE OR REPLACE FUNCTION public.bfe_decide_document_download(p_id uuid,p_decision text,p_note text DEFAULT '') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_document_download_requests; v_until timestamptz;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.bfe_assigned_roles_for(auth.uid()) && ARRAY['admin','developer']::text[]) THEN
  RAISE EXCEPTION 'Only admins can decide download requests.' USING ERRCODE='42501'; END IF;
 IF p_decision IS NULL OR p_decision NOT IN ('Approved','Declined') OR p_note IS NULL OR char_length(btrim(p_note))>500 THEN
  RAISE EXCEPTION 'Choose Approved or Declined, with an optional short note.' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM public.bfe_document_download_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request not found.' USING ERRCODE='22023'; END IF;
 IF r.status<>'Pending' THEN RAISE EXCEPTION 'This request was already decided.' USING ERRCODE='40001'; END IF;
 v_until:=CASE WHEN p_decision='Approved' THEN now()+interval '7 days' END;
 UPDATE public.bfe_document_download_requests
 SET status=p_decision,decided_at=now(),decided_by=auth.uid(),note=btrim(p_note),expires_at=v_until
 WHERE id=p_id;
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 VALUES(r.user_id,'community',
  CASE WHEN p_decision='Approved' THEN 'Download request approved' ELSE 'Download request declined' END,
  left(CASE WHEN p_decision='Approved'
   THEN 'You can download '||r.document||' until '||to_char(v_until AT TIME ZONE 'Asia/Manila','FMDD Mon YYYY')||'.'
   ELSE 'The HOA office declined your request to download '||r.document||'.' END
   ||coalesce(' Note: '||nullif(btrim(p_note),''),''),1000),
  '/more/documents','document-decision:'||r.id::text)
 ON CONFLICT(recipient_id,event_key) DO NOTHING;
END;$$;

CREATE OR REPLACE FUNCTION public.bfe_document_download_requests_queue(p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb; n bigint; pending bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.bfe_assigned_roles_for(auth.uid()) && ARRAY['admin','developer']::text[]) THEN
  RAISE EXCEPTION 'Download requests are available to admins.' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Invalid page.' USING ERRCODE='22023'; END IF;
 SELECT count(*),count(*) FILTER(WHERE status='Pending') INTO n,pending FROM public.bfe_document_download_requests;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'document',x.document,'status',x.status,'requested_at',x.requested_at,
   'decided_at',x.decided_at,'expires_at',x.expires_at,'note',x.note,'name',x.name,'unit',x.unit)
   ORDER BY (x.status='Pending') DESC,x.requested_at DESC,x.id),'[]'::jsonb) INTO rows
 FROM (
  SELECT q.*,
   coalesce((SELECT nullif(btrim(m.name),'') FROM public.members m WHERE m.user_id=q.user_id LIMIT 1),'Unknown member') AS name,
   (SELECT nullif(btrim(m.unit),'') FROM public.members m WHERE m.user_id=q.user_id LIMIT 1) AS unit
  FROM public.bfe_document_download_requests q
  ORDER BY (q.status='Pending') DESC,q.requested_at DESC,q.id OFFSET p_page*20 LIMIT 20
 ) x;
 RETURN jsonb_build_object('rows',rows,'total',n,'pending',pending);
END;$$;

CREATE OR REPLACE FUNCTION public.bfe_record_document_download(p_document text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rid uuid;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 THEN
  RAISE EXCEPTION 'Sign in as an active member to download documents.' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bfe_community_documents WHERE name=p_document) THEN
  RAISE EXCEPTION 'Choose a listed community document.' USING ERRCODE='22023'; END IF;
 IF NOT (public.bfe_assigned_roles_for(auth.uid()) && ARRAY['admin','developer']::text[])
  AND NOT EXISTS(SELECT 1 FROM public.bfe_document_download_requests
   WHERE user_id=auth.uid() AND document=p_document AND status='Approved' AND expires_at>now()) THEN
  RAISE EXCEPTION 'Request this document from the HOA office before downloading it.' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM public.bfe_document_downloads WHERE user_id=auth.uid() AND downloaded_at>now()-interval '1 minute')>=10 THEN
  RAISE EXCEPTION 'Please wait a moment before downloading more documents.'; END IF;
 INSERT INTO public.bfe_document_downloads(user_id,document) VALUES(auth.uid(),p_document) RETURNING id INTO rid;
 PERFORM public.bfe_notify_admins('Document downloaded',
  public.bfe_member_label(auth.uid())||' downloaded '||p_document||'.',
  'document-download:'||rid::text);
 RETURN rid;
END;$$;

NOTIFY pgrst,'reload schema';
COMMIT;
