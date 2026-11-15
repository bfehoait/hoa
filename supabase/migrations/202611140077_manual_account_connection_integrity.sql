-- Owner-run after 075. Migration 076 is diagnostic-only and is not required.
-- No existing account is repaired or claimed by this migration.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_account_connection_repairs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 member_id text NOT NULL,
 target_id uuid NOT NULL,
 review_reference text NOT NULL CHECK(char_length(btrim(review_reference)) BETWEEN 3 AND 200),
 database_actor text NOT NULL DEFAULT session_user,
 repaired_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bfe_account_connection_repairs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_account_connection_repairs FROM PUBLIC,anon,authenticated;
DO $guard$
DECLARE body text;
BEGIN
 SELECT prosrc INTO body FROM pg_proc
 WHERE oid=to_regprocedure('public.bfe_manual_account_preflight(uuid,uuid,text)') AND prosecdef;
 IF body IS NULL OR md5(regexp_replace(body,'[[:space:]]','','g')) IS DISTINCT FROM '96d99de008c456d0def49e9ab193970d' THEN
  RAISE EXCEPTION 'Account preflight differs from migration 025. No changes applied; inspect the installed definition.';
 END IF;
END;$guard$;

CREATE OR REPLACE FUNCTION public.bfe_manual_account_preflight(p_actor uuid,p_request uuid,p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.bfe_manual_account_receipts;
BEGIN
 IF coalesce(auth.role(),'')<>'service_role' THEN
  RAISE EXCEPTION 'Service required.' USING ERRCODE='42501';
 END IF;
 IF NOT public.bfe_can_create_manual_account(p_actor) THEN
  RAISE EXCEPTION 'Account creation is not allowed.' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_trigger
  WHERE tgrelid='auth.users'::regclass AND tgname='bfe_manual_auth_account_link' AND tgenabled IN ('O','A')
   AND tgfoid=to_regprocedure('public.bfe_link_manual_auth_account()') AND tgdeferrable AND tginitdeferred) THEN
  RAISE EXCEPTION 'Account linking is not installed.' USING ERRCODE='55000';
 END IF;
 IF p_request IS NULL OR p_email IS NULL OR char_length(p_email) NOT BETWEEN 3 AND 200 THEN
  RAISE EXCEPTION 'Invalid account details.' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v FROM public.bfe_manual_account_receipts WHERE request_id=p_request;
 IF FOUND THEN
  IF v.actor_id<>p_actor OR NOT EXISTS(
   SELECT 1 FROM auth.users WHERE id=v.target_id AND lower(email)=lower(btrim(p_email))
  ) THEN RAISE EXCEPTION 'Submission reference already used.' USING ERRCODE='22023'; END IF;
  IF (SELECT count(*) FROM public.members WHERE user_id=v.target_id)<>1
   OR NOT EXISTS(SELECT 1 FROM public.members WHERE user_id=v.target_id
     AND lower(btrim(email))=lower(btrim(p_email)) AND status='Active')
   OR cardinality(public.bfe_roles_for(v.target_id))=0 THEN
   RAISE EXCEPTION 'The sign-in account and member connection need review.' USING ERRCODE='55000';
  END IF;
  RETURN jsonb_build_object('created',true,'member_linked',true,'user_id',v.target_id);
 END IF;
 IF EXISTS(SELECT 1 FROM public.members WHERE lower(btrim(email))=lower(btrim(p_email)))
 OR EXISTS(SELECT 1 FROM auth.users WHERE lower(btrim(email))=lower(btrim(p_email))) THEN
  RAISE EXCEPTION 'An account or member record already uses this email. Review the existing record.' USING ERRCODE='23505';
 END IF;
 RETURN jsonb_build_object('created',false);
END;
$$;

-- Deferred checks inspect the final committed state, so creation and approved
-- Auth deletion can update their dependent rows within a single transaction.
CREATE FUNCTION public.bfe_assert_manual_account_connection(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE managed boolean;
BEGIN
 IF p_user IS NULL THEN RETURN; END IF;
 SELECT raw_app_meta_data ? 'bfe_manual_account' INTO managed FROM auth.users WHERE id=p_user FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF; -- Auth deletion retains its established flow.
 IF NOT coalesce(managed,false) AND NOT EXISTS(
  SELECT 1 FROM public.bfe_manual_account_receipts WHERE target_id=p_user
 ) THEN RETURN; END IF;
 IF (SELECT count(*) FROM public.members WHERE user_id=p_user)<>1
  OR NOT EXISTS(SELECT 1 FROM public.bfe_manual_account_receipts WHERE target_id=p_user) THEN
  RAISE EXCEPTION 'A portal-created sign-in account must have exactly one connected member and a creation receipt.' USING ERRCODE='23514';
 END IF;
END;$$;

CREATE FUNCTION public.bfe_manual_connection_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='users' THEN
  PERFORM public.bfe_assert_manual_account_connection(NEW.id);
 ELSE
  IF TG_OP<>'INSERT' THEN PERFORM public.bfe_assert_manual_account_connection(OLD.user_id); END IF;
  IF TG_OP<>'DELETE' THEN PERFORM public.bfe_assert_manual_account_connection(NEW.user_id); END IF;
 END IF;
 RETURN NULL;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_assert_manual_account_connection(uuid),public.bfe_manual_connection_guard() FROM PUBLIC,anon,authenticated;

CREATE CONSTRAINT TRIGGER bfe_z_manual_connection_auth
 AFTER INSERT ON auth.users DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION public.bfe_manual_connection_guard();
CREATE CONSTRAINT TRIGGER bfe_z_manual_connection_member
 AFTER INSERT OR UPDATE OR DELETE ON public.members DEFERRABLE INITIALLY DEFERRED
 FOR EACH ROW EXECUTE FUNCTION public.bfe_manual_connection_guard();
NOTIFY pgrst,'reload schema';
COMMIT;
