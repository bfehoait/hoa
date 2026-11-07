-- Application migration, prepared locally. Apply once through the authorized
-- project owner after review. No legacy rows, policies or functions are changed.
-- No source records, credentials or sample data are embedded in this migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE public.bfe_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  client_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 5000),
  category text NOT NULL CHECK (category IN ('Maintenance','Concern','Complaint','Document','Support')),
  unit_snapshot text,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','In progress','Resolved')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, client_id)
);
CREATE INDEX bfe_requests_owner_created ON public.bfe_requests(owner_id, created_at DESC, id);
CREATE INDEX bfe_requests_status_created ON public.bfe_requests(status, created_at DESC, id);
CREATE TABLE public.bfe_request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.bfe_requests(id),
  author_id uuid NOT NULL REFERENCES auth.users(id),
  author_kind text NOT NULL CHECK (author_kind IN ('Resident','Office')),
  client_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, author_id, client_id)
);
CREATE INDEX bfe_messages_request_created ON public.bfe_request_messages(request_id, created_at DESC, id);
CREATE TABLE public.bfe_request_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.bfe_requests(id),
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('Created','Replied','Status changed')),
  old_status text,
  new_status text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bfe_audit_request_at ON public.bfe_request_audit(request_id, at DESC);

-- Identity is always auth.uid(), never a caller-supplied account/email/role.
-- Duplicate or inactive memberships fail closed. Developer is monitoring-only
-- here; it does not independently grant office writes or resident submission.
CREATE FUNCTION public.bfe_current_roles() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(array_agg(DISTINCT assigned.role), ARRAY[]::text[])
  FROM public.members m
  CROSS JOIN LATERAL unnest(array_prepend(m.role, coalesce(m.extra_roles, ARRAY[]::text[]))) assigned(role)
  WHERE m.user_id = auth.uid() AND m.status = 'Active'
    AND assigned.role = ANY(ARRAY['admin','developer','homeowner','renter','board','security','driver']::text[])
    AND (SELECT count(*) FROM public.members d WHERE d.user_id = auth.uid()) = 1;
$$;
CREATE FUNCTION public.bfe_request_access(p_request_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT cardinality(public.bfe_current_roles()) > 0 AND EXISTS (
    SELECT 1 FROM public.bfe_requests r WHERE r.id = p_request_id
      AND (r.owner_id = auth.uid() OR public.bfe_current_roles() && ARRAY['admin','developer']::text[])
  );
$$;

ALTER TABLE public.bfe_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_request_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_request_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY bfe_request_read ON public.bfe_requests FOR SELECT TO authenticated
  USING (cardinality(public.bfe_current_roles()) > 0
    AND (owner_id = auth.uid() OR public.bfe_current_roles() && ARRAY['admin','developer']::text[]));
CREATE POLICY bfe_message_read ON public.bfe_request_messages FOR SELECT TO authenticated
  USING (public.bfe_request_access(request_id));
CREATE POLICY bfe_request_audit_read ON public.bfe_request_audit FOR SELECT TO authenticated
  USING (public.bfe_current_roles() && ARRAY['admin','developer']::text[]);

-- Every write goes through a narrowly scoped, validated operation.
CREATE FUNCTION public.bfe_create_request(p_client_id uuid, p_title text, p_description text, p_category text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.bfe_requests; v_roles text[] := public.bfe_current_roles(); v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT (v_roles && ARRAY['homeowner','renter']::text[]) THEN
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

CREATE FUNCTION public.bfe_reply_request(p_request_id uuid, p_client_id uuid, p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.bfe_requests; m public.bfe_request_messages;
  v_uid uuid := auth.uid(); v_roles text[] := public.bfe_current_roles();
BEGIN
  IF NOT public.bfe_request_access(p_request_id) OR NOT (
    v_roles && ARRAY['admin']::text[] OR
    (v_roles && ARRAY['homeowner','renter']::text[] AND EXISTS (
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
    VALUES(p_request_id, v_uid, CASE WHEN 'admin' = ANY(v_roles) THEN 'Office' ELSE 'Resident' END,
      p_client_id, btrim(p_body)) RETURNING * INTO m;
  UPDATE public.bfe_requests SET updated_at = now(), version = version + 1 WHERE id = p_request_id;
  INSERT INTO public.bfe_request_audit(request_id, actor_id, action) VALUES(p_request_id, v_uid, 'Replied');
  RETURN to_jsonb(m);
END;
$$;

CREATE FUNCTION public.bfe_set_request_status(p_request_id uuid, p_expected_version integer, p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.bfe_requests; v_old text;
BEGIN
  IF NOT ('admin' = ANY(public.bfe_current_roles())) THEN
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

REVOKE ALL ON public.bfe_requests, public.bfe_request_messages, public.bfe_request_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.bfe_requests, public.bfe_request_messages, public.bfe_request_audit TO authenticated;
REVOKE ALL ON SEQUENCE public.bfe_request_audit_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bfe_current_roles(), public.bfe_request_access(uuid),
  public.bfe_create_request(uuid,text,text,text), public.bfe_reply_request(uuid,uuid,text),
  public.bfe_set_request_status(uuid,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_current_roles(), public.bfe_request_access(uuid),
  public.bfe_create_request(uuid,text,text,text), public.bfe_reply_request(uuid,uuid,text),
  public.bfe_set_request_status(uuid,integer,text) TO authenticated;

-- Realtime publication is deliberately not altered. The first release uses
-- explicit refresh/polling; no notification delivery or emergency service claim.
NOTIFY pgrst, 'reload schema';
COMMIT;
