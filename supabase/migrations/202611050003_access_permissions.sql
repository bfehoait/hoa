-- Prepared locally. Review before owner installation, AFTER migrations 001/002.
-- No personal assignments, credential values, legacy policies or shared JSON are changed.
-- Workbook labels are planning evidence; no committee receives automatic actions.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE public.bfe_access_committees (
  id text PRIMARY KEY,
  label text NOT NULL
);
INSERT INTO public.bfe_access_committees VALUES
 ('finance','Finance'), ('audit_inventory','Audit & Inventory'),
 ('grievance','Grievance'), ('peace_order','Peace & Order'),
 ('maintenance','Maintenance'), ('livelihood','Livelihood'),
 ('events_education','Community Events & Education'),
 ('environment','Environment & Sustainability'), ('youth_gad','Youth, Sports & GAD'),
 ('disaster','Disaster & Risk Management'), ('election','Election'),
 ('data_governance','Data Governance');

CREATE TABLE public.bfe_access_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  committee_id text NOT NULL REFERENCES public.bfe_access_committees(id),
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  approval_reference text NOT NULL CHECK(char_length(btrim(approval_reference)) BETWEEN 3 AND 200),
  CHECK(expires_at IS NULL OR expires_at > starts_at),
  UNIQUE(user_id,committee_id)
);
CREATE TABLE public.bfe_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.bfe_access_assignments(id),
  module text NOT NULL CHECK(module IN ('overview','people','registrations','profiles','property','requests','messages','operations','finance','calendar','security','community','hotlines','livelihood','transport','documents','elections','reports','audit','access','profile','support')),
  action text NOT NULL CHECK(action IN ('view','summary','create','reply','status','assign','publish','approve','export','manage')),
  scope text NOT NULL CHECK(scope IN ('own','approved','assigned','association')),
  effect text NOT NULL CHECK(effect IN ('allow','deny')),
  approval_reference text NOT NULL CHECK(char_length(btrim(approval_reference)) BETWEEN 3 AND 200),
  UNIQUE(assignment_id,module,action,scope)
);
CREATE INDEX bfe_assignments_user ON public.bfe_access_assignments(user_id);
CREATE INDEX bfe_grants_assignment ON public.bfe_access_grants(assignment_id);

