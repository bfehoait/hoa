-- Apply once after 025. No existing account is deleted by this migration.
-- Auth Admin performs deletion; the BEFORE DELETE trigger cleans the member
-- only inside that same transaction. Linked operational/history rows block it.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE TABLE public.bfe_account_deletion_requests (
 request_id uuid PRIMARY KEY, actor_id uuid NOT NULL, target_id uuid NOT NULL,
 expected jsonb NOT NULL, reason text NOT NULL,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','completed','expired')),
 created_at timestamptz NOT NULL DEFAULT now()
);
-- No Auth FK: completed receipts and audit references survive deletion.
CREATE UNIQUE INDEX bfe_one_pending_account_deletion ON public.bfe_account_deletion_requests(target_id) WHERE state='pending';
ALTER TABLE public.bfe_account_deletion_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_account_deletion_requests FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_can_delete_account(p_actor uuid,p_target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(p_actor<>p_target AND cardinality(public.bfe_roles_for(p_actor))>0
  AND EXISTS(SELECT 1 FROM public.members m WHERE m.user_id=p_target
    AND m.role<>'developer' AND NOT ('developer'=ANY(coalesce(m.extra_roles,ARRAY[]::text[]))))
  AND ('developer'=ANY(public.bfe_roles_for(p_actor)) OR (
    'admin'=ANY(public.bfe_roles_for(p_actor))
    AND EXISTS(SELECT 1 FROM public.bfe_access_managers WHERE user_id=p_actor AND active)
    AND public.bfe_can_for(p_actor,'people','view','association')
    AND public.bfe_can_for(p_actor,'people','manage','association')
    AND NOT EXISTS(SELECT 1 FROM public.bfe_access_managers WHERE user_id=p_target AND active)
    AND NOT EXISTS(
      SELECT 1 FROM unnest(ARRAY['overview','people','registrations','profiles','property','requests','messages','operations','finance','calendar','security','community','hotlines','livelihood','transport','documents','elections','reports','audit','access','profile','support','technical']) m
      CROSS JOIN unnest(ARRAY['view','summary','create','reply','status','assign','publish','approve','export','manage','monitor']) a
      CROSS JOIN unnest(ARRAY['own','approved','assigned','association']) s
      WHERE public.bfe_can_for(p_target,m,a,s) AND NOT public.bfe_can_for(p_actor,m,a,s)
    )
  )),false);
$$;
REVOKE ALL ON FUNCTION public.bfe_can_delete_account(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_account_delete_options(p_target uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('enabled',public.bfe_can_delete_account(auth.uid(),p_target));
$$;
REVOKE ALL ON FUNCTION public.bfe_account_delete_options(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_account_delete_options(uuid) TO authenticated;

CREATE FUNCTION public.bfe_prepare_account_deletion(p_actor uuid,p_target uuid,p_request uuid,p_expected jsonb,p_confirmation text,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.members; r public.bfe_account_deletion_requests; snapshot jsonb;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN RAISE EXCEPTION 'Service required.' USING ERRCODE='42501'; END IF;
 IF p_actor=p_target OR cardinality(public.bfe_roles_for(p_actor))=0 THEN RAISE EXCEPTION 'Not allowed.' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('bfe-developer-role-changes',0));
 SELECT * INTO r FROM public.bfe_account_deletion_requests WHERE request_id=p_request;
 IF FOUND THEN
  IF r.actor_id<>p_actor OR r.target_id<>p_target OR r.expected IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'Submission reference already used.' USING ERRCODE='22023';
  END IF;
  IF r.state='completed' THEN RETURN jsonb_build_object('deleted',true); END IF;
  IF r.state<>'pending' OR r.created_at<now()-interval '10 minutes' THEN
    RAISE EXCEPTION 'Deletion confirmation expired. Reopen the account.' USING ERRCODE='40001';
  END IF;
 END IF;
 IF NOT public.bfe_can_delete_account(p_actor,p_target) THEN RAISE EXCEPTION 'Not allowed.' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT v FROM public.members WHERE user_id=p_target FOR UPDATE;
 snapshot:=jsonb_build_object('name',v.name,'unit',v.unit,'role',v.role,'extra_roles',v.extra_roles,'status',v.status);
 IF snapshot IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Account changed. Reopen it.' USING ERRCODE='40001'; END IF;
 IF p_request IS NULL OR v.name IS NULL OR p_confirmation IS DISTINCT FROM v.name
 OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 3 AND 200 THEN
  RAISE EXCEPTION 'Confirm the member name and enter a reason.' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='bfe_delete_member_with_auth' AND tgenabled IN ('O','A')) THEN
  RAISE EXCEPTION 'Deletion setup incomplete.' USING ERRCODE='55000';
 END IF;
 UPDATE public.bfe_account_deletion_requests SET state='expired' WHERE target_id=p_target AND state='pending' AND created_at<now()-interval '10 minutes';
 INSERT INTO public.bfe_account_deletion_requests(request_id,actor_id,target_id,expected,reason)
 VALUES(p_request,p_actor,p_target,p_expected,btrim(p_reason)) ON CONFLICT(request_id) DO NOTHING;
 RETURN jsonb_build_object('deleted',false);
END;
$$;
REVOKE ALL ON FUNCTION public.bfe_prepare_account_deletion(uuid,uuid,uuid,jsonb,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_prepare_account_deletion(uuid,uuid,uuid,jsonb,text,text) TO service_role;

CREATE FUNCTION public.bfe_delete_member_with_auth() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_account_deletion_requests; v public.members; fk record;
 blocked boolean; key_value text; snapshot jsonb; setting text;
BEGIN
 -- Ordinary owner-managed Auth deletions outside this workflow retain their
 -- existing behavior. Only a live, prepared deletion enters this cleanup.
 SELECT * INTO r FROM public.bfe_account_deletion_requests
 WHERE target_id=OLD.id AND state='pending' FOR UPDATE;
 IF NOT FOUND THEN
  IF EXISTS(SELECT 1 FROM public.bfe_account_deletion_requests WHERE target_id=OLD.id) THEN
   RAISE EXCEPTION 'Deletion confirmation expired. Reopen the account.' USING ERRCODE='40001';
  END IF;
  RETURN OLD;
 END IF;
 IF r.created_at<now()-interval '10 minutes' THEN
  RAISE EXCEPTION 'Deletion confirmation expired. Reopen the account.' USING ERRCODE='40001';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('bfe-developer-role-changes',0));
 IF NOT public.bfe_can_delete_account(r.actor_id,OLD.id) THEN RAISE EXCEPTION 'Deletion authority changed.' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT v FROM public.members WHERE user_id=OLD.id FOR UPDATE;
 snapshot:=jsonb_build_object('name',v.name,'unit',v.unit,'role',v.role,'extra_roles',v.extra_roles,'status',v.status);
 IF snapshot IS DISTINCT FROM r.expected THEN RAISE EXCEPTION 'Account changed. Reopen it.' USING ERRCODE='40001'; END IF;
 -- Check actual installed foreign keys, including CASCADE/SET NULL ones.
 -- Never erase or detach operational records just to remove a login.
 FOR fk IN
  SELECT n.nspname,c.relname,a.attname,parent.attname AS parent_key,k.confrelid,k.conkey,k.confkey
  FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
  JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=k.conkey[1]
  JOIN pg_attribute parent ON parent.attrelid=k.confrelid AND parent.attnum=k.confkey[1]
  WHERE k.contype='f' AND k.confrelid IN ('auth.users'::regclass,'public.members'::regclass)
  AND n.nspname<>'auth'
  AND NOT (n.nspname='public' AND c.relname IN ('members','bfe_profiles','bfe_notifications','bfe_manual_account_receipts'))
 LOOP
  IF cardinality(fk.conkey)<>1 OR cardinality(fk.confkey)<>1 THEN
    RAISE EXCEPTION 'Account relationships need owner review. Suspend this account instead.' USING ERRCODE='23503';
  END IF;
  key_value:=CASE WHEN fk.confrelid='auth.users'::regclass THEN to_jsonb(OLD)->>fk.parent_key ELSE to_jsonb(v)->>fk.parent_key END;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I::text=$1)',fk.nspname,fk.relname,fk.attname) INTO blocked USING key_value;
  IF blocked THEN RAISE EXCEPTION 'Linked records must be retained. Suspend this account instead.' USING ERRCODE='23503'; END IF;
 END LOOP;
 IF to_regclass('storage.objects') IS NOT NULL THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM storage.objects o WHERE to_jsonb(o)->>''owner_id''=$1 OR to_jsonb(o)->>''owner''=$1)' INTO blocked USING OLD.id::text;
  IF blocked THEN RAISE EXCEPTION 'Uploaded files must be retained. Suspend this account instead.' USING ERRCODE='23503'; END IF;
 END IF;
 -- Profile preferences and notifications are account-only metadata. Audit,
 -- requests, statements, memberships and operational records are retained.
 DELETE FROM public.bfe_profiles WHERE user_id=OLD.id;
 DELETE FROM public.bfe_notifications WHERE recipient_id=OLD.id;
 DELETE FROM public.bfe_tab_rules WHERE subject_kind='user' AND subject_id=OLD.id::text;
 setting:=coalesce(current_setting('app.claiming',true),'');
 PERFORM set_config('app.claiming','on',true);
 DELETE FROM public.members WHERE user_id=OLD.id;
 PERFORM set_config('app.claiming',setting,true);
 IF EXISTS(SELECT 1 FROM public.members WHERE user_id=OLD.id) THEN RAISE EXCEPTION 'Member deletion was refused.' USING ERRCODE='42501'; END IF;
 UPDATE public.bfe_account_deletion_requests SET state='completed' WHERE request_id=r.request_id;
 INSERT INTO public.bfe_account_audit(actor_id,target_id,action,details)
 VALUES(r.actor_id,OLD.id,'Account deleted',jsonb_build_object('reference',r.reason,'request_id',r.request_id));
 RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.bfe_delete_member_with_auth() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bfe_delete_member_with_auth BEFORE DELETE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.bfe_delete_member_with_auth();
NOTIFY pgrst,'reload schema';
COMMIT;
