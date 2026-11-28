-- Owner-run AFTER 104. Workspace access editor and explicit action rules.
-- No role defaults, people assignments or approval grants are seeded.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_action_rules (
 subject_kind text NOT NULL CHECK(subject_kind IN ('user','role','committee')),subject_id text NOT NULL,
 module text NOT NULL CHECK(module IN ('overview','people','registrations','profiles','property','requests','messages','operations','finance','calendar','security','community','hotlines','livelihood','transport','documents','elections','reports','audit')),
 scope text NOT NULL CHECK(scope IN ('own','approved','assigned','association')),
 action text NOT NULL CHECK(action IN ('create','reply','status','assign','publish','approve','export','manage')),
 effect text NOT NULL CHECK(effect IN ('allow','deny')), PRIMARY KEY(subject_kind,subject_id,module,scope,action)
);
ALTER TABLE public.bfe_action_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_action_rules FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bfe_action_rules_audit AFTER INSERT OR UPDATE OR DELETE ON public.bfe_action_rules FOR EACH ROW EXECUTE FUNCTION public.bfe_record_access_change();
ALTER FUNCTION public.bfe_can_for(uuid,text,text,text) RENAME TO bfe_can_before_action_rules;
REVOKE ALL ON FUNCTION public.bfe_can_before_action_rules(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bfe_action_effect_for(p_user uuid,p_module text,p_action text,p_scope text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE chosen text;
BEGIN
 SELECT effect INTO chosen FROM public.bfe_action_rules WHERE subject_kind='user' AND subject_id=p_user::text AND module=p_module AND action=p_action AND scope=p_scope;
 IF chosen IS NULL THEN
 SELECT CASE WHEN bool_or(t.effect='deny') THEN 'deny' WHEN bool_or(t.effect='allow') THEN 'allow' ELSE NULL END INTO chosen
 FROM public.bfe_action_rules t WHERE t.module=p_module AND t.action=p_action AND t.scope=p_scope AND (
 (t.subject_kind='role' AND t.subject_id=ANY(public.bfe_assigned_roles_for(p_user))) OR
 (t.subject_kind='committee' AND EXISTS(SELECT 1 FROM public.bfe_access_assignments a WHERE a.user_id=p_user AND a.committee_id=t.subject_id AND a.revoked_at IS NULL AND a.starts_at<=now() AND (a.expires_at IS NULL OR a.expires_at>now()))));
 END IF;
 RETURN chosen;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_action_effect_for(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bfe_can_for(p_user_id uuid,p_module text,p_action text,p_scope text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE held text[]:=public.bfe_roles_for(p_user_id);mode text;effect text;
BEGIN
 IF p_user_id IS NULL OR coalesce(cardinality(held),0)=0 THEN RETURN false; END IF;
 IF 'developer'=ANY(held) THEN RETURN public.bfe_can_before_action_rules(p_user_id,p_module,p_action,p_scope); END IF;
 IF EXISTS(SELECT 1 FROM public.bfe_access_assignments a JOIN public.bfe_access_grants g ON g.assignment_id=a.id WHERE a.user_id=p_user_id AND a.revoked_at IS NULL AND a.starts_at<=now() AND (a.expires_at IS NULL OR a.expires_at>now()) AND g.module=p_module AND g.action=p_action AND g.scope=p_scope AND g.effect='deny') THEN RETURN false; END IF;
 mode:=public.bfe_tab_mode_for(p_user_id,p_module,p_scope);
 IF mode='hidden' OR (mode='view' AND p_action NOT IN ('view','summary')) THEN RETURN false; END IF;
 effect:=public.bfe_action_effect_for(p_user_id,p_module,p_action,p_scope);
 IF effect='deny' THEN RETURN false; END IF;
 IF effect='allow' THEN RETURN public.bfe_can_before_action_rules(p_user_id,p_module,'view',p_scope); END IF;
 RETURN public.bfe_can_before_action_rules(p_user_id,p_module,p_action,p_scope);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_can_for(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
-- bfe_can and authorized readers invoke bfe_can_for as their definer.
CREATE FUNCTION public.bfe_access_editor(p_kind text,p_subject text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid;held text[];snapshot jsonb;effective jsonb;sources jsonb;
BEGIN
 IF NOT public.bfe_is_access_manager() THEN RAISE EXCEPTION 'Access manager permission required.' USING ERRCODE='42501'; END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('user','role','committee') OR p_subject IS NULL OR length(p_subject)>100 THEN RAISE EXCEPTION 'Choose an account or group.' USING ERRCODE='22023'; END IF;
 IF p_kind='user' THEN
 target:=p_subject::uuid;held:=public.bfe_assigned_roles_for(target);
 IF (SELECT count(*) FROM public.members WHERE user_id=target)<>1 THEN RAISE EXCEPTION 'Exactly one linked account is required.' USING ERRCODE='22023'; END IF;
 ELSIF p_kind='role' AND p_subject NOT IN ('admin','homeowner','renter','board','security','driver','finance','grievance','maintenance') THEN RAISE EXCEPTION 'Choose a known role.' USING ERRCODE='22023';
 ELSIF p_kind='committee' AND NOT EXISTS(SELECT 1 FROM public.bfe_access_committees WHERE id=p_subject) THEN RAISE EXCEPTION 'Choose a known committee.' USING ERRCODE='22023'; END IF;
 snapshot:=jsonb_build_object('rules',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.scope,x.module) FROM (SELECT module,scope,mode FROM public.bfe_tab_rules WHERE subject_kind=p_kind AND subject_id=p_subject) x),'[]'::jsonb),
 'actions',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.scope,x.module,x.action) FROM (SELECT module,scope,action,effect FROM public.bfe_action_rules WHERE subject_kind=p_kind AND subject_id=p_subject) x),'[]'::jsonb));
 IF target IS NOT NULL THEN
 SELECT jsonb_object_agg(m||':'||s,vals) INTO effective FROM (
 SELECT m,s,(SELECT jsonb_object_agg(a,public.bfe_can_for(target,m,a,s)) FROM unnest(ARRAY['view','create','reply','status','assign','publish','approve','export','manage']) a) vals
 FROM unnest(ARRAY['overview','people','registrations','profiles','property','requests','messages','operations','finance','calendar','security','community','hotlines','livelihood','transport','documents','elections','reports','audit']) m CROSS JOIN unnest(ARRAY['own','approved','assigned','association']) s
 WHERE (s='association' AND (held && ARRAY['admin','finance','grievance','maintenance','board','security','driver','developer']::text[] OR EXISTS(SELECT 1 FROM public.bfe_access_assignments a WHERE a.user_id=target AND a.revoked_at IS NULL AND a.starts_at<=now() AND (a.expires_at IS NULL OR a.expires_at>now()))))
 OR (s='own' AND held && ARRAY['homeowner','renter']::text[] AND m IN ('property','requests','finance','calendar','security','livelihood','transport','documents'))
 OR (s='approved' AND m IN ('community','hotlines','livelihood','transport','documents','elections','reports'))
 OR EXISTS(SELECT 1 FROM public.bfe_tab_rules t WHERE t.subject_kind='user' AND t.subject_id=p_subject AND t.module=m AND t.scope=s)
 OR EXISTS(SELECT 1 FROM public.bfe_action_rules t WHERE t.subject_kind='user' AND t.subject_id=p_subject AND t.module=m AND t.scope=s)) q;
 SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO sources FROM (
 SELECT 'module' AS type,t.subject_kind,t.subject_id,t.module,t.scope,NULL::text AS action,t.mode AS value FROM public.bfe_tab_rules t WHERE (t.subject_kind='user' AND t.subject_id=p_subject) OR (t.subject_kind='role' AND t.subject_id=ANY(held)) OR (t.subject_kind='committee' AND EXISTS(SELECT 1 FROM public.bfe_access_assignments a WHERE a.user_id=target AND a.committee_id=t.subject_id AND a.revoked_at IS NULL AND a.starts_at<=now() AND (a.expires_at IS NULL OR a.expires_at>now())))
 UNION ALL SELECT 'action',t.subject_kind,t.subject_id,t.module,t.scope,t.action,t.effect FROM public.bfe_action_rules t WHERE (t.subject_kind='user' AND t.subject_id=p_subject) OR (t.subject_kind='role' AND t.subject_id=ANY(held)) OR (t.subject_kind='committee' AND EXISTS(SELECT 1 FROM public.bfe_access_assignments a WHERE a.user_id=target AND a.committee_id=t.subject_id AND a.revoked_at IS NULL AND a.starts_at<=now() AND (a.expires_at IS NULL OR a.expires_at>now())))
 UNION ALL SELECT 'grant','committee',a.committee_id,g.module,g.scope,g.action,g.effect FROM public.bfe_access_assignments a JOIN public.bfe_access_grants g ON g.assignment_id=a.id WHERE a.user_id=target AND a.revoked_at IS NULL AND a.starts_at<=now() AND (a.expires_at IS NULL OR a.expires_at>now())) x;
 END IF;
 RETURN jsonb_build_object('snapshot',snapshot,'effective',effective,'sources',coalesce(sources,'[]'::jsonb),'roles',coalesce(to_jsonb(held),'[]'::jsonb),'manager',EXISTS(SELECT 1 FROM public.bfe_access_managers WHERE user_id=target AND active));
