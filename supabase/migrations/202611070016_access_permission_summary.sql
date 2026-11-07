-- Apply after 015. Extend the existing manager-only read; no grants or member rules change.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE OR REPLACE FUNCTION public.bfe_tab_access(p_kind text,p_subject text,p_scope text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid; modes jsonb; permissions jsonb;
BEGIN
 IF NOT public.bfe_is_access_manager() THEN RAISE EXCEPTION 'Access manager required.' USING ERRCODE='42501';END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('user','role','committee') OR p_subject IS NULL OR btrim(p_subject)='' OR p_scope IS NULL OR p_scope NOT IN ('own','approved','assigned','association') THEN
  RAISE EXCEPTION 'Choose an account or group and a valid data scope.' USING ERRCODE='22023';
 END IF;
 IF (p_kind='role' AND p_subject NOT IN ('homeowner','renter','admin','board','security','driver')) OR (p_kind='committee' AND NOT EXISTS(SELECT 1 FROM public.bfe_access_committees WHERE id=p_subject)) THEN
  RAISE EXCEPTION 'Choose a known role or committee.' USING ERRCODE='22023';
 END IF;
 SELECT coalesce(jsonb_object_agg(module,mode),'{}'::jsonb) INTO modes FROM public.bfe_tab_rules WHERE subject_kind=p_kind AND subject_id=p_subject AND scope=p_scope;
 IF p_kind='user' THEN
  target:=p_subject::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.members WHERE user_id=target) THEN RAISE EXCEPTION 'Account unavailable.' USING ERRCODE='22023';END IF;
  -- Resolve on the server: explicit denials, roles, active/expired assignments and
  -- developer recovery all retain the same semantics as actual service checks.
  SELECT jsonb_object_agg(m,jsonb_build_object(
   'read',public.bfe_can_for(target,m,'view',p_scope),
   'create',public.bfe_can_for(target,m,'create',p_scope),
   'reply',public.bfe_can_for(target,m,'reply',p_scope),
   'status',public.bfe_can_for(target,m,'status',p_scope))) INTO permissions
  FROM unnest(ARRAY['overview','people','registrations','profiles','property','requests','messages','operations','finance','calendar','security','community','hotlines','livelihood','transport','documents','elections','reports','audit']) m;
 END IF;
 RETURN jsonb_build_object('rules',modes,
  'manager',p_kind='user' AND EXISTS(SELECT 1 FROM public.bfe_access_managers WHERE user_id=target AND active),
  'effective',permissions);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_tab_access(text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_tab_access(text,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
