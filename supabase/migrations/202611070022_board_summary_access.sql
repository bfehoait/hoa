-- Board members get the approved summaries the permission matrix gives them.
--
-- The association's View Matrix marks BOD as "R — approved summaries or
-- authorised review" across announcements, events and facility bookings,
-- requests and complaints, statements, and the livelihood listings. The board
-- role held no base grants at all, so a BOD member without a committee
-- assignment saw almost nothing.
--
-- R is implemented as view at the 'approved' scope, which is precisely the
-- published projection: bfe_feature_dashboard admits p_view='published' on
-- bfe_can(capability,'view','approved') and returns curated public text only.
-- It does NOT grant association-wide reads, so a board member still cannot
-- open a household's records, a resident's statement or an individual
-- complaint. Those remain office work.
--
-- 'community' is absent below because every active member already holds
-- community view/approved, board members included.
--
-- This replaces bfe_legacy_can_for, not bfe_can_for. Migration 014 made
-- bfe_can_for the tab-rule layer that delegates base grants here; replacing
-- the wrong one would silently remove configurable tab access.
--
-- Not included, deliberately: the Super admin column. See
-- docs/PERMISSION-MATRIX-CHECK.md — it needs an association decision, not a
-- migration written alongside this one.
BEGIN;

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

-- Check afterwards, as a board member:
--   SELECT public.bfe_can('finance','view','approved');      -- expect true
--   SELECT public.bfe_can('finance','view','association');   -- expect false
