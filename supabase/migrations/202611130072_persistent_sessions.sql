-- Owner-run AFTER 071; deploy the matching frontend and account Edge function.
-- No credentials or existing Auth sessions are rewritten. Old idle sessions
-- may require one fresh sign-in. See docs/PERSISTENT-SESSIONS.md before rollout.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE TABLE public.bfe_session_activity (
 session_id uuid PRIMARY KEY REFERENCES auth.sessions(id) ON DELETE CASCADE,
 last_active_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bfe_session_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_session_activity FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_session_deadlines()
RETURNS TABLE(session_id uuid,valid boolean,expires_at timestamptz,idle_expires_at timestamptz,server_now timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE sid uuid; uid uuid:=auth.uid(); started timestamptz; native_end timestamptz;
 activity timestamptz; assigned text[]; privileged boolean; absolute_end timestamptz; idle_end timestamptz;
BEGIN
 IF uid IS NULL THEN RETURN; END IF;
 BEGIN sid:=(auth.jwt()->>'session_id')::uuid;
 EXCEPTION WHEN invalid_text_representation THEN RETURN; END;
 SELECT s.created_at,s.not_after INTO started,native_end
 FROM auth.sessions s WHERE s.id=sid AND s.user_id=uid;
 IF NOT FOUND THEN RETURN; END IF;
 assigned:=public.bfe_roles_for(uid);
 privileged:=cardinality(assigned)=0 OR NOT (assigned <@ ARRAY['homeowner','renter']::text[])
 OR EXISTS (
  SELECT 1 FROM public.bfe_access_assignments a JOIN public.bfe_access_grants g ON g.assignment_id=a.id
  WHERE a.user_id=uid AND a.revoked_at IS NULL AND a.starts_at<=now()
   AND (a.expires_at IS NULL OR a.expires_at>now()) AND g.scope='association' AND g.effect='allow'
 );
 SELECT a.last_active_at INTO activity FROM public.bfe_session_activity a WHERE a.session_id=sid;
 absolute_end:=least(started+CASE WHEN privileged THEN interval '12 hours' ELSE interval '30 days' END,native_end);
 idle_end:=coalesce(activity,started)+CASE WHEN privileged THEN interval '30 minutes' ELSE interval '7 days' END;
 RETURN QUERY SELECT sid,now()<absolute_end AND now()<idle_end,absolute_end,idle_end,now();
END;$$;

CREATE FUNCTION public.bfe_session_is_valid() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT d.valid FROM public.bfe_session_deadlines() d),false);
$$;

CREATE FUNCTION public.bfe_session_status(p_touch boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d record;
BEGIN
 IF auth.uid() IS NULL THEN RETURN jsonb_build_object('valid',false); END IF;
 IF p_touch IS NULL THEN RAISE EXCEPTION 'Invalid session check.' USING ERRCODE='22023'; END IF;
 -- Check BEFORE touching; expired sessions cannot be revived by activity.
 IF p_touch THEN PERFORM pg_advisory_xact_lock(hashtextextended('session:'||coalesce(auth.jwt()->>'session_id',''),0)); END IF;
 SELECT * INTO d FROM public.bfe_session_deadlines();
 IF NOT FOUND OR NOT d.valid THEN RETURN jsonb_build_object('valid',false); END IF;
 IF p_touch THEN
  INSERT INTO public.bfe_session_activity(session_id,last_active_at) VALUES(d.session_id,now())
  ON CONFLICT(session_id) DO UPDATE SET last_active_at=EXCLUDED.last_active_at;
  SELECT * INTO d FROM public.bfe_session_deadlines();
 END IF;
 RETURN jsonb_build_object('valid',true,'expires_at',d.expires_at,'idle_expires_at',d.idle_expires_at,'server_now',d.server_now);
END;$$;

CREATE FUNCTION public.bfe_require_session() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 -- Anonymous registration remains available. Service-role jobs are not browser sessions.
 IF auth.role() IS DISTINCT FROM 'authenticated' THEN RETURN; END IF;
 -- The status endpoint can report expiry, but returns no business/account data.
 IF ltrim(coalesce(current_setting('request.path',true),''),'/')='rpc/bfe_session_status' THEN RETURN; END IF;
 IF NOT public.bfe_session_is_valid() THEN
  RAISE EXCEPTION 'Your session expired. Please sign in again.' USING ERRCODE='PT401';
 END IF;
END;$$;

REVOKE ALL ON FUNCTION public.bfe_session_deadlines(),public.bfe_session_is_valid(),public.bfe_session_status(boolean),public.bfe_require_session() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_session_is_valid(),public.bfe_session_status(boolean),public.bfe_require_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_require_session() TO anon,service_role;

-- Storage does not run PostgREST hooks. These restrictive policies add a
-- session boundary to existing bucket permissions; they grant no new access.
CREATE POLICY bfe_storage_session_guard ON storage.objects AS RESTRICTIVE
 FOR ALL TO authenticated
 USING (bucket_id NOT LIKE 'bfe-%' OR (SELECT public.bfe_session_is_valid()))
 WITH CHECK (bucket_id NOT LIKE 'bfe-%' OR (SELECT public.bfe_session_is_valid()));

-- Do not silently replace another installed security hook.
DO $install$
DECLARE existing text;
BEGIN
 SELECT split_part(setting,'=',2) INTO existing
 FROM pg_roles r CROSS JOIN LATERAL unnest(r.rolconfig) setting
 WHERE r.rolname='authenticator' AND setting LIKE 'pgrst.db_pre_request=%' LIMIT 1;
 IF coalesce(existing,'') NOT IN ('','public.bfe_require_session') OR EXISTS (
  SELECT 1 FROM pg_db_role_setting s CROSS JOIN LATERAL unnest(s.setconfig) setting
  WHERE (s.setrole=0 OR s.setrole=(SELECT oid FROM pg_roles WHERE rolname='authenticator'))
   AND (s.setdatabase=0 OR s.setdatabase=(SELECT oid FROM pg_database WHERE datname=current_database()))
   AND setting LIKE 'pgrst.db_pre_request=%'
   AND split_part(setting,'=',2) NOT IN ('','public.bfe_require_session')
 ) THEN RAISE EXCEPTION 'Existing Data API security hook found. Review and chain it before installing session enforcement.'; END IF;
 EXECUTE 'ALTER ROLE authenticator SET pgrst.db_pre_request=''public.bfe_require_session''';
END;
$install$;
NOTIFY pgrst,'reload schema';
NOTIFY pgrst,'reload config';
COMMIT;
