-- Apply after 045. Office recorded-detail corrections and member workspace.
-- Property links reuse 037. No links, roles, login emails or receipts are seeded.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_member_detail_changes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), member_id text NOT NULL,
 actor_id uuid NOT NULL, before_values jsonb NOT NULL, after_values jsonb NOT NULL,
 reason text NOT NULL CHECK(char_length(reason) BETWEEN 3 AND 200),
 changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bfe_member_detail_changes_member ON public.bfe_member_detail_changes(member_id,changed_at DESC,id);
ALTER TABLE public.bfe_member_detail_changes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_member_detail_changes FROM PUBLIC,anon,authenticated;
CREATE INDEX IF NOT EXISTS bfe_registry_audit_membership_history ON public.bfe_registry_audit ((details->>'membership'),at DESC,id DESC) WHERE details ? 'membership';

CREATE FUNCTION public.bfe_office_member_workspace(p_member text,p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.members; result jsonb; manager boolean; history_allowed boolean; properties_allowed boolean;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT public.bfe_can('people','view','association') THEN RAISE EXCEPTION 'Office member access required.' USING ERRCODE='42501'; END IF;
 IF p_member IS NULL OR char_length(p_member) NOT BETWEEN 1 AND 120 OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Check member filters.' USING ERRCODE='22023'; END IF;
 SELECT * INTO m FROM public.members WHERE id::text=p_member;
 IF m.id IS NULL THEN RAISE EXCEPTION 'Member unavailable. Refresh the directory.' USING ERRCODE='22023'; END IF;
 manager:=public.bfe_can('people','manage','association') AND (NOT ('developer'=ANY(coalesce(m.extra_roles,'{}'::text[])) OR m.role='developer') OR 'developer'=ANY(public.bfe_current_roles()));
 history_allowed:=manager OR public.bfe_can('audit','view','association');
 properties_allowed:=public.bfe_can('property','view','association');
 SELECT jsonb_build_object(
  'member',jsonb_build_object('id',m.id,'user_id',m.user_id,'name',m.name,'email',m.email,'phone',m.phone,'unit',m.unit,'title',m.title,'role',m.role,'extra_roles',m.extra_roles,'status',m.status,'last_seen',m.last_seen),
  'expected',jsonb_build_object('id',m.id,'user_id',m.user_id,'name',m.name,'email',m.email,'phone',m.phone,'unit',m.unit,'title',m.title,'role',m.role,'extra_roles',m.extra_roles,'status',m.status),
  'auth_state',CASE WHEN m.user_id IS NULL THEN 'unlinked' WHEN NOT EXISTS(SELECT 1 FROM auth.users WHERE id=m.user_id) THEN 'missing' ELSE 'linked' END,
  'profile',(SELECT jsonb_build_object('display_name',p.display_name,'phone',p.phone,'updated_at',p.updated_at) FROM public.bfe_profiles p WHERE p.user_id=m.user_id),
  'can_edit',manager,'can_history',history_allowed,'can_view_properties',properties_allowed,
  'can_link',properties_allowed AND public.bfe_can('property','manage','association') AND m.user_id IS NOT NULL AND m.user_id<>auth.uid() AND cardinality(public.bfe_roles_for(m.user_id))>0 AND EXISTS(SELECT 1 FROM auth.users WHERE id=m.user_id) AND (SELECT count(*) FROM public.members WHERE user_id=m.user_id)=1,
  'properties',(SELECT coalesce(jsonb_agg(jsonb_build_object('membership_id',r.id,'lot_id',r.lot_id,'physical_id',l.physical_id,'relationship',r.relationship,'state',r.state,'starts_at',r.starts_at,'expires_at',r.expires_at,'reference',r.reference,'active_import',b.status='active') ORDER BY l.physical_id,r.relationship,r.starts_at DESC),'[]'::jsonb)
    FROM public.bfe_lot_memberships r JOIN public.bfe_lots l ON l.id=r.lot_id JOIN public.bfe_import_batches b ON b.id=l.batch_id WHERE properties_allowed AND r.user_id=m.user_id),
  'history',(SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY h.changed_at DESC,h.id),'[]'::jsonb) FROM (
    SELECT c.id,c.actor_id,coalesce((SELECT name FROM public.members WHERE user_id=c.actor_id LIMIT 1),'Office staff') AS actor_name,c.before_values,c.after_values,c.reason,c.changed_at FROM public.bfe_member_detail_changes c WHERE history_allowed AND c.member_id=p_member ORDER BY c.changed_at DESC,c.id OFFSET p_page*20 LIMIT 20
   ) h),
  'link_history',(SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY h.at DESC,h.id::bigint DESC),'[]'::jsonb) FROM (
    SELECT a.id::text,a.at,a.action,coalesce(a.details->>'reference','') AS reference,coalesce((SELECT name FROM public.members WHERE user_id=a.actor_id LIMIT 1),'Office staff') AS actor_name,l.physical_id,r.relationship
    FROM public.bfe_registry_audit a JOIN public.bfe_lot_memberships r ON a.lot_id=r.lot_id AND a.details->>'membership'=r.id::text JOIN public.bfe_lots l ON l.id=r.lot_id
    WHERE history_allowed AND properties_allowed AND a.details ? 'membership' AND r.user_id=m.user_id ORDER BY a.at DESC,a.id DESC LIMIT 50
   ) h),
  'history_total',(SELECT count(*) FROM public.bfe_member_detail_changes WHERE history_allowed AND member_id=p_member)
 ) INTO result;
 RETURN result;
END;$$;

