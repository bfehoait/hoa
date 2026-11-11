-- Apply after 044. Adds resident own Property view/create, preserving the
-- installed policy's other clauses. Accepts 023 and the owner-supplied policy
-- inspected on 10 November 2026, plus their already-patched equivalents.
-- No accounts, lot links, approval grants or configured tab rules are changed.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $guard$
DECLARE
 baseline text := $baseline$
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
$baseline$;
 installed text := $installed$
DECLARE
  v_roles text[] := public.bfe_roles_for(p_user_id);
  v_base boolean := false;
BEGIN
  IF p_user_id IS NULL OR cardinality(v_roles) = 0 THEN
    RETURN false;
  END IF;

  IF p_module IS NULL OR p_action IS NULL OR p_scope IS NULL
     OR NOT (
       p_module = ANY(ARRAY[
         'overview','people','registrations','profiles','property',
         'requests','messages','operations','finance','calendar',
         'security','community','hotlines','livelihood','transport',
         'documents','elections','reports','audit','access',
         'profile','support','technical'
       ]::text[])
     )
     OR NOT (
       p_action = ANY(ARRAY[
         'view','summary','create','reply','status','assign',
         'publish','approve','export','manage','monitor'
       ]::text[])
     )
     OR NOT (
       p_scope = ANY(
         ARRAY['own','approved','assigned','association']::text[]
       )
     )
  THEN
    RETURN false;
  END IF;

  IF 'developer' = ANY(v_roles) THEN
    RETURN true;
  END IF;

  IF p_module = 'technical' THEN
    RETURN false;
  END IF;

  -- Explicit existing denials remain authoritative.
  IF EXISTS (
    SELECT 1
    FROM public.bfe_access_assignments a
    JOIN public.bfe_access_grants g ON g.assignment_id = a.id
    WHERE a.user_id = p_user_id
      AND a.revoked_at IS NULL
      AND a.starts_at <= now()
      AND (a.expires_at IS NULL OR a.expires_at > now())
      AND g.module = p_module
      AND g.action = p_action
      AND g.scope = p_scope
      AND g.effect = 'deny'
  ) THEN
    RETURN false;
  END IF;

  v_base :=
    (
      p_module IN ('profile','support')
      AND p_action IN ('view','create')
      AND p_scope = 'own'
    )
    OR (
      p_module IN ('community','hotlines')
      AND p_action = 'view'
      AND p_scope = 'approved'
    )
    OR (
      v_roles && ARRAY['homeowner','renter']::text[]
      AND p_module = 'requests'
      AND p_action IN ('view','create','reply')
      AND p_scope = 'own'
    )
    OR (
      v_roles && ARRAY['homeowner','renter']::text[]
      AND p_module = 'calendar'
      AND p_action IN ('view','create')
      AND p_scope = 'own'
    )

    -- Fix: resident visitor-pass and transport access.
    -- Transport includes the existing shuttle and carpool services.
    OR (
      v_roles && ARRAY['homeowner','renter']::text[]
      AND p_module IN ('security','transport')
      AND p_action IN ('view','create')
      AND p_scope = 'own'
    )

    OR (
      'homeowner' = ANY(v_roles)
      AND p_module = 'finance'
      AND p_action = 'view'
      AND p_scope = 'own'
    )
    OR (
      'homeowner' = ANY(v_roles)
      AND p_module = 'livelihood'
      AND p_action IN ('view','create')
      AND p_scope = 'own'
    )
    OR (
      'board' = ANY(v_roles)
      AND p_action = 'view'
      AND p_scope = 'approved'
      AND p_module IN (
        'calendar','requests','finance','livelihood','documents'
      )
    );

  RETURN v_base OR EXISTS (
    SELECT 1
    FROM public.bfe_access_assignments a
    JOIN public.bfe_access_grants g ON g.assignment_id = a.id
    WHERE a.user_id = p_user_id
      AND a.revoked_at IS NULL
      AND a.starts_at <= now()
      AND (a.expires_at IS NULL OR a.expires_at > now())
      AND g.module = p_module
      AND g.action = p_action
      AND g.scope = p_scope
      AND g.effect = 'allow'
  );
END;
$installed$;
 body text; definition text; changed text; normalized text;
 pattern text := 'p_module[[:space:]]*=[[:space:]]*''calendar''';
 replacement text := 'p_module IN (''calendar'',''property'')';
BEGIN
 SELECT p.prosrc,pg_get_functiondef(p.oid) INTO body,definition
 FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
 WHERE p.oid=to_regprocedure('public.bfe_legacy_can_for(uuid,text,text,text)')
 AND p.prosecdef AND p.provolatile='s' AND l.lanname='plpgsql';
 normalized:=regexp_replace(body,'[[:space:]]','','g');
 IF normalized IS NULL OR normalized NOT IN (
  regexp_replace(baseline,'[[:space:]]','','g'),
  regexp_replace(installed,'[[:space:]]','','g'),
  regexp_replace(regexp_replace(baseline,pattern,replacement,'g'),'[[:space:]]','','g'),
  regexp_replace(regexp_replace(installed,pattern,replacement,'g'),'[[:space:]]','','g')
 ) THEN
  RAISE EXCEPTION 'Resident base permissions differ from the reviewed policies. Review the installed policy before adding own Property request access; no changes applied.';
 END IF;
 IF to_regprocedure('public.bfe_can_for(uuid,text,text,text)') IS NULL THEN RAISE EXCEPTION 'Install configurable access through 044 first.'; END IF;
 -- Already patched: rerunning does not change or add a second grant.
 IF normalized IN (
  regexp_replace(regexp_replace(baseline,pattern,replacement,'g'),'[[:space:]]','','g'),
  regexp_replace(regexp_replace(installed,pattern,replacement,'g'),'[[:space:]]','','g')
 ) THEN RETURN; END IF;
 IF (SELECT count(*) FROM regexp_matches(body,pattern,'g'))<>1 THEN RAISE EXCEPTION 'Expected one reviewed calendar permission clause; no changes applied.'; END IF;
 changed:=regexp_replace(body,pattern,replacement,'g');
 -- Reuse the exact installed definition/metadata, changing just this clause.
 IF position(body IN definition)=0 THEN RAISE EXCEPTION 'Installed function could not be patched safely; no changes applied.'; END IF;
 EXECUTE replace(definition,body,changed);
END;$guard$;
NOTIFY pgrst,'reload schema'; COMMIT;
