-- Application migration 004, prepared locally; apply once AFTER 001/002/003.
-- Adds own-account preferences, private in-app notifications and audited developer
-- control of implemented operations. No real accounts are seeded or re-assigned.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE FUNCTION public.bfe_roles_for(p_user_id uuid) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT coalesce(array_agg(DISTINCT assigned.role),ARRAY[]::text[])
 FROM public.members m CROSS JOIN LATERAL unnest(array_prepend(m.role,coalesce(m.extra_roles,ARRAY[]::text[]))) assigned(role)
 WHERE m.user_id=p_user_id AND m.status='Active'
 AND assigned.role=ANY(ARRAY['admin','developer','homeowner','renter','board','security','driver']::text[])
 AND (SELECT count(*) FROM public.members d WHERE d.user_id=p_user_id)=1;
$$;
CREATE FUNCTION public.bfe_can_for(p_user_id uuid, p_module text, p_action text, p_scope text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_roles text[] := public.bfe_roles_for(p_user_id); v_base boolean := false;
BEGIN
  IF p_user_id IS NULL OR cardinality(v_roles) = 0 THEN RETURN false; END IF;
  IF NOT (p_module = ANY(ARRAY['overview','people','registrations','profiles','property','requests','messages','operations','finance','calendar','security','community','hotlines','livelihood','transport','documents','elections','reports','audit','access','profile','support','technical']::text[]))
     OR NOT (p_action = ANY(ARRAY['view','summary','create','reply','status','assign','publish','approve','export','manage','monitor']::text[]))
     OR NOT (p_scope = ANY(ARRAY['own','approved','assigned','association']::text[]))
     OR p_module IS NULL OR p_action IS NULL OR p_scope IS NULL THEN RETURN false; END IF;
  IF 'developer' = ANY(v_roles) THEN RETURN true; END IF;
  -- Technical oversight is never inherited from admin, committees or All Access.
  IF p_module = 'technical' THEN
    RETURN p_action = 'monitor' AND p_scope = 'association' AND 'developer' = ANY(v_roles);
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bfe_access_assignments a JOIN public.bfe_access_grants g ON g.assignment_id=a.id
    WHERE a.user_id=p_user_id AND a.revoked_at IS NULL AND a.starts_at <= now()
      AND (a.expires_at IS NULL OR a.expires_at > now())
      AND g.module=p_module AND g.action=p_action AND g.scope=p_scope AND g.effect='deny'
  ) THEN RETURN false; END IF;
  v_base :=
    (p_module IN ('profile','support') AND p_action IN ('view','create') AND p_scope='own')
    OR (p_module IN ('community','hotlines') AND p_action='view' AND p_scope='approved')
    OR (v_roles && ARRAY['homeowner','renter']::text[] AND p_module='requests'
        AND p_action IN ('view','create','reply') AND p_scope='own')
    OR (v_roles && ARRAY['homeowner','renter']::text[] AND p_module='calendar'
        AND p_action IN ('view','create') AND p_scope='own')
    OR ('homeowner'=ANY(v_roles) AND p_module='finance' AND p_action='view' AND p_scope='own')
    OR ('homeowner'=ANY(v_roles) AND p_module='livelihood' AND p_action IN ('view','create') AND p_scope='own');
  RETURN v_base OR EXISTS (
    SELECT 1 FROM public.bfe_access_assignments a JOIN public.bfe_access_grants g ON g.assignment_id=a.id
    WHERE a.user_id=p_user_id AND a.revoked_at IS NULL AND a.starts_at <= now()
      AND (a.expires_at IS NULL OR a.expires_at > now())
      AND g.module=p_module AND g.action=p_action AND g.scope=p_scope AND g.effect='allow'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.bfe_can(p_module text,p_action text,p_scope text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT public.bfe_can_for(auth.uid(),p_module,p_action,p_scope);
$$;
REVOKE ALL ON FUNCTION public.bfe_roles_for(uuid), public.bfe_can_for(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.bfe_my_access() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH candidates AS (
    SELECT m AS module,a AS action,s AS scope
    FROM unnest(ARRAY['profile','support','community','hotlines','requests','calendar','finance','livelihood','technical']::text[]) m
    CROSS JOIN unnest(ARRAY['view','create','reply','monitor']::text[]) a
    CROSS JOIN unnest(ARRAY['own','approved','association']::text[]) s
    UNION
    SELECT g.module,g.action,g.scope
    FROM public.bfe_access_grants g JOIN public.bfe_access_assignments a ON a.id=g.assignment_id
    WHERE a.user_id=auth.uid()
  )
  SELECT jsonb_build_object('version',1,'developer_control','developer'=ANY(public.bfe_current_roles()),'capabilities',coalesce((
    SELECT jsonb_agg(jsonb_build_object('module',module,'action',action,'scope',scope) ORDER BY module,action,scope)
    FROM candidates WHERE NOT ('developer'=ANY(public.bfe_current_roles())) AND public.bfe_can(module,action,scope)
  ),'[]'::jsonb),'committees',coalesce((
    SELECT jsonb_agg(a.committee_id ORDER BY a.committee_id) FROM public.bfe_access_assignments a
    WHERE a.user_id=auth.uid() AND a.revoked_at IS NULL AND a.starts_at<=now()
      AND (a.expires_at IS NULL OR a.expires_at>now()) AND cardinality(public.bfe_current_roles())>0
  ),'[]'::jsonb));
$$;
CREATE OR REPLACE FUNCTION public.bfe_request_access(p_request_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT cardinality(public.bfe_current_roles())>0 AND EXISTS (
    SELECT 1 FROM public.bfe_requests r WHERE r.id=p_request_id AND (
      (r.owner_id=auth.uid() AND public.bfe_can('requests','view','own'))
      OR (public.bfe_current_roles() && ARRAY['admin','developer']::text[] AND public.bfe_can('requests','view','association'))
      OR 'developer'=ANY(public.bfe_current_roles())
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.bfe_create_request(p_client_id uuid, p_title text, p_description text, p_category text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.bfe_requests; v_roles text[] := public.bfe_current_roles(); v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (v_roles && ARRAY['homeowner','renter']::text[]) OR NOT public.bfe_can('requests','create','own') THEN
    RAISE EXCEPTION 'An active resident membership is required.' USING ERRCODE = '42501';
  END IF;
  IF p_client_id IS NULL OR p_title IS NULL OR p_description IS NULL OR p_category IS NULL
     OR char_length(btrim(p_title)) NOT BETWEEN 3 AND 120
     OR char_length(btrim(p_description)) NOT BETWEEN 10 AND 5000
     OR p_title !~ '[^[:space:]]' OR p_description !~ '[^[:space:]]'
     OR p_category NOT IN ('Maintenance','Concern','Complaint','Document','Support') THEN
    RAISE EXCEPTION 'Check the request title, details and category.' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  SELECT * INTO v FROM public.bfe_requests WHERE owner_id = v_uid AND client_id = p_client_id;
  IF FOUND THEN
    IF v.title <> btrim(p_title) OR v.description <> btrim(p_description) OR v.category <> p_category THEN
      RAISE EXCEPTION 'This submission reference was already used for different details.' USING ERRCODE = '22023';
    END IF;
    RETURN to_jsonb(v);
  END IF;
  IF (SELECT count(*) FROM public.bfe_requests WHERE owner_id = v_uid AND created_at > now() - interval '1 minute') >= 5 THEN
    RAISE EXCEPTION 'Please wait before submitting another request.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.bfe_requests(owner_id, client_id, title, description, category, unit_snapshot)
    VALUES(v_uid, p_client_id, btrim(p_title), btrim(p_description), p_category,
      (SELECT m.unit FROM public.members m WHERE m.user_id = v_uid)) RETURNING * INTO v;
  INSERT INTO public.bfe_request_audit(request_id, actor_id, action, new_status)
    VALUES(v.id, v_uid, 'Created', v.status);
  RETURN to_jsonb(v);
END;
$$;

CREATE OR REPLACE FUNCTION public.bfe_reply_request(p_request_id uuid, p_client_id uuid, p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.bfe_requests; m public.bfe_request_messages;
  v_uid uuid := auth.uid(); v_roles text[] := public.bfe_current_roles();
BEGIN
  IF NOT public.bfe_request_access(p_request_id) OR NOT (
    (v_roles && ARRAY['admin','developer']::text[] AND public.bfe_can('requests','view','association') AND public.bfe_can('requests','reply','association')) OR
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
    VALUES(p_request_id, v_uid, CASE WHEN v_roles && ARRAY['admin','developer']::text[] AND public.bfe_can('requests','view','association') AND public.bfe_can('requests','reply','association') THEN 'Office' ELSE 'Resident' END,
      p_client_id, btrim(p_body)) RETURNING * INTO m;
  UPDATE public.bfe_requests SET updated_at = now(), version = version + 1 WHERE id = p_request_id;
  INSERT INTO public.bfe_request_audit(request_id, actor_id, action) VALUES(p_request_id, v_uid, 'Replied');
  RETURN to_jsonb(m);
END;
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

CREATE TABLE public.bfe_profiles (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 display_name text NOT NULL DEFAULT '' CHECK(char_length(btrim(display_name))<=80),
 phone text NOT NULL DEFAULT '' CHECK(char_length(phone)<=30 AND phone ~ '^[+0-9 () .-]*$'),
 bio text NOT NULL DEFAULT '' CHECK(char_length(bio)<=240),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.bfe_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 recipient_id uuid NOT NULL REFERENCES auth.users(id),
 kind text NOT NULL CHECK(kind IN ('request','account','access','community')),
 title text NOT NULL CHECK(char_length(title) BETWEEN 1 AND 120),
 body text NOT NULL CHECK(char_length(body)<=1000),
 path text NOT NULL CHECK(path IN ('/services/requests','/office/requests','/more/profile','/developer/access','/more/notifications')),
 event_key text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 UNIQUE(recipient_id,event_key)
);
CREATE INDEX bfe_notifications_recipient_created ON public.bfe_notifications(recipient_id,created_at DESC,id);
CREATE INDEX bfe_notifications_unread ON public.bfe_notifications(recipient_id) WHERE read_at IS NULL;
CREATE TABLE public.bfe_account_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid NOT NULL, target_id uuid NOT NULL, action text NOT NULL, details jsonb NOT NULL DEFAULT '{}'::jsonb, at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bfe_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_account_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY bfe_profile_own_read ON public.bfe_profiles FOR SELECT TO authenticated
 USING(user_id=auth.uid() AND cardinality(public.bfe_current_roles())>0);
CREATE POLICY bfe_notification_own_read ON public.bfe_notifications FOR SELECT TO authenticated
 USING(recipient_id=auth.uid() AND cardinality(public.bfe_current_roles())>0);
REVOKE ALL ON public.bfe_profiles,public.bfe_notifications,public.bfe_account_audit FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.bfe_profiles,public.bfe_notifications TO authenticated;
REVOKE ALL ON SEQUENCE public.bfe_account_audit_id_seq FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_get_profile() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.bfe_profiles;
BEGIN
 IF cardinality(public.bfe_current_roles())=0 THEN RAISE EXCEPTION 'Active membership required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO v FROM public.bfe_profiles WHERE user_id=auth.uid();
 RETURN jsonb_build_object('display_name',coalesce(v.display_name,''),'phone',coalesce(v.phone,''),'bio',coalesce(v.bio,''),'updated_at',v.updated_at);
END;
$$;
CREATE FUNCTION public.bfe_save_profile(p_display_name text,p_phone text,p_bio text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_existing public.bfe_profiles;
BEGIN
 IF NOT public.bfe_can('profile','create','own') THEN RAISE EXCEPTION 'Profile access required.' USING ERRCODE='42501'; END IF;
 IF p_display_name IS NULL OR p_phone IS NULL OR p_bio IS NULL OR char_length(btrim(p_display_name))>80
 OR char_length(btrim(p_phone))>30 OR p_phone !~ '^[+0-9 () .-]*$' OR char_length(btrim(p_bio))>240 THEN
 RAISE EXCEPTION 'Check profile fields.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('profile:'||auth.uid()::text,0));
 SELECT * INTO v_existing FROM public.bfe_profiles WHERE user_id=auth.uid();
 IF FOUND AND v_existing.display_name=btrim(p_display_name) AND v_existing.phone=btrim(p_phone) AND v_existing.bio=btrim(p_bio) THEN RETURN public.bfe_get_profile();END IF;
 INSERT INTO public.bfe_profiles(user_id,display_name,phone,bio) VALUES(auth.uid(),btrim(p_display_name),btrim(p_phone),btrim(p_bio))
 ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,phone=excluded.phone,bio=excluded.bio,updated_at=now();
 INSERT INTO public.bfe_account_audit(actor_id,target_id,action) VALUES(auth.uid(),auth.uid(),'Profile preferences updated');
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 VALUES(auth.uid(),'account','Profile updated','Your profile preferences were saved.','/more/profile','profile:'||gen_random_uuid()::text);
 RETURN public.bfe_get_profile();
END;
$$;
CREATE FUNCTION public.bfe_my_notifications(p_page integer DEFAULT 0,p_unread_only boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rows jsonb;v_total bigint;v_unread bigint;
BEGIN
 IF cardinality(public.bfe_current_roles())=0 THEN RAISE EXCEPTION 'Active membership required.' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page<0 OR p_page>10000 OR p_unread_only IS NULL THEN RAISE EXCEPTION 'Unsupported page.' USING ERRCODE='22023'; END IF;
 SELECT count(*),count(*) FILTER(WHERE read_at IS NULL) INTO v_total,v_unread FROM public.bfe_notifications WHERE recipient_id=auth.uid();
 SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC,n.id DESC),'[]'::jsonb) INTO v_rows FROM (
 SELECT id,kind,title,body,path,created_at,read_at FROM public.bfe_notifications
 WHERE recipient_id=auth.uid() AND (NOT p_unread_only OR read_at IS NULL)
 ORDER BY created_at DESC,id DESC OFFSET p_page*20 LIMIT 20) n;
 RETURN jsonb_build_object('rows',v_rows,'total',CASE WHEN p_unread_only THEN v_unread ELSE v_total END,'unread',v_unread);
END;
$$;
CREATE FUNCTION public.bfe_mark_notifications(p_ids uuid[] DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF cardinality(public.bfe_current_roles())=0 THEN RAISE EXCEPTION 'Active membership required.' USING ERRCODE='42501'; END IF;
 IF cardinality(p_ids)>100 THEN RAISE EXCEPTION 'Too many records.' USING ERRCODE='22023'; END IF;
 UPDATE public.bfe_notifications SET read_at=now() WHERE recipient_id=auth.uid() AND read_at IS NULL AND (p_ids IS NULL OR id=ANY(p_ids));
END;
$$;
-- Notifications originate from protected, server-owned request audit events.
CREATE FUNCTION public.bfe_request_notification() RETURNS trigger
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
 AND public.bfe_can_for(m.user_id,'requests','view','association') LOOP
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 VALUES(target,'request',CASE WHEN NEW.action='Created' THEN 'New resident request' ELSE 'Resident replied' END,
 'Open the request desk to review the activity.','/office/requests','request-audit:'||NEW.id::text)
 ON CONFLICT(recipient_id,event_key) DO NOTHING;
 END LOOP;
 END IF;
 RETURN NULL;
END;
$$;
CREATE TRIGGER bfe_request_notification AFTER INSERT ON public.bfe_request_audit FOR EACH ROW EXECUTE FUNCTION public.bfe_request_notification();

-- Developer provisioning is an explicit validated operation, not an SQL console.
CREATE FUNCTION public.bfe_access_members(p_search text DEFAULT '',p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rows jsonb; v_total bigint;
BEGIN
 IF NOT ('developer'=ANY(public.bfe_current_roles())) THEN RAISE EXCEPTION 'Developer control required.' USING ERRCODE='42501'; END IF;
 IF p_search IS NULL OR char_length(p_search)>100 OR p_page IS NULL OR p_page<0 OR p_page>10000 THEN RAISE EXCEPTION 'Invalid search.' USING ERRCODE='22023';END IF;
 SELECT count(*) INTO v_total FROM public.members WHERE user_id IS NOT NULL AND (SELECT count(*) FROM public.members d WHERE d.user_id=members.user_id)=1 AND (position(lower(p_search) in lower(coalesce(name,'')||' '||coalesce(unit,'')))>0);
 SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.name,m.user_id),'[]'::jsonb) INTO v_rows FROM (
 SELECT user_id,name,unit,role,extra_roles,status FROM public.members WHERE user_id IS NOT NULL AND (SELECT count(*) FROM public.members d WHERE d.user_id=members.user_id)=1
 AND position(lower(p_search) in lower(coalesce(name,'')||' '||coalesce(unit,'')))>0 ORDER BY name,user_id OFFSET p_page*20 LIMIT 20) m;
 RETURN jsonb_build_object('rows',v_rows,'total',v_total);
END;
$$;
CREATE FUNCTION public.bfe_provision_access(p_user_id uuid,p_committee text,p_module text,p_action text,p_scope text,p_effect text,p_reference text,p_expires timestamptz DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.bfe_access_assignments; v_grant uuid;
BEGIN
 IF NOT ('developer'=ANY(public.bfe_current_roles())) THEN RAISE EXCEPTION 'Developer control required.' USING ERRCODE='42501'; END IF;
 IF cardinality(public.bfe_roles_for(p_user_id))=0 OR p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200
 OR (p_expires IS NOT NULL AND p_expires<=now()) THEN RAISE EXCEPTION 'Check the active account, approval and expiry.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text||coalesce(p_committee,''),0));
 SELECT * INTO v FROM public.bfe_access_assignments WHERE user_id=p_user_id AND committee_id=p_committee FOR UPDATE;
 IF FOUND THEN
 IF v.revoked_at IS NOT NULL OR v.starts_at>now() OR v.expires_at<=now() THEN RAISE EXCEPTION 'This assignment is inactive. Ask the owner to review reactivation; old grants are not silently restored.' USING ERRCODE='22023'; END IF;
 IF p_expires IS NOT NULL AND p_expires IS DISTINCT FROM v.expires_at THEN RAISE EXCEPTION 'Existing assignment expiry applies to all its grants. Review expiry separately.' USING ERRCODE='22023'; END IF;
 ELSE
 INSERT INTO public.bfe_access_assignments(user_id,committee_id,approval_reference,expires_at) VALUES(p_user_id,p_committee,btrim(p_reference),p_expires) RETURNING * INTO v;
 END IF;
 INSERT INTO public.bfe_access_grants(assignment_id,module,action,scope,effect,approval_reference)
 VALUES(v.id,p_module,p_action,p_scope,p_effect,btrim(p_reference))
 ON CONFLICT(assignment_id,module,action,scope) DO UPDATE SET effect=excluded.effect,approval_reference=excluded.approval_reference WHERE bfe_access_grants.effect IS DISTINCT FROM excluded.effect OR bfe_access_grants.approval_reference IS DISTINCT FROM excluded.approval_reference RETURNING id INTO v_grant;
 IF v_grant IS NULL THEN SELECT id INTO v_grant FROM public.bfe_access_grants WHERE assignment_id=v.id AND module=p_module AND action=p_action AND scope=p_scope;RETURN v_grant;END IF;
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 VALUES(p_user_id,'access','Your access was updated','Your committee permissions changed. Refresh your workspace.','/more/profile','access:'||gen_random_uuid()::text);
 RETURN v_grant;
END;
$$;
CREATE FUNCTION public.bfe_revoke_assignment(p_assignment_id uuid,p_reference text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid;
BEGIN
 IF NOT ('developer'=ANY(public.bfe_current_roles())) THEN RAISE EXCEPTION 'Developer control required.' USING ERRCODE='42501';END IF;
 IF p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Approval reference required.' USING ERRCODE='22023';END IF;
 UPDATE public.bfe_access_assignments SET revoked_at=coalesce(revoked_at,now()),approval_reference=btrim(p_reference) WHERE id=p_assignment_id RETURNING user_id INTO v_uid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assignment unavailable.' USING ERRCODE='22023';END IF;
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 VALUES(v_uid,'access','Committee access revoked','An assignment was revoked. Refresh your workspace.','/more/profile','revoke:'||gen_random_uuid()::text);
END;
$$;
REVOKE ALL ON FUNCTION public.bfe_get_profile(),public.bfe_save_profile(text,text,text),public.bfe_my_notifications(integer,boolean),public.bfe_mark_notifications(uuid[]),public.bfe_access_members(text,integer),public.bfe_provision_access(uuid,text,text,text,text,text,text,timestamptz),public.bfe_revoke_assignment(uuid,text),public.bfe_request_notification() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_get_profile(),public.bfe_save_profile(text,text,text),public.bfe_my_notifications(integer,boolean),public.bfe_mark_notifications(uuid[]),public.bfe_access_members(text,integer),public.bfe_provision_access(uuid,text,text,text,text,text,text,timestamptz),public.bfe_revoke_assignment(uuid,text) TO authenticated;
CREATE FUNCTION public.bfe_get_member() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;v_count bigint;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign-in required.' USING ERRCODE='42501';END IF;
 SELECT count(*) INTO v_count FROM public.members WHERE user_id=auth.uid();
 IF v_count>1 THEN RAISE EXCEPTION 'Membership needs review.' USING ERRCODE='42501';END IF;
 SELECT jsonb_build_object('id',id,'user_id',user_id,'name',name,'unit',unit,'role',role,'extra_roles',extra_roles,'status',status,'title',title,'phone',phone)
 INTO v FROM public.members WHERE user_id=auth.uid();
 RETURN v;
END;
$$;
CREATE FUNCTION public.bfe_staff_directory(p_kind text,p_page integer,p_search text,p_field text,p_status text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rows jsonb;v_total bigint;v_module text;
BEGIN
 v_module:=CASE p_kind WHEN 'members' THEN 'people' WHEN 'registrations' THEN 'registrations' END;
 IF v_module IS NULL OR NOT(public.bfe_current_roles() && ARRAY['admin','developer']::text[]) OR NOT public.bfe_can(v_module,'view','association') THEN RAISE EXCEPTION 'Office access required.' USING ERRCODE='42501';END IF;
 IF p_page IS NULL OR p_page<0 OR p_page>10000 OR p_search IS NULL OR char_length(p_search)>100 OR p_status IS NULL OR char_length(p_status)>100 OR p_field IS NULL OR p_field NOT IN ('name','email','unit') THEN RAISE EXCEPTION 'Invalid filter.' USING ERRCODE='22023';END IF;
 IF p_kind='members' THEN
 SELECT count(*) INTO v_total FROM public.members WHERE (p_status='' OR status=p_status) AND position(lower(p_search) in lower(coalesce(CASE p_field WHEN 'name' THEN name WHEN 'email' THEN email ELSE unit END,'')))>0;
 SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.name,m.id),'[]'::jsonb) INTO v_rows FROM (
 SELECT id,user_id,name,email,phone,unit,title,role,extra_roles,status,last_seen FROM public.members
 WHERE (p_status='' OR status=p_status) AND position(lower(p_search) in lower(coalesce(CASE p_field WHEN 'name' THEN name WHEN 'email' THEN email ELSE unit END,'')))>0
 ORDER BY name,id OFFSET p_page*20 LIMIT 20) m;
 ELSE
 SELECT count(*) INTO v_total FROM public.registrations WHERE (p_status='' OR status=p_status) AND position(lower(p_search) in lower(coalesce(CASE p_field WHEN 'name' THEN name WHEN 'email' THEN email ELSE unit END,'')))>0;
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC,r.id),'[]'::jsonb) INTO v_rows FROM (
 SELECT id,name,email,phone,unit,role,status,created_at,review_note FROM public.registrations
 WHERE (p_status='' OR status=p_status) AND position(lower(p_search) in lower(coalesce(CASE p_field WHEN 'name' THEN name WHEN 'email' THEN email ELSE unit END,'')))>0
 ORDER BY created_at DESC,id OFFSET p_page*20 LIMIT 20) r;
 END IF;
 RETURN jsonb_build_object('rows',v_rows,'total',v_total);
END;
$$;
REVOKE ALL ON FUNCTION public.bfe_get_member(),public.bfe_staff_directory(text,integer,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_get_member(),public.bfe_staff_directory(text,integer,text,text,text) TO authenticated;


CREATE FUNCTION public.bfe_update_member_access(p_user_id uuid,p_role text,p_extra text[],p_status text,p_reference text,p_expected jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_roles text[]; v_old jsonb; v_after jsonb; v_setting text; v_developer_count bigint;
BEGIN
 IF NOT ('developer'=ANY(public.bfe_current_roles())) THEN RAISE EXCEPTION 'Developer control required.' USING ERRCODE='42501';END IF;
 IF p_user_id IS NULL OR p_role IS NULL OR p_role NOT IN ('admin','homeowner','renter','board','security','driver')
 OR p_extra IS NULL OR cardinality(p_extra)>7 OR array_position(p_extra,NULL) IS NOT NULL
 OR NOT(p_extra <@ ARRAY['admin','homeowner','renter','board','security','driver','developer']::text[])
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
 INSERT INTO public.bfe_account_audit(actor_id,target_id,action,details) VALUES(auth.uid(),p_user_id,'Member access updated',jsonb_build_object('before',v_old,'after',v_after,'reference',btrim(p_reference)));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(p_user_id,'access','Account access changed','Your account roles or status changed. Sign in again to review access.','/more/profile','member-access:'||gen_random_uuid()::text);
END;
$$;
REVOKE ALL ON FUNCTION public.bfe_update_member_access(uuid,text,text[],text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_update_member_access(uuid,text,text[],text,text,jsonb) TO authenticated;

CREATE FUNCTION public.bfe_member_assignments(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;
BEGIN
 IF NOT ('developer'=ANY(public.bfe_current_roles())) THEN RAISE EXCEPTION 'Developer control required.' USING ERRCODE='42501';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'committee_id',a.committee_id,'expires_at',a.expires_at,'revoked_at',a.revoked_at,'grants',(SELECT count(*) FROM public.bfe_access_grants g WHERE g.assignment_id=a.id)) ORDER BY a.committee_id),'[]'::jsonb) INTO v
 FROM public.bfe_access_assignments a WHERE a.user_id=p_user_id;
 RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.bfe_member_assignments(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_member_assignments(uuid) TO authenticated;


-- Existing legacy admin policies must not let an admin self-assign developer.
-- This additive guard preserves other legacy policies and registration guards.
CREATE FUNCTION public.bfe_guard_developer_members() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_old boolean:=false;v_new boolean:=false;v_count bigint;
BEGIN
 IF auth.uid() IS NULL THEN
 IF coalesce(current_setting('role',true),'none') IN ('anon','authenticated') THEN RAISE EXCEPTION 'Verified member identity required.' USING ERRCODE='42501'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
 END IF;
 IF TG_OP<>'INSERT' THEN v_old:=coalesce(OLD.role='developer' OR 'developer'=ANY(coalesce(OLD.extra_roles,ARRAY[]::text[])) OR 'developer'=ANY(public.bfe_roles_for(OLD.user_id)),false);END IF;
 IF TG_OP<>'DELETE' THEN v_new:=coalesce(NEW.role='developer' OR 'developer'=ANY(coalesce(NEW.extra_roles,ARRAY[]::text[])) OR 'developer'=ANY(public.bfe_roles_for(NEW.user_id)),false);END IF;
 IF v_old OR v_new THEN
 IF NOT('developer'=ANY(public.bfe_current_roles())) THEN RAISE EXCEPTION 'Only a developer may change a developer account.' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('bfe-developer-role-changes',0));
 IF TG_OP<>'INSERT' AND OLD.status='Active' AND ('developer'=ANY(public.bfe_roles_for(OLD.user_id))) THEN
 IF TG_OP='DELETE' OR NEW.status<>'Active' OR NOT(coalesce(NEW.role='developer',false) OR 'developer'=ANY(coalesce(NEW.extra_roles,ARRAY[]::text[]))) OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
 SELECT count(DISTINCT m.user_id) INTO v_count FROM public.members m WHERE 'developer'=ANY(public.bfe_roles_for(m.user_id));
 IF v_count<=1 THEN RAISE EXCEPTION 'Keep at least one active developer account.' USING ERRCODE='22023';END IF;
 END IF;END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.bfe_guard_developer_members() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bfe_guard_developer_members BEFORE INSERT OR UPDATE OR DELETE ON public.members FOR EACH ROW EXECUTE FUNCTION public.bfe_guard_developer_members();

NOTIFY pgrst,'reload schema';
COMMIT;
