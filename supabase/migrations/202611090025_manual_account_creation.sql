-- Apply after 024. No accounts are created by this migration.
-- The Edge Function uses Auth Admin createUser; this trigger makes the member
-- link and audit part of the SAME transaction as the new Auth user.
-- Existing accounts are never claimed, changed or linked by this workflow.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE TABLE public.bfe_manual_account_receipts (
 request_id uuid PRIMARY KEY,
 actor_id uuid NOT NULL,
 target_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bfe_manual_account_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_manual_account_receipts FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_can_create_manual_account(p_actor uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce('developer'=ANY(public.bfe_roles_for(p_actor)) OR (
  'admin'=ANY(public.bfe_roles_for(p_actor))
  AND EXISTS(SELECT 1 FROM public.bfe_access_managers WHERE user_id=p_actor AND active)
  AND public.bfe_can_for(p_actor,'people','view','association')
  AND public.bfe_can_for(p_actor,'people','create','association')
 ),false);
$$;
REVOKE ALL ON FUNCTION public.bfe_can_create_manual_account(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_manual_account_options() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('enabled',public.bfe_can_create_manual_account(auth.uid()));
$$;
REVOKE ALL ON FUNCTION public.bfe_manual_account_options() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_manual_account_options() TO authenticated;

-- Service-only preflight: validates the CALLER supplied by verified getUser(),
-- never trusts a browser actor ID. A completed request is safe to retry.
CREATE FUNCTION public.bfe_manual_account_preflight(p_actor uuid,p_request uuid,p_email text)
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
  WHERE tgrelid='auth.users'::regclass AND tgname='bfe_manual_auth_account_link' AND tgenabled IN ('O','A')) THEN
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
  RETURN jsonb_build_object('created',true,'user_id',v.target_id);
 END IF;
 IF EXISTS(SELECT 1 FROM public.members WHERE lower(btrim(email))=lower(btrim(p_email)))
 OR EXISTS(SELECT 1 FROM auth.users WHERE lower(btrim(email))=lower(btrim(p_email))) THEN
  RAISE EXCEPTION 'An account or member record already uses this email. Review the existing record.' USING ERRCODE='23505';
 END IF;
 RETURN jsonb_build_object('created',false);
END;
$$;
REVOKE ALL ON FUNCTION public.bfe_manual_account_preflight(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_manual_account_preflight(uuid,uuid,text) TO service_role;

CREATE FUNCTION public.bfe_link_manual_auth_account() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v jsonb; v_auth auth.users;
 v_actor uuid; v_request uuid; v_name text; v_unit text; v_role text;
 v_reason text; v_old_setting text; v_member public.members;
BEGIN
 -- Auth Admin writes app metadata and confirmation after the initial INSERT.
 -- This deferred trigger reads the final row at transaction end, not the
 -- INSERT snapshot, so it can validate and link atomically before commit.
 SELECT * INTO v_auth FROM auth.users WHERE id=NEW.id;
 v:=v_auth.raw_app_meta_data->'bfe_manual_account';
 -- raw_app_meta_data is server-owned; user_metadata is never authority.
 IF v IS NULL THEN RETURN NEW; END IF;
 v_actor:=(v->>'actor_id')::uuid;
 v_request:=(v->>'request_id')::uuid;
 v_name:=btrim(v->>'name'); v_unit:=btrim(v->>'unit');
 v_role:=v->>'role'; v_reason:=btrim(v->>'reason');
 IF v_actor IS NULL OR v_request IS NULL OR NEW.email IS NULL
 OR char_length(NEW.email)>200 OR v_auth.email_confirmed_at IS NULL
 OR v_name IS NULL OR char_length(v_name) NOT BETWEEN 1 AND 120
 OR v_unit IS NULL OR char_length(v_unit)>40
 OR v_role IS NULL OR v_role NOT IN ('admin','homeowner','renter','board','security','driver')
 OR (v_role IN ('homeowner','renter') AND v_unit='')
 OR v_reason IS NULL OR char_length(v_reason) NOT BETWEEN 3 AND 200 THEN
  RAISE EXCEPTION 'Invalid manual account details.' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('bfe-developer-role-changes',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('bfe-manual-account:'||v_actor::text,0));
 IF NOT public.bfe_can_create_manual_account(v_actor) THEN
  RAISE EXCEPTION 'Account creation is not allowed.' USING ERRCODE='42501';
 END IF;
 IF (SELECT count(*) FROM public.bfe_manual_account_receipts
     WHERE actor_id=v_actor AND created_at>now()-interval '1 minute')>=5 THEN
  RAISE EXCEPTION 'Please wait before creating another account.' USING ERRCODE='P0001';
 END IF;
 IF EXISTS(SELECT 1 FROM public.members WHERE lower(btrim(email))=lower(btrim(NEW.email)) OR user_id=NEW.id) THEN
  RAISE EXCEPTION 'Existing member record needs review; no account was created.' USING ERRCODE='23505';
 END IF;
 v_old_setting:=coalesce(current_setting('app.claiming',true),'');
 PERFORM set_config('app.claiming','on',true);
 INSERT INTO public.members(id,user_id,name,email,unit,role,extra_roles,status)
 VALUES(gen_random_uuid()::text,NEW.id,v_name,lower(btrim(NEW.email)),nullif(v_unit,''),v_role,ARRAY[]::text[],'Active');
 PERFORM set_config('app.claiming',v_old_setting,true);
 SELECT * INTO v_member FROM public.members WHERE user_id=NEW.id;
 IF NOT FOUND OR v_member.role IS DISTINCT FROM v_role OR v_member.status IS DISTINCT FROM 'Active'
 OR v_member.name IS DISTINCT FROM v_name OR v_member.email IS DISTINCT FROM lower(btrim(NEW.email))
 OR v_member.unit IS DISTINCT FROM nullif(v_unit,'') OR coalesce(cardinality(v_member.extra_roles),0)<>0 THEN
  RAISE EXCEPTION 'The member guard did not accept the new account.' USING ERRCODE='42501';
 END IF;
 -- Match 014's delegation ceiling. A manager may not provision authority they
 -- do not hold, even when a role label is accepted by the form.
 IF NOT ('developer'=ANY(public.bfe_roles_for(v_actor))) AND EXISTS(
  SELECT 1 FROM unnest(ARRAY['overview','people','registrations','profiles','property','requests','messages','operations','finance','calendar','security','community','hotlines','livelihood','transport','documents','elections','reports','audit','access','profile','support','technical']) m
  CROSS JOIN unnest(ARRAY['view','summary','create','reply','status','assign','publish','approve','export','manage','monitor']) a
  CROSS JOIN unnest(ARRAY['own','approved','assigned','association']) s
  WHERE public.bfe_can_for(NEW.id,m,a,s) AND NOT public.bfe_can_for(v_actor,m,a,s)
 ) THEN RAISE EXCEPTION 'This role exceeds your management authority.' USING ERRCODE='42501'; END IF;
 INSERT INTO public.bfe_manual_account_receipts(request_id,actor_id,target_id) VALUES(v_request,v_actor,NEW.id);
 INSERT INTO public.bfe_account_audit(actor_id,target_id,action,details)
 VALUES(v_actor,NEW.id,'Manual account created',jsonb_build_object('role',v_role,'reference',v_reason,'request_id',v_request,'email_delivery','none'));
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.bfe_link_manual_auth_account() FROM PUBLIC,anon,authenticated;
CREATE CONSTRAINT TRIGGER bfe_manual_auth_account_link
AFTER INSERT ON auth.users DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.bfe_link_manual_auth_account();
NOTIFY pgrst,'reload schema';
COMMIT;
