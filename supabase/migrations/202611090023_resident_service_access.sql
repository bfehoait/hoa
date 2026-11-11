-- Preserve the owner-applied resident-access correction after migration 022.
-- Replaces only the latest base-grant function; the configurable tab layer
-- (bfe_can_for), explicit denials, lot checks and staff actions are retained.
-- No accounts, lot memberships, publications or collection records are created.
-- Apply after 022. Safe to apply when the equivalent chat SQL was already run.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$
BEGIN
 IF to_regprocedure('public.bfe_can_for(uuid,text,text,text)') IS NULL
    OR to_regprocedure('public.bfe_legacy_can_for(uuid,text,text,text)') IS NULL THEN
  RAISE EXCEPTION 'Install migrations through 022 before applying resident access.';
 END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.bfe_legacy_can_for(p_user_id uuid, p_module text, p_action text, p_scope text)
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
    -- Residents can use their own visitor passes and transport services.
    -- Association-wide review, approval and publication stay separately granted.
    OR (v_roles && ARRAY['homeowner','renter']::text[] AND p_module IN ('security','transport')
        AND p_action IN ('view','create') AND p_scope='own')
    OR ('homeowner'=ANY(v_roles) AND p_module='finance' AND p_action='view' AND p_scope='own')
    OR ('homeowner'=ANY(v_roles) AND p_module='livelihood' AND p_action IN ('view','create') AND p_scope='own')
    -- BOD: approved summaries only. Reading a published summary is not the
    -- same as opening the household record behind it.
    OR ('board'=ANY(v_roles) AND p_action='view' AND p_scope='approved'
        AND p_module IN ('calendar','requests','finance','livelihood','documents'));
  RETURN v_base OR EXISTS (
    SELECT 1 FROM public.bfe_access_assignments a JOIN public.bfe_access_grants g ON g.assignment_id=a.id
    WHERE a.user_id=p_user_id AND a.revoked_at IS NULL AND a.starts_at <= now()
      AND (a.expires_at IS NULL OR a.expires_at > now())
      AND g.module=p_module AND g.action=p_action AND g.scope=p_scope AND g.effect='allow'
  );
END;
$$;

NOTIFY pgrst,'reload schema';
COMMIT;
