-- Owner-run AFTER 075. Diagnostic information only: existing link authority,
-- mutation permissions and account/property data are unchanged.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$
DECLARE body text;
BEGIN
 SELECT prosrc INTO body FROM pg_proc
 WHERE oid=to_regprocedure('public.bfe_office_member_workspace(text,integer)')
  AND prosecdef AND provolatile='s';
 IF body IS NULL OR md5(regexp_replace(body,'[[:space:]]','','g')) IS DISTINCT FROM '937a80be7295ca7c664263c3acb97bc1' THEN
  RAISE EXCEPTION 'Member workspace differs from migration 046. No changes applied; inspect the installed definition first.';
 END IF;
END;$guard$;

CREATE OR REPLACE FUNCTION public.bfe_office_member_workspace(p_member text,p_page integer DEFAULT 0) RETURNS jsonb
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
  'link_block_reason',CASE
   WHEN NOT properties_allowed OR NOT public.bfe_can('property','manage','association') THEN 'property_permission'
   WHEN m.user_id=auth.uid() THEN 'self_review'
   WHEN m.user_id IS NULL THEN 'no_sign_in_account'
   WHEN NOT EXISTS(SELECT 1 FROM auth.users WHERE id=m.user_id) THEN 'missing_sign_in_account'
   WHEN cardinality(public.bfe_roles_for(m.user_id))=0 THEN 'inactive_account'
   WHEN (SELECT count(*) FROM public.members WHERE user_id=m.user_id)<>1 THEN 'duplicate_account'
   ELSE NULL END,
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
NOTIFY pgrst,'reload schema';
COMMIT;
