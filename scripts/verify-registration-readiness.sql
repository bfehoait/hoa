-- Read-only schema assessment before extending resident registration.
-- Returns no applications, account identities, email addresses or credentials.
BEGIN TRANSACTION READ ONLY;

SELECT jsonb_build_object(
 'assessment_only',true,
 'registration_table_exists',to_regclass('public.registrations') IS NOT NULL,
 'registration_columns',(
   SELECT coalesce(jsonb_agg(jsonb_build_object(
     'column',column_name,'type',data_type,'nullable',is_nullable,
     'has_default',column_default IS NOT NULL
   ) ORDER BY ordinal_position),'[]'::jsonb)
   FROM information_schema.columns
   WHERE table_schema='public' AND table_name='registrations'
 ),
 'registration_constraints',(
   SELECT coalesce(jsonb_agg(jsonb_build_object(
     'type',c.contype,'definition',pg_get_constraintdef(c.oid)
   ) ORDER BY c.conname),'[]'::jsonb)
   FROM pg_constraint c WHERE c.conrelid=to_regclass('public.registrations')
 ),
 'registration_rls',(
   SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.registrations')
 ),
 'onboarding_triggers',(
   SELECT coalesce(jsonb_agg(jsonb_build_object(
     'schema',n.nspname,'table',c.relname,'trigger',t.tgname,
     'enabled',t.tgenabled,'function_schema',pn.nspname,'function',p.proname
   ) ORDER BY n.nspname,c.relname,t.tgname),'[]'::jsonb)
   FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
   JOIN pg_namespace n ON n.oid=c.relnamespace
   JOIN pg_proc p ON p.oid=t.tgfoid
   JOIN pg_namespace pn ON pn.oid=p.pronamespace
   WHERE NOT t.tgisinternal AND (
     (n.nspname='auth' AND c.relname='users') OR
     (n.nspname='public' AND c.relname IN ('members','registrations'))
   )
 ),
 'registration_policy_roles',(
   SELECT coalesce(jsonb_agg(jsonb_build_object(
     'policy',policyname,'command',cmd,'roles',roles
   ) ORDER BY policyname),'[]'::jsonb)
   FROM pg_policies WHERE schemaname='public' AND tablename='registrations'
 )
) AS registration_readiness;

COMMIT;