END;$$;
CREATE FUNCTION public.bfe_save_access_editor(p_kind text,p_subject text,p_expected jsonb,p_next jsonb,p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE before_value jsonb;row jsonb;oldrow jsonb;scope_name text;module_name text;action_name text;developer boolean;
BEGIN
 IF NOT public.bfe_is_access_manager() THEN RAISE EXCEPTION 'Access manager permission required.' USING ERRCODE='42501'; END IF;
 developer:='developer'=ANY(public.bfe_current_roles());
 IF NOT developer AND (p_kind='user' AND (p_subject=auth.uid()::text OR 'developer'=ANY(public.bfe_roles_for(p_subject::uuid)))) THEN RAISE EXCEPTION 'Only a developer may change this protected account.' USING ERRCODE='42501'; END IF;
 IF p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 3 AND 200 OR p_next IS NULL OR jsonb_typeof(p_next)<>'object' OR jsonb_typeof(p_next->'rules') IS DISTINCT FROM 'array' OR jsonb_typeof(p_next->'actions') IS DISTINCT FROM 'array' OR octet_length(p_next::text)>60000 THEN RAISE EXCEPTION 'Check the access choices and change reason.' USING ERRCODE='22023'; END IF;
 -- Serialize with older tab editors as well as this editor.
 FOREACH scope_name IN ARRAY ARRAY['own','approved','assigned','association'] LOOP
 PERFORM pg_advisory_xact_lock(hashtextextended('tab:'||p_kind||':'||p_subject||':'||scope_name,0)); END LOOP;
 before_value:=public.bfe_access_editor(p_kind,p_subject)->'snapshot';
 IF before_value IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Access changed. Reload before saving.' USING ERRCODE='40001'; END IF;
 IF p_kind='user' AND 'developer'=ANY(public.bfe_roles_for(p_subject::uuid)) THEN RAISE EXCEPTION 'Developer recovery access cannot be changed.' USING ERRCODE='42501'; END IF;
 -- Check all authority before changing any permissions, including one's own defaults.
 FOR row IN SELECT value FROM jsonb_array_elements(p_next->'rules') LOOP
 module_name:=row->>'module';scope_name:=row->>'scope';
 IF module_name IS NULL OR scope_name IS NULL OR row->>'mode' IS NULL OR NOT(module_name=ANY(ARRAY['overview','people','registrations','profiles','property','requests','messages','operations','finance','calendar','security','community','hotlines','livelihood','transport','documents','elections','reports','audit'])) OR scope_name NOT IN ('own','approved','assigned','association') OR row->>'mode' NOT IN ('hidden','view','edit') THEN RAISE EXCEPTION 'Unknown module access choice.' USING ERRCODE='22023'; END IF;
 IF NOT developer AND NOT (p_expected->'rules' @> jsonb_build_array(row)) AND row->>'mode'<>'hidden' THEN
 FOREACH action_name IN ARRAY CASE WHEN row->>'mode'='edit' THEN ARRAY['view','summary','create','reply','status'] ELSE ARRAY['view','summary'] END LOOP
 IF NOT public.bfe_can(module_name,action_name,scope_name) THEN RAISE EXCEPTION 'You cannot grant access beyond your own permissions.' USING ERRCODE='42501'; END IF; END LOOP; END IF;
 END LOOP;
 FOR row IN SELECT value FROM jsonb_array_elements(p_next->'actions') LOOP
 module_name:=row->>'module';scope_name:=row->>'scope';action_name:=row->>'action';
 IF module_name IS NULL OR scope_name IS NULL OR action_name IS NULL OR row->>'effect' IS NULL OR NOT(module_name=ANY(ARRAY['overview','people','registrations','profiles','property','requests','messages','operations','finance','calendar','security','community','hotlines','livelihood','transport','documents','elections','reports','audit'])) OR scope_name NOT IN ('own','approved','assigned','association') OR action_name NOT IN ('create','reply','status','assign','publish','approve','export','manage') OR row->>'effect' NOT IN ('allow','deny') THEN RAISE EXCEPTION 'Unknown action permission.' USING ERRCODE='22023'; END IF;
 IF NOT developer AND NOT(p_expected->'actions' @> jsonb_build_array(row)) AND row->>'effect'='allow' AND NOT public.bfe_can(module_name,action_name,scope_name) THEN RAISE EXCEPTION 'You cannot grant an action you do not hold.' USING ERRCODE='42501'; END IF;
 END LOOP;
 IF NOT developer THEN
 FOR oldrow IN SELECT value FROM jsonb_array_elements(p_expected->'rules') LOOP
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_next->'rules') x WHERE x->>'module'=oldrow->>'module' AND x->>'scope'=oldrow->>'scope') THEN RAISE EXCEPTION 'Ask a developer to restore defaults.' USING ERRCODE='42501'; END IF; END LOOP;
 FOR oldrow IN SELECT value FROM jsonb_array_elements(p_expected->'actions') LOOP
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_next->'actions') x WHERE x->>'module'=oldrow->>'module' AND x->>'scope'=oldrow->>'scope' AND x->>'action'=oldrow->>'action') THEN RAISE EXCEPTION 'Ask a developer to restore default actions.' USING ERRCODE='42501'; END IF; END LOOP;
 END IF;
 DELETE FROM public.bfe_tab_rules WHERE subject_kind=p_kind AND subject_id=p_subject;
 INSERT INTO public.bfe_tab_rules SELECT p_kind,p_subject,x->>'module',x->>'scope',x->>'mode' FROM jsonb_array_elements(p_next->'rules') x;
 DELETE FROM public.bfe_action_rules WHERE subject_kind=p_kind AND subject_id=p_subject;
 INSERT INTO public.bfe_action_rules SELECT p_kind,p_subject,x->>'module',x->>'scope',x->>'action',x->>'effect' FROM jsonb_array_elements(p_next->'actions') x;
 INSERT INTO public.bfe_account_audit(actor_id,target_id,action,details) VALUES(auth.uid(),CASE WHEN p_kind='user' THEN p_subject::uuid ELSE auth.uid() END,'Workspace access updated',jsonb_build_object('kind',p_kind,'subject',p_subject,'before',before_value,'after',p_next,'reference',btrim(p_note)));
 RETURN public.bfe_access_editor(p_kind,p_subject);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_access_editor(text,text),public.bfe_save_access_editor(text,text,jsonb,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_access_editor(text,text),public.bfe_save_access_editor(text,text,jsonb,jsonb,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
