-- Apply once after 013. Configurable tab access and explicitly delegated admin management.
-- No new default privileges or managers are seeded. Existing role access remains the baseline.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_access_managers(user_id uuid PRIMARY KEY REFERENCES auth.users(id),active boolean NOT NULL DEFAULT true);
CREATE TABLE public.bfe_tab_rules(
 subject_kind text NOT NULL CHECK(subject_kind IN ('user','role','committee')), subject_id text NOT NULL,
 module text NOT NULL CHECK(module IN ('overview','people','registrations','profiles','property','requests','messages','operations','finance','calendar','security','community','hotlines','livelihood','transport','documents','elections','reports','audit')),
 scope text NOT NULL CHECK(scope IN ('own','approved','assigned','association')), mode text NOT NULL CHECK(mode IN ('hidden','view','edit')),
 PRIMARY KEY(subject_kind,subject_id,module,scope)
);
ALTER TABLE public.bfe_access_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_tab_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_access_managers,public.bfe_tab_rules FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bfe_tab_rules_audit AFTER INSERT OR UPDATE OR DELETE ON public.bfe_tab_rules FOR EACH ROW EXECUTE FUNCTION public.bfe_record_access_change();
CREATE TRIGGER bfe_managers_audit AFTER INSERT OR UPDATE OR DELETE ON public.bfe_access_managers FOR EACH ROW EXECUTE FUNCTION public.bfe_record_access_change();
CREATE FUNCTION public.bfe_is_access_manager() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT 'developer'=ANY(public.bfe_current_roles()) OR ('admin'=ANY(public.bfe_current_roles()) AND EXISTS(SELECT 1 FROM public.bfe_access_managers WHERE user_id=auth.uid() AND active));
$$;
CREATE FUNCTION public.bfe_legacy_can_for(p_user_id uuid, p_module text, p_action text, p_scope text)
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
REVOKE ALL ON FUNCTION public.bfe_legacy_can_for(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bfe_tab_mode_for(p_user_id uuid,p_module text,p_scope text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE roles text[]:=public.bfe_roles_for(p_user_id);chosen text;
BEGIN
 IF cardinality(roles)=0 OR 'developer'=ANY(roles) THEN RETURN NULL;END IF;
 SELECT mode INTO chosen FROM public.bfe_tab_rules WHERE subject_kind='user' AND subject_id=p_user_id::text AND module=p_module AND scope=p_scope;
 IF chosen IS NULL THEN
  SELECT CASE WHEN count(*)=0 THEN NULL WHEN bool_or(t.mode='hidden') THEN 'hidden' WHEN bool_or(t.mode='edit') THEN 'edit' ELSE 'view' END INTO chosen
  FROM public.bfe_tab_rules t WHERE t.module=p_module AND t.scope=p_scope AND (
   (t.subject_kind='role' AND t.subject_id=ANY(roles)) OR
   (t.subject_kind='committee' AND EXISTS(SELECT 1 FROM public.bfe_access_assignments a WHERE a.user_id=p_user_id AND a.committee_id=t.subject_id AND a.revoked_at IS NULL AND a.starts_at<=now() AND (a.expires_at IS NULL OR a.expires_at>now()))));
 END IF;
 RETURN chosen;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_tab_mode_for(uuid,text,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.bfe_can_for(p_user_id uuid,p_module text,p_action text,p_scope text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE roles text[]:=public.bfe_roles_for(p_user_id);chosen text;
BEGIN
 IF p_user_id IS NULL OR cardinality(roles)=0 THEN RETURN false;END IF;
 IF 'developer'=ANY(roles) THEN RETURN public.bfe_legacy_can_for(p_user_id,p_module,p_action,p_scope);END IF;
 IF p_module='access' AND p_scope='association' AND p_action IN ('view','manage') THEN
  RETURN 'admin'=ANY(roles) AND EXISTS(SELECT 1 FROM public.bfe_access_managers WHERE user_id=p_user_id AND active);
 END IF;
 -- Explicit legacy denials always win; changing tabs never erases a recorded denial.
 IF EXISTS(SELECT 1 FROM public.bfe_access_assignments a JOIN public.bfe_access_grants g ON g.assignment_id=a.id WHERE a.user_id=p_user_id AND a.revoked_at IS NULL AND a.starts_at<=now() AND (a.expires_at IS NULL OR a.expires_at>now()) AND g.module=p_module AND g.action=p_action AND g.scope=p_scope AND g.effect='deny') THEN RETURN false;END IF;
 chosen:=public.bfe_tab_mode_for(p_user_id,p_module,p_scope);
 IF chosen='hidden' THEN RETURN false;END IF;
 IF chosen='view' THEN RETURN p_action IN ('view','summary');END IF;
 IF chosen='edit' AND p_action IN ('view','summary','create','reply','status') THEN RETURN true;END IF;
 -- Approval, publication, export, assignment and management still require explicit action grants.
 RETURN public.bfe_legacy_can_for(p_user_id,p_module,p_action,p_scope);
END;$$;
CREATE OR REPLACE FUNCTION public.bfe_my_access() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('version',1,'developer_control','developer'=ANY(public.bfe_current_roles()),'access_manager',public.bfe_is_access_manager(),'tab_modes',coalesce((SELECT jsonb_agg(jsonb_build_object('module',m,'scope',s,'mode',public.bfe_tab_mode_for(auth.uid(),m,s))) FROM unnest(ARRAY['overview','people','registrations','profiles','property','requests','messages','operations','finance','calendar','security','community','hotlines','livelihood','transport','documents','elections','reports','audit']) m CROSS JOIN unnest(ARRAY['own','approved','assigned','association']) s WHERE public.bfe_tab_mode_for(auth.uid(),m,s) IS NOT NULL),'[]'::jsonb),'capabilities',coalesce((
 SELECT jsonb_agg(jsonb_build_object('module',m,'action',a,'scope',s) ORDER BY m,a,s)
 FROM unnest(ARRAY['overview','people','registrations','profiles','property','requests','messages','operations','finance','calendar','security','community','hotlines','livelihood','transport','documents','elections','reports','audit','access','profile','support','technical']) m
 CROSS JOIN unnest(ARRAY['view','summary','create','reply','status','assign','publish','approve','export','manage','monitor']) a
 CROSS JOIN unnest(ARRAY['own','approved','assigned','association']) s
 WHERE NOT ('developer'=ANY(public.bfe_current_roles())) AND public.bfe_can(m,a,s)),'[]'::jsonb),
 'committees',coalesce((SELECT jsonb_agg(committee_id ORDER BY committee_id) FROM public.bfe_access_assignments WHERE user_id=auth.uid() AND revoked_at IS NULL AND starts_at<=now() AND (expires_at IS NULL OR expires_at>now()) AND cardinality(public.bfe_current_roles())>0),'[]'::jsonb));
$$;
CREATE FUNCTION public.bfe_tab_access(p_kind text,p_subject text,p_scope text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.bfe_is_access_manager() THEN RAISE EXCEPTION 'Access manager required.' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('rules',coalesce((SELECT jsonb_object_agg(module,mode) FROM public.bfe_tab_rules WHERE subject_kind=p_kind AND subject_id=p_subject AND scope=p_scope),'{}'::jsonb),
 'manager',EXISTS(SELECT 1 FROM public.bfe_access_managers WHERE user_id::text=p_subject AND active));
END;$$;
CREATE FUNCTION public.bfe_save_tab_access(p_kind text,p_subject text,p_scope text,p_rules jsonb,p_expected jsonb,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE current_rules jsonb;k text;mode text;action text;
BEGIN
 IF NOT public.bfe_is_access_manager() THEN RAISE EXCEPTION 'Access manager required.' USING ERRCODE='42501';END IF;
 IF p_kind IS NULL OR p_kind NOT IN ('user','role','committee') OR p_subject IS NULL OR p_scope IS NULL OR p_scope NOT IN ('own','approved','assigned','association') OR p_rules IS NULL OR jsonb_typeof(p_rules)<>'object' OR octet_length(p_rules::text)>5000 OR p_expected IS NULL OR jsonb_typeof(p_expected)<>'object' OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Check the access selection and change reason.' USING ERRCODE='22023';END IF;
 IF (p_kind='role' AND p_subject NOT IN ('homeowner','renter','admin','board','security','driver')) OR (p_kind='committee' AND NOT EXISTS(SELECT 1 FROM public.bfe_access_committees WHERE id=p_subject)) OR (p_kind='user' AND cardinality(public.bfe_roles_for(p_subject::uuid))=0) THEN RAISE EXCEPTION 'Active account or known group required.' USING ERRCODE='22023';END IF;
 IF p_kind='user' AND 'developer'=ANY(public.bfe_roles_for(p_subject::uuid)) THEN RAISE EXCEPTION 'Developer recovery access cannot be changed by tab rules.' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('tab:'||p_kind||':'||p_subject||':'||p_scope,0));
 SELECT coalesce(jsonb_object_agg(module,t.mode),'{}'::jsonb) INTO current_rules FROM public.bfe_tab_rules t WHERE subject_kind=p_kind AND subject_id=p_subject AND scope=p_scope;
 IF current_rules IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Access changed. Refresh before saving.' USING ERRCODE='40001';END IF;
 FOR k,mode IN SELECT key,value FROM jsonb_each_text(p_rules) LOOP
  IF k NOT IN ('overview','people','registrations','profiles','property','requests','messages','operations','finance','calendar','security','community','hotlines','livelihood','transport','documents','elections','reports','audit') OR mode IS NULL OR mode NOT IN ('hidden','view','edit') THEN RAISE EXCEPTION 'Unknown tab or access level.' USING ERRCODE='22023';END IF;
  IF NOT ('developer'=ANY(public.bfe_current_roles())) AND mode<>'hidden' THEN
   FOREACH action IN ARRAY CASE WHEN mode='edit' THEN ARRAY['view','summary','create','reply','status'] ELSE ARRAY['view','summary'] END LOOP
    IF NOT public.bfe_can(k,action,p_scope) THEN RAISE EXCEPTION 'You cannot grant access beyond your own permissions.' USING ERRCODE='42501';END IF;
   END LOOP;
  END IF;
 END LOOP;
 -- Removing a restriction can restore baseline rights: delegated managers must hold those rights too.
 IF NOT ('developer'=ANY(public.bfe_current_roles())) AND EXISTS(SELECT 1 FROM jsonb_object_keys(current_rules) old_module WHERE NOT(p_rules ? old_module)) THEN RAISE EXCEPTION 'Ask a developer to restore inherited access.' USING ERRCODE='42501';END IF;
 DELETE FROM public.bfe_tab_rules WHERE subject_kind=p_kind AND subject_id=p_subject AND scope=p_scope;
 INSERT INTO public.bfe_tab_rules SELECT p_kind,p_subject,key,p_scope,value FROM jsonb_each_text(p_rules);
 INSERT INTO public.bfe_account_audit(actor_id,target_id,action,details) VALUES(auth.uid(),CASE WHEN p_kind='user' THEN p_subject::uuid ELSE auth.uid() END,'Tab access updated',jsonb_build_object('kind',p_kind,'subject',p_subject,'scope',p_scope,'before',current_rules,'after',p_rules,'reference',btrim(p_note)));
END;$$;
CREATE FUNCTION public.bfe_set_access_manager(p_user uuid,p_active boolean,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT ('developer'=ANY(public.bfe_current_roles())) THEN RAISE EXCEPTION 'Developer required to delegate access management.' USING ERRCODE='42501';END IF;
 IF p_user IS NULL OR p_active IS NULL OR NOT ('admin'=ANY(public.bfe_roles_for(p_user))) OR p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Choose an active admin and a change reason.' USING ERRCODE='22023';END IF;
 INSERT INTO public.bfe_access_managers VALUES(p_user,p_active) ON CONFLICT(user_id) DO UPDATE SET active=excluded.active;
 INSERT INTO public.bfe_account_audit(actor_id,target_id,action,details) VALUES(auth.uid(),p_user,'Access management delegated',jsonb_build_object('active',p_active,'reference',btrim(p_note)));
END;$$;
REVOKE ALL ON FUNCTION public.bfe_is_access_manager(),public.bfe_tab_access(text,text,text),public.bfe_save_tab_access(text,text,text,jsonb,jsonb,text),public.bfe_set_access_manager(uuid,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_tab_access(text,text,text),public.bfe_save_tab_access(text,text,text,jsonb,jsonb,text),public.bfe_set_access_manager(uuid,boolean,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.bfe_access_members(p_search text DEFAULT '',p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_rows jsonb; v_total bigint;
BEGIN
 IF NOT public.bfe_is_access_manager() THEN RAISE EXCEPTION 'Access manager required.' USING ERRCODE='42501'; END IF;
 IF p_search IS NULL OR char_length(p_search)>100 OR p_page IS NULL OR p_page<0 OR p_page>10000 THEN RAISE EXCEPTION 'Invalid search.' USING ERRCODE='22023';END IF;
 SELECT count(*) INTO v_total FROM public.members WHERE user_id IS NOT NULL AND (SELECT count(*) FROM public.members d WHERE d.user_id=members.user_id)=1 AND (position(lower(p_search) in lower(coalesce(name,'')||' '||coalesce(unit,'')))>0);
 SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.name,m.user_id),'[]'::jsonb) INTO v_rows FROM (
 SELECT user_id,name,unit,role,extra_roles,status FROM public.members WHERE user_id IS NOT NULL AND (SELECT count(*) FROM public.members d WHERE d.user_id=members.user_id)=1
 AND position(lower(p_search) in lower(coalesce(name,'')||' '||coalesce(unit,'')))>0 ORDER BY name,user_id OFFSET p_page*20 LIMIT 20) m;
 RETURN jsonb_build_object('rows',v_rows,'total',v_total);
END;
$$;
CREATE OR REPLACE FUNCTION public.bfe_member_assignments(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;
BEGIN
 IF NOT public.bfe_is_access_manager() THEN RAISE EXCEPTION 'Access manager required.' USING ERRCODE='42501';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',a.id,'committee_id',a.committee_id,'expires_at',a.expires_at,'revoked_at',a.revoked_at,'grants',(SELECT count(*) FROM public.bfe_access_grants g WHERE g.assignment_id=a.id)) ORDER BY a.committee_id),'[]'::jsonb) INTO v
 FROM public.bfe_access_assignments a WHERE a.user_id=p_user_id;
 RETURN v;
END;
$$;
CREATE OR REPLACE FUNCTION public.bfe_update_member_access(p_user_id uuid,p_role text,p_extra text[],p_status text,p_reference text,p_expected jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_roles text[]; v_old jsonb; v_after jsonb; v_setting text; v_developer_count bigint;
BEGIN
 IF NOT ('developer'=ANY(public.bfe_current_roles())) AND (p_user_id=auth.uid() OR 'developer'=ANY(public.bfe_roles_for(p_user_id)) OR 'developer'=ANY(p_extra)) THEN RAISE EXCEPTION 'Only a developer may change this protected account.' USING ERRCODE='42501';END IF;
 IF NOT public.bfe_is_access_manager() THEN RAISE EXCEPTION 'Access manager required.' USING ERRCODE='42501';END IF;
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
 IF NOT ('developer'=ANY(public.bfe_current_roles())) AND EXISTS(
 SELECT 1 FROM unnest(ARRAY['overview','people','registrations','profiles','property','requests','messages','operations','finance','calendar','security','community','hotlines','livelihood','transport','documents','elections','reports','audit','access','technical']) m
 CROSS JOIN unnest(ARRAY['view','summary','create','reply','status','assign','publish','approve','export','manage','monitor']) a
 CROSS JOIN unnest(ARRAY['own','approved','assigned','association']) s
 WHERE public.bfe_can_for(p_user_id,m,a,s) AND NOT public.bfe_can(m,a,s)) THEN RAISE EXCEPTION 'This role change exceeds your management authority.' USING ERRCODE='42501';END IF;
 INSERT INTO public.bfe_account_audit(actor_id,target_id,action,details) VALUES(auth.uid(),p_user_id,'Member access updated',jsonb_build_object('before',v_old,'after',v_after,'reference',btrim(p_reference)));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(p_user_id,'access','Account access changed','Your account roles or status changed. Sign in again to review access.','/more/profile','member-access:'||gen_random_uuid()::text);
END;
$$;
CREATE OR REPLACE FUNCTION public.bfe_provision_access(p_user_id uuid,p_committee text,p_module text,p_action text,p_scope text,p_effect text,p_reference text,p_expires timestamptz DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.bfe_access_assignments; v_grant uuid;
BEGIN
 IF NOT ('developer'=ANY(public.bfe_current_roles())) AND (p_user_id=auth.uid() OR 'developer'=ANY(public.bfe_roles_for(p_user_id)) OR p_module IN ('access','technical') OR NOT public.bfe_can(p_module,p_action,p_scope)) THEN RAISE EXCEPTION 'Cannot change protected accounts or grant beyond your own access.' USING ERRCODE='42501';END IF;
 IF NOT public.bfe_is_access_manager() THEN RAISE EXCEPTION 'Access manager required.' USING ERRCODE='42501'; END IF;
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
CREATE OR REPLACE FUNCTION public.bfe_revoke_assignment(p_assignment_id uuid,p_reference text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid;
BEGIN
 IF NOT ('developer'=ANY(public.bfe_current_roles())) AND EXISTS(SELECT 1 FROM public.bfe_access_assignments a WHERE id=p_assignment_id AND (user_id=auth.uid() OR 'developer'=ANY(public.bfe_roles_for(user_id)) OR EXISTS(SELECT 1 FROM public.bfe_access_grants g WHERE g.assignment_id=a.id AND g.effect='deny'))) THEN RAISE EXCEPTION 'Protected assignment.' USING ERRCODE='42501';END IF;
 IF NOT public.bfe_is_access_manager() THEN RAISE EXCEPTION 'Access manager required.' USING ERRCODE='42501';END IF;
 IF p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Approval reference required.' USING ERRCODE='22023';END IF;
 UPDATE public.bfe_access_assignments SET revoked_at=coalesce(revoked_at,now()),approval_reference=btrim(p_reference) WHERE id=p_assignment_id RETURNING user_id INTO v_uid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assignment unavailable.' USING ERRCODE='22023';END IF;
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 VALUES(v_uid,'access','Committee access revoked','An assignment was revoked. Refresh your workspace.','/more/profile','revoke:'||gen_random_uuid()::text);
END;
$$;
CREATE OR REPLACE FUNCTION public.bfe_review_feature(p_id uuid,p_version integer,p_status text,p_note text,p_public_title text DEFAULT NULL,p_public_body text DEFAULT NULL,p_audience text DEFAULT NULL,p_expires timestamptz DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records; d public.bfe_feature_definitions;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 THEN RAISE EXCEPTION 'Active membership required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_id FOR UPDATE;
 SELECT * INTO d FROM public.bfe_feature_definitions WHERE code=r.module;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Record unavailable.' USING ERRCODE='42501'; END IF;
 IF p_status='Withdrawn' AND r.owner_id=auth.uid() THEN
  IF NOT (public.bfe_can(d.capability,'create','own') OR public.bfe_can(d.capability,'create','association')) THEN RAISE EXCEPTION 'Edit permission required.' USING ERRCODE='42501';END IF;
  IF r.status IN ('Withdrawn','Rejected') THEN RAISE EXCEPTION 'Record already closed.'; END IF;
 ELSE
  IF NOT public.bfe_can(d.capability,'view','association') OR NOT public.bfe_can(d.capability,CASE WHEN p_status='Published' THEN 'publish' ELSE 'status' END,'association') THEN RAISE EXCEPTION 'Feature review permission required.' USING ERRCODE='42501'; END IF;
  IF NOT ((r.status='Submitted' AND p_status IN ('In review','Rejected')) OR (r.status='In review' AND p_status IN ('Reviewed','Rejected','Published')) OR (r.status='Published' AND p_status='Withdrawn')) THEN RAISE EXCEPTION 'Status transition not permitted.' USING ERRCODE='22023'; END IF;
  IF p_status='Published' AND (NOT d.publishable OR NOT r.publication_consent OR p_public_title IS NULL OR p_public_body IS NULL OR char_length(btrim(p_public_title)) NOT BETWEEN 3 AND 120 OR char_length(btrim(p_public_body)) NOT BETWEEN 10 AND 5000 OR p_audience IS NULL OR p_audience NOT IN ('members','homeowner','renter','board','security','driver') OR p_expires IS NULL OR p_expires<=now() OR p_expires>now()+interval '366 days') THEN RAISE EXCEPTION 'Publication needs consent, reviewed public text, audience and future expiry within one year.' USING ERRCODE='22023'; END IF;
 END IF;
 IF p_version IS NULL OR r.version<>p_version THEN RAISE EXCEPTION 'Record changed. Refresh before retrying.' USING ERRCODE='40001'; END IF;
 IF p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 5 AND 1000 OR p_note !~ '[^[:space:]]' THEN RAISE EXCEPTION 'Provide a review reason.' USING ERRCODE='22023'; END IF;
 UPDATE public.bfe_feature_records SET status=p_status,version=version+1,updated_at=now(),public_title=CASE WHEN p_status='Published' THEN btrim(p_public_title) ELSE public_title END,public_body=CASE WHEN p_status='Published' THEN btrim(p_public_body) ELSE public_body END,audience=CASE WHEN p_status='Published' THEN p_audience ELSE audience END,expires_at=CASE WHEN p_status='Published' THEN p_expires ELSE expires_at END WHERE id=p_id;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note) VALUES(p_id,auth.uid(),p_status,btrim(p_note));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(r.owner_id,'community','Submission: '||p_status,'Open your submission to check its review history.','/more/notifications','feature:'||r.id::text||':'||(r.version+1)::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
END;$$;
CREATE OR REPLACE FUNCTION public.bfe_decide_booking(p_id uuid,p_version integer,p_status text,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_bookings;
BEGIN
 SELECT * INTO r FROM public.bfe_bookings WHERE id=p_id FOR UPDATE;
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR r.id IS NULL THEN RAISE EXCEPTION 'Booking unavailable.' USING ERRCODE='42501'; END IF;
 IF p_status='Cancelled' AND r.owner_id=auth.uid() AND public.bfe_can('calendar','create','own') THEN
  IF r.status NOT IN ('Pending','Approved') OR r.starts_at<=now() THEN RAISE EXCEPTION 'Booking is already closed or started.'; END IF;
 ELSE
  IF NOT public.bfe_can('calendar','view','association') OR NOT public.bfe_can('calendar','approve','association') THEN RAISE EXCEPTION 'Booking approval permission required.' USING ERRCODE='42501'; END IF;
  IF r.status<>'Pending' OR p_status IS NULL OR p_status NOT IN ('Approved','Rejected') OR r.starts_at<=now() THEN RAISE EXCEPTION 'Booking cannot receive this decision.'; END IF;
 END IF;
 IF p_version IS NULL OR r.version<>p_version THEN RAISE EXCEPTION 'Booking changed. Refresh before retrying.' USING ERRCODE='40001'; END IF;
 IF p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Provide a decision reason.' USING ERRCODE='22023'; END IF;
 UPDATE public.bfe_bookings SET status=p_status,version=version+1 WHERE id=p_id;
 INSERT INTO public.bfe_booking_audit(booking_id,actor_id,action,note) VALUES(p_id,auth.uid(),p_status,btrim(p_note));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(r.owner_id,'community','Booking: '||p_status,'Open facility bookings to check the office decision.','/more/notifications','booking:'||r.id::text||':'||(r.version+1)::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
END;$$;
CREATE OR REPLACE FUNCTION public.bfe_update_visitor_pass(p_id uuid,p_version integer,p_status text,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_visitor_passes;
BEGIN
 SELECT * INTO r FROM public.bfe_visitor_passes WHERE id=p_id FOR UPDATE;
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR r.id IS NULL THEN RAISE EXCEPTION 'Pass unavailable.' USING ERRCODE='42501'; END IF;
 IF p_status='Cancelled' AND r.owner_id=auth.uid() AND public.bfe_can('security','create','own') THEN
  IF r.status NOT IN ('Pending','Approved') THEN RAISE EXCEPTION 'Pass cannot be cancelled.'; END IF;
 ELSE
  IF NOT public.bfe_can('security','view','association') THEN RAISE EXCEPTION 'Security access required.' USING ERRCODE='42501'; END IF;
  IF p_status IN ('Approved','Rejected') THEN
   IF r.status<>'Pending' OR r.valid_until<=now() OR NOT public.bfe_can('security','approve','association') THEN RAISE EXCEPTION 'Pass approval permission and current pending pass required.' USING ERRCODE='42501'; END IF;
   IF NOT EXISTS(SELECT 1 FROM public.bfe_lot_memberships m JOIN public.bfe_lots l ON l.id=m.lot_id JOIN public.bfe_import_batches b ON b.id=l.batch_id WHERE m.lot_id=r.lot_id AND m.user_id=r.owner_id AND m.state='approved' AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now()) AND b.status='active') OR cardinality(public.bfe_roles_for(r.owner_id))=0 THEN RAISE EXCEPTION 'Resident membership is no longer valid.' USING ERRCODE='42501'; END IF;
  ELSIF p_status IN ('Entered','Exited') THEN
   IF NOT ('security'=ANY(public.bfe_current_roles())) OR NOT public.bfe_can('security','status','association') OR NOT ((r.status='Approved' AND p_status='Entered' AND r.valid_from<=now() AND r.valid_until>now()) OR (r.status='Entered' AND p_status='Exited')) THEN RAISE EXCEPTION 'On-post security permission and valid pass required.' USING ERRCODE='42501'; END IF;
   IF p_status='Entered' AND (cardinality(public.bfe_roles_for(r.owner_id))=0 OR NOT EXISTS(SELECT 1 FROM public.bfe_lot_memberships m JOIN public.bfe_lots l ON l.id=m.lot_id JOIN public.bfe_import_batches b ON b.id=l.batch_id WHERE m.lot_id=r.lot_id AND m.user_id=r.owner_id AND m.state='approved' AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now()) AND b.status='active')) THEN RAISE EXCEPTION 'Resident access was withdrawn. Refer to the office.' USING ERRCODE='42501'; END IF;
  ELSE RAISE EXCEPTION 'Pass action not permitted.' USING ERRCODE='22023'; END IF;
 END IF;
 IF p_version IS NULL OR r.version<>p_version THEN RAISE EXCEPTION 'Pass changed. Refresh before retrying.' USING ERRCODE='40001'; END IF;
 IF p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Provide a decision or gate note.' USING ERRCODE='22023'; END IF;
 UPDATE public.bfe_visitor_passes SET status=p_status,version=version+1 WHERE id=p_id;
 INSERT INTO public.bfe_visitor_audit(pass_id,actor_id,action,note) VALUES(p_id,auth.uid(),p_status,btrim(p_note));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(r.owner_id,'access','Visitor pass: '||p_status,'Open visitor passes to check the update.','/more/notifications','visitor:'||r.id::text||':'||(r.version+1)::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
END;$$;
CREATE OR REPLACE FUNCTION public.bfe_decide_participation(p_id uuid,p_version integer,p_status text,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.bfe_activity_participation;r public.bfe_feature_records;cap integer;module_cap text;
BEGIN
 -- Every decision locks the activity before the application, serializing capacity changes.
 SELECT r1.* INTO r FROM public.bfe_feature_records r1 JOIN public.bfe_activity_participation e1 ON e1.activity_id=r1.id WHERE e1.id=p_id FOR UPDATE OF r1;
 SELECT * INTO e FROM public.bfe_activity_participation WHERE id=p_id FOR UPDATE;
 module_cap:=CASE WHEN r.module='carpools' THEN 'transport' ELSE 'livelihood' END;
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR e.id IS NULL THEN RAISE EXCEPTION 'Application unavailable.' USING ERRCODE='42501'; END IF;
 IF p_status='Withdrawn' AND e.owner_id=auth.uid() AND public.bfe_can(module_cap,'create','own') THEN
  IF e.status NOT IN ('Pending','Confirmed') THEN RAISE EXCEPTION 'Application already closed.'; END IF;
 ELSE
  IF NOT public.bfe_can(module_cap,'view','association') OR NOT public.bfe_can(module_cap,'approve','association') THEN RAISE EXCEPTION 'Activity approval permission required.' USING ERRCODE='42501'; END IF;
  IF e.status<>'Pending' OR p_status IS NULL OR p_status NOT IN ('Confirmed','Rejected') THEN RAISE EXCEPTION 'Application decision not permitted.'; END IF;
  IF p_status='Confirmed' THEN
   IF NOT public.bfe_activity_open(e.activity_id) OR NOT (public.bfe_roles_for(e.owner_id) && ARRAY['homeowner','renter']::text[]) THEN RAISE EXCEPTION 'Activity or resident membership is no longer available.'; END IF;
   cap:=coalesce(r.fields->>'capacity',r.fields->>'seats')::integer;
   IF e.places+coalesce((SELECT sum(places) FROM public.bfe_activity_participation WHERE activity_id=e.activity_id AND status='Confirmed'),0)>cap THEN RAISE EXCEPTION 'Not enough capacity remains. Keep pending or reject with a reason.'; END IF;
  END IF;
 END IF;
 IF p_version IS NULL OR e.version<>p_version THEN RAISE EXCEPTION 'Application changed. Refresh before retrying.' USING ERRCODE='40001'; END IF;
 IF p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Provide a decision reason.' USING ERRCODE='22023'; END IF;
 UPDATE public.bfe_activity_participation SET status=p_status,version=version+1 WHERE id=p_id;
 INSERT INTO public.bfe_participation_audit(participation_id,actor_id,action,note) VALUES(p_id,auth.uid(),p_status,btrim(p_note));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(e.owner_id,'community','Activity: '||p_status,'Open activity participation to check your application.','/more/notifications','participation:'||e.id::text||':'||(e.version+1)::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
END;$$;
-- Backstop for legacy owner actions and procedures that do not call bfe_can for every write.
CREATE FUNCTION public.bfe_guard_tab_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE row_data jsonb;mod text;own_id text;rule_scope text;mode text;
BEGIN
 IF auth.uid() IS NULL OR 'developer'=ANY(public.bfe_current_roles()) THEN
  IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
 END IF;
 row_data:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 mod:=CASE TG_TABLE_NAME WHEN 'bfe_requests' THEN 'requests' WHEN 'bfe_bookings' THEN 'calendar' WHEN 'bfe_visitor_passes' THEN 'security' WHEN 'bfe_shuttle_requests' THEN 'transport' WHEN 'bfe_shuttle_presence' THEN 'transport' WHEN 'bfe_shuttles' THEN 'transport' WHEN 'bfe_lot_memberships' THEN 'property' END;
 IF TG_TABLE_NAME='bfe_feature_records' THEN SELECT capability INTO mod FROM public.bfe_feature_definitions WHERE code=row_data->>'module';END IF;
 IF TG_TABLE_NAME='bfe_activity_participation' THEN SELECT CASE WHEN module='carpools' THEN 'transport' ELSE 'livelihood' END INTO mod FROM public.bfe_feature_records WHERE id=(row_data->>'activity_id')::uuid;END IF;
 own_id:=coalesce(row_data->>'owner_id',row_data->>'driver_id',row_data->>'user_id');rule_scope:=CASE WHEN own_id=auth.uid()::text THEN 'own' ELSE 'association' END;
 mode:=public.bfe_tab_mode_for(auth.uid(),mod,rule_scope);
 IF mode IN ('hidden','view') THEN RAISE EXCEPTION 'This module is hidden or view only; changes are disabled.' USING ERRCODE='42501';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_guard_tab_write() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bfe_guard_tab_write BEFORE INSERT OR UPDATE OR DELETE ON public.bfe_requests FOR EACH ROW EXECUTE FUNCTION public.bfe_guard_tab_write();
CREATE TRIGGER bfe_guard_tab_write BEFORE INSERT OR UPDATE OR DELETE ON public.bfe_feature_records FOR EACH ROW EXECUTE FUNCTION public.bfe_guard_tab_write();
CREATE TRIGGER bfe_guard_tab_write BEFORE INSERT OR UPDATE OR DELETE ON public.bfe_bookings FOR EACH ROW EXECUTE FUNCTION public.bfe_guard_tab_write();
CREATE TRIGGER bfe_guard_tab_write BEFORE INSERT OR UPDATE OR DELETE ON public.bfe_visitor_passes FOR EACH ROW EXECUTE FUNCTION public.bfe_guard_tab_write();
CREATE TRIGGER bfe_guard_tab_write BEFORE INSERT OR UPDATE OR DELETE ON public.bfe_activity_participation FOR EACH ROW EXECUTE FUNCTION public.bfe_guard_tab_write();
CREATE TRIGGER bfe_guard_tab_write BEFORE INSERT OR UPDATE OR DELETE ON public.bfe_shuttle_requests FOR EACH ROW EXECUTE FUNCTION public.bfe_guard_tab_write();
CREATE TRIGGER bfe_guard_tab_write BEFORE INSERT OR UPDATE OR DELETE ON public.bfe_shuttles FOR EACH ROW EXECUTE FUNCTION public.bfe_guard_tab_write();
CREATE OR REPLACE FUNCTION public.bfe_shuttle_dashboard(p_history boolean DEFAULT false,p_page integer DEFAULT 0,p_outcome text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid(); driver boolean:=public.bfe_shuttle_driver(); reviewer boolean:=public.bfe_shuttle_reviewer(); manager boolean:='developer'=ANY(public.bfe_current_roles()); rows jsonb; n bigint;
BEGIN
 IF public.bfe_tab_mode_for(uid,'transport','own')='hidden' AND NOT reviewer THEN RAISE EXCEPTION 'Shuttle access is hidden.' USING ERRCODE='42501';END IF;
 IF uid IS NULL OR cardinality(public.bfe_current_roles())=0 THEN RAISE EXCEPTION 'Active membership required.' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page<0 OR p_page>10000 OR p_history IS NULL OR p_outcome IS NULL OR p_outcome NOT IN ('','Picked up','Lapsed / Unserved','Cancelled','Passenger absent') OR (NOT p_history AND p_outcome<>'') THEN RAISE EXCEPTION 'Invalid queue filters.' USING ERRCODE='22023'; END IF;
 IF p_history AND NOT (driver OR reviewer) THEN RAISE EXCEPTION 'Service history access required.' USING ERRCODE='42501'; END IF;
 WITH visible AS (
  SELECT r.*,CASE WHEN status IN ('Waiting for Shuttle','Accepted','On the way') AND expires_at<=now() THEN 'Lapsed / Unserved' ELSE status END AS effective_status
  FROM public.bfe_shuttle_requests r
  WHERE (r.owner_id=uid OR reviewer OR (driver AND (r.driver_id=uid OR (r.status='Waiting for Shuttle' AND r.expires_at>now() AND (r.created_at AT TIME ZONE 'Asia/Manila')::date=(now() AT TIME ZONE 'Asia/Manila')::date))))
 ), selected AS (
  SELECT * FROM visible WHERE (p_outcome='' OR effective_status=p_outcome) AND CASE WHEN p_history THEN effective_status IN ('Picked up','Cancelled','Passenger absent','Lapsed / Unserved')
  ELSE effective_status IN ('Waiting for Shuttle','Accepted','On the way','Arrived') AND ((created_at AT TIME ZONE 'Asia/Manila')::date=(now() AT TIME ZONE 'Asia/Manila')::date OR (driver AND driver_id=uid)) END
 ) SELECT count(*),coalesce(jsonb_agg(to_jsonb(x) ORDER BY CASE WHEN NOT p_history AND x.driver_id=uid THEN 0 ELSE 1 END,CASE WHEN p_history THEN x.created_at END DESC,CASE WHEN NOT p_history THEN x.created_at END ASC,x.id) FILTER(WHERE x.id IS NOT NULL),'[]') INTO n,rows
 FROM (SELECT (SELECT count(*) FROM selected) AS total) totals
 LEFT JOIN LATERAL (SELECT id,owner_id,pickup,destination,passengers,effective_status AS status,shuttle_code,driver_id,driver_name,created_at,expires_at,arrived_at,version,reason,
 (created_at AT TIME ZONE 'Asia/Manila')::date<>(now() AT TIME ZONE 'Asia/Manila')::date AS prior_day
 FROM selected ORDER BY CASE WHEN NOT p_history AND driver_id=uid THEN 0 ELSE 1 END,CASE WHEN p_history THEN created_at END DESC,CASE WHEN NOT p_history THEN created_at END ASC,id OFFSET p_page*20 LIMIT 20) x ON true;
 -- Count separately: JSON rows are paginated, total must not be page length.
 SELECT count(*) INTO n FROM public.bfe_shuttle_requests r WHERE (p_outcome='' OR CASE WHEN r.status IN ('Waiting for Shuttle','Accepted','On the way') AND r.expires_at<=now() THEN 'Lapsed / Unserved' ELSE r.status END=p_outcome) AND
 (r.owner_id=uid OR reviewer OR (driver AND (r.driver_id=uid OR (r.status='Waiting for Shuttle' AND r.expires_at>now() AND (r.created_at AT TIME ZONE 'Asia/Manila')::date=(now() AT TIME ZONE 'Asia/Manila')::date))))
 AND CASE WHEN p_history THEN (r.status IN ('Picked up','Cancelled','Passenger absent','Lapsed / Unserved') OR (r.status IN ('Waiting for Shuttle','Accepted','On the way') AND r.expires_at<=now()))
 ELSE (r.status='Arrived' OR (r.status IN ('Waiting for Shuttle','Accepted','On the way') AND r.expires_at>now())) AND ((r.created_at AT TIME ZONE 'Asia/Manila')::date=(now() AT TIME ZONE 'Asia/Manila')::date OR (driver AND r.driver_id=uid)) END;
 RETURN jsonb_build_object('server_now',now(),'driver',driver,'reviewer',reviewer,'manager',manager,'total',n,'rows',rows,
 'waiting_count',(SELECT count(*) FROM public.bfe_shuttle_requests WHERE status='Waiting for Shuttle' AND expires_at>now() AND (created_at AT TIME ZONE 'Asia/Manila')::date=(now() AT TIME ZONE 'Asia/Manila')::date),
 'prior_day_request',(SELECT jsonb_build_object('id',id,'version',version,'status',status,'expires_at',expires_at) FROM public.bfe_shuttle_requests WHERE owner_id=uid AND (created_at AT TIME ZONE 'Asia/Manila')::date<(now() AT TIME ZONE 'Asia/Manila')::date AND (status='Arrived' OR (status IN ('Waiting for Shuttle','Accepted','On the way') AND expires_at>now())) ORDER BY created_at DESC LIMIT 1),
 'latest_outcome',(SELECT jsonb_build_object('status',CASE WHEN status IN ('Waiting for Shuttle','Accepted','On the way') AND expires_at<=now() THEN 'Lapsed / Unserved' ELSE status END,'at',coalesce(closed_at,expires_at)) FROM public.bfe_shuttle_requests WHERE owner_id=uid AND (coalesce(closed_at,expires_at) AT TIME ZONE 'Asia/Manila')::date=(now() AT TIME ZONE 'Asia/Manila')::date AND (status IN ('Picked up','Cancelled','Passenger absent','Lapsed / Unserved') OR (status IN ('Waiting for Shuttle','Accepted','On the way') AND expires_at<=now())) ORDER BY created_at DESC LIMIT 1),
 'shuttles',coalesce((SELECT jsonb_agg(jsonb_build_object('code',s.code,'driver_name',s.driver_name,'capacity',s.capacity,'contact',s.contact,'active',s.active,'on_duty',s.on_duty,'ready',s.ready,'available',public.bfe_shuttle_available(s.driver_id),'driver_id',CASE WHEN manager OR s.driver_id=uid THEN s.driver_id END,'busy',NOT s.ready OR EXISTS(SELECT 1 FROM public.bfe_shuttle_requests r WHERE r.driver_id=s.driver_id AND (r.status='Arrived' OR (r.status IN ('Accepted','On the way') AND r.expires_at>now()))))) FROM public.bfe_shuttles s WHERE (s.active AND 'driver'=ANY(public.bfe_roles_for(s.driver_id))) OR manager),'[]'),
 'eligible_drivers',CASE WHEN manager THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.user_id,'name',m.name)) FROM public.members m WHERE 'driver'=ANY(public.bfe_roles_for(m.user_id))),'[]') ELSE '[]'::jsonb END);
END;$$;
CREATE OR REPLACE FUNCTION public.bfe_shuttle_driver() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT 'driver'=ANY(public.bfe_current_roles()) AND coalesce(public.bfe_tab_mode_for(auth.uid(),'transport','own'),'edit')<>'hidden' AND EXISTS(SELECT 1 FROM public.bfe_shuttles WHERE driver_id=auth.uid() AND active);
$$;
CREATE OR REPLACE FUNCTION public.bfe_shuttle_available(p_driver uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT 'driver'=ANY(public.bfe_roles_for(p_driver)) AND coalesce(public.bfe_tab_mode_for(p_driver,'transport','own'),'edit')='edit' AND EXISTS(SELECT 1 FROM public.bfe_shuttles s WHERE s.driver_id=p_driver AND s.active AND s.on_duty AND s.last_seen>now()-interval '2 minutes');
$$;
CREATE OR REPLACE FUNCTION public.bfe_lot_read(p_lot uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.bfe_lots l JOIN public.bfe_import_batches b ON b.id=l.batch_id WHERE l.id=p_lot AND b.status='active' AND
 (public.bfe_registry_staff() OR public.bfe_can('finance','view','association') OR (public.bfe_lot_link(l.id) AND coalesce(public.bfe_tab_mode_for(auth.uid(),'property','own'),'edit')<>'hidden')));
$$;
CREATE TRIGGER bfe_guard_tab_write BEFORE INSERT OR UPDATE OR DELETE ON public.bfe_lot_memberships FOR EACH ROW EXECUTE FUNCTION public.bfe_guard_tab_write();
NOTIFY pgrst,'reload schema';COMMIT;