CREATE TABLE public.bfe_access_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,
  database_session text NOT NULL,
  source text NOT NULL,
  operation text NOT NULL,
  before_record jsonb,
  after_record jsonb
);
CREATE FUNCTION public.bfe_record_access_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.bfe_access_audit(actor_id,database_session,source,operation,before_record,after_record)
  VALUES(auth.uid(),session_user,TG_TABLE_NAME,TG_OP,
    CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  RETURN NULL;
END;
$$;
CREATE TRIGGER bfe_assignment_audit AFTER INSERT OR UPDATE OR DELETE ON public.bfe_access_assignments
 FOR EACH ROW EXECUTE FUNCTION public.bfe_record_access_change();
CREATE TRIGGER bfe_grant_audit AFTER INSERT OR UPDATE OR DELETE ON public.bfe_access_grants
 FOR EACH ROW EXECUTE FUNCTION public.bfe_record_access_change();

-- Planning metadata only: these labels cannot be used by bfe_can as grants.
CREATE TABLE public.bfe_access_workbook (
  committee_id text NOT NULL REFERENCES public.bfe_access_committees(id),
  module text NOT NULL,
  level text NOT NULL CHECK(level IN ('V','D','R','M','none','unresolved')),
  PRIMARY KEY(committee_id,module)
);

CREATE FUNCTION public.bfe_can(p_module text, p_action text, p_scope text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_roles text[] := public.bfe_current_roles(); v_base boolean := false;
BEGIN
  IF auth.uid() IS NULL OR cardinality(v_roles) = 0 THEN RETURN false; END IF;
  -- Technical oversight is never inherited from admin, committees or All Access.
  IF p_module = 'technical' THEN
    RETURN p_action = 'monitor' AND p_scope = 'association' AND 'developer' = ANY(v_roles);
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.bfe_access_assignments a JOIN public.bfe_access_grants g ON g.assignment_id=a.id
    WHERE a.user_id=auth.uid() AND a.revoked_at IS NULL AND a.starts_at <= now()
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
    WHERE a.user_id=auth.uid() AND a.revoked_at IS NULL AND a.starts_at <= now()
      AND (a.expires_at IS NULL OR a.expires_at > now())
      AND g.module=p_module AND g.action=p_action AND g.scope=p_scope AND g.effect='allow'
  );
END;
$$;

CREATE FUNCTION public.bfe_my_access() RETURNS jsonb
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
  SELECT jsonb_build_object('version',1,'capabilities',coalesce((
    SELECT jsonb_agg(jsonb_build_object('module',module,'action',action,'scope',scope) ORDER BY module,action,scope)
    FROM candidates WHERE public.bfe_can(module,action,scope)
  ),'[]'::jsonb),'committees',coalesce((
    SELECT jsonb_agg(a.committee_id ORDER BY a.committee_id) FROM public.bfe_access_assignments a
    WHERE a.user_id=auth.uid() AND a.revoked_at IS NULL AND a.starts_at<=now()
      AND (a.expires_at IS NULL OR a.expires_at>now()) AND cardinality(public.bfe_current_roles())>0
  ),'[]'::jsonb));
$$;

ALTER TABLE public.bfe_access_committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_access_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_access_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_access_workbook ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_access_audit ENABLE ROW LEVEL SECURITY;
-- No browser provisioning rights, including for developers. Owner-reviewed SQL only.
REVOKE ALL ON public.bfe_access_committees,public.bfe_access_assignments,public.bfe_access_grants,public.bfe_access_workbook FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.bfe_access_audit FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.bfe_access_audit_id_seq FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bfe_record_access_change() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bfe_can(text,text,text), public.bfe_my_access() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_can(text,text,text), public.bfe_my_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.bfe_request_access(p_request_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT cardinality(public.bfe_current_roles())>0 AND EXISTS (
    SELECT 1 FROM public.bfe_requests r WHERE r.id=p_request_id AND (
      (r.owner_id=auth.uid() AND public.bfe_can('requests','view','own'))
      OR ('admin'=ANY(public.bfe_current_roles()) AND public.bfe_can('requests','view','association'))
      OR 'developer'=ANY(public.bfe_current_roles())
    )
  );
$$;
DROP POLICY bfe_request_read ON public.bfe_requests;
CREATE POLICY bfe_request_read ON public.bfe_requests FOR SELECT TO authenticated
 USING(public.bfe_request_access(id));
DROP POLICY bfe_request_audit_read ON public.bfe_request_audit;
CREATE POLICY bfe_request_audit_read ON public.bfe_request_audit FOR SELECT TO authenticated
 USING('developer'=ANY(public.bfe_current_roles()) OR
   ('admin'=ANY(public.bfe_current_roles()) AND public.bfe_can('audit','view','association')));

-- Protected request functions below retain validation, locking, version checks,
-- rate limits, idempotency and server-owned audit from migration 001.
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
    (v_roles && ARRAY['admin']::text[] AND public.bfe_can('requests','view','association') AND public.bfe_can('requests','reply','association')) OR
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
    VALUES(p_request_id, v_uid, CASE WHEN 'admin' = ANY(v_roles) AND public.bfe_can('requests','view','association') AND public.bfe_can('requests','reply','association') THEN 'Office' ELSE 'Resident' END,
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
  IF NOT ('admin' = ANY(public.bfe_current_roles())) OR NOT public.bfe_can('requests','view','association') OR NOT public.bfe_can('requests','status','association') THEN
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

-- Metadata extracted from Committee Matrix; no personal roster or automatic grants.
INSERT INTO public.bfe_access_workbook(committee_id,module,level) VALUES
 ('finance','all_modules','R'),
 ('finance','overview','V'),
 ('finance','messages','none'),
 ('finance','requests','none'),
 ('finance','people','V'),
 ('finance','profiles','V'),
 ('finance','property','V'),
 ('finance','operations','V'),
 ('finance','livelihood','V'),
 ('finance','calendar','V'),
 ('finance','security','none'),
 ('finance','community','V'),
 ('finance','hotlines','V'),
 ('finance','documents','V'),
 ('finance','finance','D'),
 ('finance','reports','none'),
 ('finance','transport','none'),
 ('audit_inventory','all_modules','R'),
 ('audit_inventory','overview','V'),
 ('audit_inventory','messages','none'),
 ('audit_inventory','requests','none'),
 ('audit_inventory','people','V'),
 ('audit_inventory','profiles','V'),
 ('audit_inventory','property','V'),
 ('audit_inventory','operations','V'),
 ('audit_inventory','livelihood','V'),
 ('audit_inventory','calendar','V'),
 ('audit_inventory','security','none'),
 ('audit_inventory','community','V'),
 ('audit_inventory','hotlines','V'),
 ('audit_inventory','documents','V'),
 ('audit_inventory','finance','D'),
 ('audit_inventory','reports','none'),
 ('audit_inventory','transport','none'),
 ('grievance','all_modules','R'),
 ('grievance','overview','V'),
 ('grievance','messages','D'),
 ('grievance','requests','D'),
 ('grievance','people','V'),
 ('grievance','profiles','V'),
 ('grievance','property','V'),
 ('grievance','operations','D'),
 ('grievance','livelihood','V'),
 ('grievance','calendar','V'),
 ('grievance','security','D'),
 ('grievance','community','V'),
 ('grievance','hotlines','V'),
 ('grievance','documents','D'),
 ('grievance','finance','none'),
 ('grievance','reports','none'),
 ('grievance','transport','D'),
 ('peace_order','all_modules','R'),
 ('peace_order','overview','V'),
 ('peace_order','messages','D'),
 ('peace_order','requests','D'),
 ('peace_order','people','V'),
 ('peace_order','profiles','V'),
 ('peace_order','property','V'),
 ('peace_order','operations','D'),
 ('peace_order','livelihood','V'),
 ('peace_order','calendar','V'),
 ('peace_order','security','D'),
 ('peace_order','community','V'),
 ('peace_order','hotlines','V'),
 ('peace_order','documents','D'),
 ('peace_order','finance','none'),
 ('peace_order','reports','none'),
 ('peace_order','transport','D'),
 ('maintenance','all_modules','R'),
 ('maintenance','overview','V'),
 ('maintenance','messages','D'),
 ('maintenance','requests','D'),
 ('maintenance','people','V'),
 ('maintenance','profiles','V'),
 ('maintenance','property','V'),
 ('maintenance','operations','D'),
 ('maintenance','livelihood','V'),
 ('maintenance','calendar','V'),
 ('maintenance','security','D'),
 ('maintenance','community','V'),
 ('maintenance','hotlines','V'),
 ('maintenance','documents','D'),
 ('maintenance','finance','none'),
 ('maintenance','reports','none'),
 ('maintenance','transport','D'),
 ('livelihood','all_modules','R'),
 ('livelihood','overview','V'),
 ('livelihood','messages','none'),
 ('livelihood','requests','none'),
 ('livelihood','people','V'),
 ('livelihood','profiles','V'),
 ('livelihood','property','V'),
 ('livelihood','operations','V'),
 ('livelihood','livelihood','D'),
 ('livelihood','calendar','D'),
 ('livelihood','security','none'),
 ('livelihood','community','D'),
 ('livelihood','hotlines','V'),
 ('livelihood','documents','V'),
 ('livelihood','finance','none'),
 ('livelihood','reports','none'),
 ('livelihood','transport','none'),
 ('events_education','all_modules','R'),
 ('events_education','overview','V'),
 ('events_education','messages','none'),
 ('events_education','requests','none'),
 ('events_education','people','none'),
 ('events_education','profiles','none'),
 ('events_education','property','none'),
 ('events_education','operations','V'),
 ('events_education','livelihood','V'),
 ('events_education','calendar','D'),
 ('events_education','security','none'),
 ('events_education','community','D'),
 ('events_education','hotlines','V'),
 ('events_education','documents','V'),
 ('events_education','finance','none'),
 ('events_education','reports','none'),
 ('events_education','transport','none'),
 ('environment','all_modules','R'),
 ('environment','overview','V'),
 ('environment','messages','none'),
 ('environment','requests','none'),
 ('environment','people','none'),
 ('environment','profiles','none'),
 ('environment','property','none'),
 ('environment','operations','V'),
 ('environment','livelihood','V'),
 ('environment','calendar','D'),
 ('environment','security','none'),
 ('environment','community','D'),
 ('environment','hotlines','V'),
 ('environment','documents','V'),
 ('environment','finance','none'),
 ('environment','reports','none'),
 ('environment','transport','none'),
 ('youth_gad','all_modules','R'),
 ('youth_gad','overview','V'),
 ('youth_gad','messages','none'),
 ('youth_gad','requests','none'),
 ('youth_gad','people','none'),
 ('youth_gad','profiles','none'),
 ('youth_gad','property','none'),
 ('youth_gad','operations','V'),
 ('youth_gad','livelihood','V'),
 ('youth_gad','calendar','D'),
 ('youth_gad','security','none'),
 ('youth_gad','community','D'),
 ('youth_gad','hotlines','V'),
 ('youth_gad','documents','V'),
 ('youth_gad','finance','none'),
 ('youth_gad','reports','none'),
 ('youth_gad','transport','none'),
 ('disaster','all_modules','R'),
 ('disaster','overview','V'),
 ('disaster','messages','none'),
 ('disaster','requests','none'),
 ('disaster','people','none'),
 ('disaster','profiles','none'),
 ('disaster','property','none'),
 ('disaster','operations','V'),
 ('disaster','livelihood','V'),
 ('disaster','calendar','D'),
 ('disaster','security','none'),
 ('disaster','community','D'),
 ('disaster','hotlines','V'),
 ('disaster','documents','V'),
 ('disaster','finance','none'),
 ('disaster','reports','none'),
 ('disaster','transport','none'),
 ('election','all_modules','R'),
 ('election','overview','V'),
 ('election','messages','none'),
 ('election','requests','none'),
 ('election','people','none'),
 ('election','profiles','none'),
 ('election','property','none'),
 ('election','operations','V'),
 ('election','livelihood','V'),
 ('election','calendar','V'),
 ('election','security','none'),
 ('election','community','V'),
 ('election','hotlines','V'),
 ('election','documents','V'),
 ('election','finance','none'),
 ('election','reports','none'),
 ('election','transport','none'),
 ('data_governance','all_modules','R'),
 ('data_governance','overview','V'),
 ('data_governance','messages','none'),
 ('data_governance','requests','none'),
 ('data_governance','people','D'),
 ('data_governance','profiles','D'),
 ('data_governance','property','D'),
 ('data_governance','operations','none'),
 ('data_governance','livelihood','none'),
 ('data_governance','calendar','none'),
 ('data_governance','security','none'),
 ('data_governance','community','none'),
 ('data_governance','hotlines','none'),
 ('data_governance','documents','none'),
 ('data_governance','finance','none'),
 ('data_governance','reports','none'),
 ('data_governance','transport','none');

NOTIFY pgrst, 'reload schema';
COMMIT;