CREATE FUNCTION public.bfe_update_member_details(p_member text,p_expected jsonb,p_name text,p_phone text,p_unit text,p_title text,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.members; snapshot jsonb; before_values jsonb; after_values jsonb;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT public.bfe_can('people','view','association') OR NOT public.bfe_can('people','manage','association') THEN RAISE EXCEPTION 'Member detail management permission required.' USING ERRCODE='42501'; END IF;
 IF p_member IS NULL OR p_expected IS NULL OR p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 1 AND 120 OR p_name !~ '[^[:space:]]' OR p_phone IS NULL OR char_length(btrim(p_phone))>30 OR p_phone !~ '^[+0-9 () .-]*$' OR p_unit IS NULL OR char_length(btrim(p_unit))>40 OR p_title IS NULL OR char_length(btrim(p_title))>120 OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 3 AND 200 OR p_reason !~ '[^[:space:]]' THEN RAISE EXCEPTION 'Check the recorded name, phone, address, position and reason.' USING ERRCODE='22023'; END IF;
 SELECT * INTO m FROM public.members WHERE id::text=p_member FOR UPDATE;
 IF m.id IS NULL THEN RAISE EXCEPTION 'Member unavailable.' USING ERRCODE='22023'; END IF;
 IF ('developer'=ANY(coalesce(m.extra_roles,'{}'::text[])) OR m.role='developer') AND NOT ('developer'=ANY(public.bfe_current_roles())) THEN RAISE EXCEPTION 'Developer account details are protected.' USING ERRCODE='42501'; END IF;
 before_values:=jsonb_build_object('name',m.name,'phone',m.phone,'unit',m.unit,'title',m.title);
 after_values:=jsonb_build_object('name',btrim(p_name),'phone',btrim(p_phone),'unit',btrim(p_unit),'title',btrim(p_title));
 -- An identical repeat is safe and creates no second correction entry.
 IF before_values=after_values THEN RETURN public.bfe_office_member_workspace(p_member); END IF;
 snapshot:=jsonb_build_object('id',m.id,'user_id',m.user_id,'name',m.name,'email',m.email,'phone',m.phone,'unit',m.unit,'title',m.title,'role',m.role,'extra_roles',m.extra_roles,'status',m.status);
 IF snapshot IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Member changed. Refresh and review the latest details before saving.' USING ERRCODE='40001'; END IF;
 UPDATE public.members SET name=btrim(p_name),phone=btrim(p_phone),unit=btrim(p_unit),title=btrim(p_title) WHERE id=m.id;
 INSERT INTO public.bfe_member_detail_changes(member_id,actor_id,before_values,after_values,reason) VALUES(p_member,auth.uid(),before_values,after_values,btrim(p_reason));
 IF m.user_id IS NOT NULL THEN
  INSERT INTO public.bfe_account_audit(actor_id,target_id,action,details) VALUES(auth.uid(),m.user_id,'Recorded member details corrected',jsonb_build_object('member_id',p_member,'changed_fields',(SELECT jsonb_agg(k) FROM jsonb_object_keys(after_values) k WHERE before_values->k IS DISTINCT FROM after_values->k)));
  INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(m.user_id,'account','Recorded details updated','Office corrected your recorded member details. Contact the office if you need clarification.','/more/profile','member-details:'||gen_random_uuid()::text);
 END IF;
 RETURN public.bfe_office_member_workspace(p_member);
END;$$;
CREATE FUNCTION public.bfe_office_link_member_property(p_member text,p_expected jsonb,p_lot uuid,p_lot_version integer,p_relationship text,p_reference text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.members; target uuid; snapshot jsonb; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT public.bfe_can('people','view','association') OR NOT public.bfe_can('property','view','association') OR NOT public.bfe_can('property','manage','association') THEN RAISE EXCEPTION 'Account and property review permissions required.' USING ERRCODE='42501'; END IF;
 SELECT user_id INTO target FROM public.members WHERE id::text=p_member;
 IF target IS NULL THEN RAISE EXCEPTION 'An active sign-in account must be linked first.' USING ERRCODE='22023'; END IF;
 -- Match 037's lock order, then bind the action to the selected directory row.
 PERFORM pg_advisory_xact_lock(hashtextextended('account-lot-link:'||target::text,0));
 SELECT * INTO m FROM public.members WHERE id::text=p_member FOR UPDATE;
 snapshot:=jsonb_build_object('id',m.id,'user_id',m.user_id,'name',m.name,'email',m.email,'phone',m.phone,'unit',m.unit,'title',m.title,'role',m.role,'extra_roles',m.extra_roles,'status',m.status);
 IF m.id IS NULL OR m.user_id IS DISTINCT FROM target OR snapshot IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Member changed. Refresh the member before linking.' USING ERRCODE='40001'; END IF;
 IF (SELECT count(*) FROM public.members WHERE user_id=target)<>1 THEN RAISE EXCEPTION 'Account identity is ambiguous. Review the member record first.' USING ERRCODE='22023'; END IF;
 result:=public.bfe_link_account_lot(target,p_lot,jsonb_build_object('user_id',m.user_id,'name',m.name,'unit',m.unit,'role',m.role,'extra_roles',m.extra_roles,'status',m.status),p_lot_version,p_relationship,p_reference);
 IF NOT (result->>'already_linked')::boolean THEN
  INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(target,'account','Property relationship confirmed','Office recorded your verified account–lot relationship. Historical receipt access is reviewed separately.','/more/notifications','office-property-link:'||(result->>'membership_id')) ON CONFLICT(recipient_id,event_key) DO NOTHING;
 END IF;
 RETURN result;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_office_member_workspace(text,integer),public.bfe_update_member_details(text,jsonb,text,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_office_member_workspace(text,integer),public.bfe_update_member_details(text,jsonb,text,text,text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.bfe_office_link_member_property(text,jsonb,uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_office_link_member_property(text,jsonb,uuid,integer,text,text) TO authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
