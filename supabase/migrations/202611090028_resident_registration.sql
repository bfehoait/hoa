-- Extends the existing registrations table. Does not create an Auth account
-- until authorized office staff review the application and issue credentials.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
ALTER TABLE public.registrations ADD COLUMN bfe_client_id uuid UNIQUE,
 ADD COLUMN bfe_details jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN bfe_version integer NOT NULL DEFAULT 1,
 ADD COLUMN bfe_user_id uuid REFERENCES auth.users(id);
-- Sensitive applicant/household details are read only through staff RPCs.
REVOKE ALL ON public.registrations FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_apply_for_membership(p_fields jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e text:=lower(btrim(p_fields->>'email')); client uuid; role text; u text; person jsonb;
BEGIN
 IF p_fields IS NULL OR jsonb_typeof(p_fields)<>'object' OR octet_length(p_fields::text)>24000
 OR coalesce(p_fields->>'website','x')<>'' OR p_fields->>'consent' IS DISTINCT FROM 'true'
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_fields) k WHERE k NOT IN ('clientId','name','email','phone','role','phase','block','lot','street','ownerName','proof','proofRef','note','senior','pwd','household','consent','website')) THEN
 RAISE EXCEPTION 'Check the application.' USING ERRCODE='22023'; END IF;
 client:=(p_fields->>'clientId')::uuid; role:=p_fields->>'role';
 IF client IS NULL OR e IS NULL OR length(e)>200 OR e!~'^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 OR coalesce(length(btrim(p_fields->>'name')),0) NOT BETWEEN 1 AND 120
 OR coalesce(length(btrim(p_fields->>'phone')),0) NOT BETWEEN 7 AND 40
 OR role IS NULL OR role NOT IN ('homeowner','renter')
 OR coalesce((p_fields->>'phase')::integer,0) NOT BETWEEN 1 AND 99
 OR coalesce((p_fields->>'block')::integer,0) NOT BETWEEN 1 AND 999
 OR coalesce((p_fields->>'lot')::integer,0) NOT BETWEEN 1 AND 9999
 OR coalesce(length(btrim(p_fields->>'ownerName')),0) NOT BETWEEN 1 AND 120
 OR coalesce(length(btrim(p_fields->>'proof')),0) NOT BETWEEN 1 AND 60
 OR coalesce(length(btrim(p_fields->>'proofRef')),0) NOT BETWEEN 1 AND 120
 OR coalesce(length(p_fields->>'street'),0)>120 OR coalesce(length(p_fields->>'note'),0)>1000
 OR coalesce(p_fields->>'senior','') NOT IN ('not_provided','yes','no')
 OR coalesce(p_fields->>'pwd','') NOT IN ('not_provided','yes','no')
 OR jsonb_typeof(p_fields->'household') IS DISTINCT FROM 'array' THEN
 RAISE EXCEPTION 'Check the name, contact, address and household details.' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_fields->'household')>20 THEN RAISE EXCEPTION 'List at most 20 household members.' USING ERRCODE='22023'; END IF;
 FOR person IN SELECT value FROM jsonb_array_elements(p_fields->'household') LOOP
  IF jsonb_typeof(person)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(person) k WHERE k NOT IN ('name','relationship','phone','senior','pwd'))
  OR coalesce(length(btrim(person->>'name')),0) NOT BETWEEN 1 AND 120
  OR coalesce(length(btrim(person->>'relationship')),0) NOT BETWEEN 1 AND 60
  OR coalesce(length(person->>'phone'),0)>40
  OR coalesce(person->>'senior','') NOT IN ('not_provided','yes','no') OR coalesce(person->>'pwd','') NOT IN ('not_provided','yes','no') THEN
   RAISE EXCEPTION 'Check each household member.' USING ERRCODE='22023'; END IF;
 END LOOP;
 PERFORM pg_advisory_xact_lock(hashtextextended('bfe-registration-application',0));
 -- Return the same receipt shape for existing email/client matches, avoiding
 -- a public account-existence oracle. Staff alone can inspect application state.
 IF EXISTS(SELECT 1 FROM public.registrations WHERE bfe_client_id=client OR lower(btrim(email))=e)
 OR EXISTS(SELECT 1 FROM public.members WHERE lower(btrim(email))=e)
 OR EXISTS(SELECT 1 FROM auth.users WHERE lower(btrim(email))=e) THEN RETURN jsonb_build_object('received',true); END IF;
 IF (SELECT count(*) FROM public.registrations WHERE created_at>now()-interval '1 minute')>=20 THEN
  RAISE EXCEPTION 'Applications are busy. Please try again later.' USING ERRCODE='P0001'; END IF;
 u:='P'||(p_fields->>'phase')||' B'||(p_fields->>'block')||' L'||(p_fields->>'lot');
 INSERT INTO public.registrations(name,email,phone,unit,role,proof,proof_ref,owner_name,note,status,bfe_client_id,bfe_details)
 VALUES(btrim(p_fields->>'name'),e,btrim(p_fields->>'phone'),u,role,btrim(p_fields->>'proof'),btrim(p_fields->>'proofRef'),btrim(p_fields->>'ownerName'),btrim(p_fields->>'note'),'Pending',client,
 p_fields-ARRAY['clientId','email','name','phone','role','proof','proofRef','ownerName','note','website']);
 RETURN jsonb_build_object('received',true);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_apply_for_membership(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bfe_apply_for_membership(jsonb) TO anon,authenticated;

CREATE FUNCTION public.bfe_registration_detail(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.bfe_can('registrations','view','association') THEN RAISE EXCEPTION 'Registration review required.' USING ERRCODE='42501'; END IF;
 RETURN (SELECT jsonb_build_object('application',jsonb_build_object('id',id,'name',name,'email',email,'phone',phone,'unit',unit,'role',role,'status',status,'proof',proof,'proof_ref',proof_ref,'owner_name',owner_name,'note',note,'details',bfe_details,'version',bfe_version),'can_approve',public.bfe_can('registrations','approve','association') AND public.bfe_can_create_manual_account(auth.uid())) FROM public.registrations WHERE id=p_id);
END;$$;
CREATE FUNCTION public.bfe_reject_registration(p_id uuid,p_version integer,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.bfe_can('registrations','approve','association') THEN RAISE EXCEPTION 'Registration approval required.' USING ERRCODE='42501'; END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 5 AND 200 THEN RAISE EXCEPTION 'Enter a review reason.' USING ERRCODE='22023'; END IF;
 UPDATE public.registrations SET status='Rejected',review_note=btrim(p_reason),reviewed_by=auth.uid()::text,reviewed_at=now(),bfe_version=bfe_version+1 WHERE id=p_id AND status='Pending' AND bfe_version=p_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Application changed. Refresh it.' USING ERRCODE='40001'; END IF;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_registration_detail(uuid),public.bfe_reject_registration(uuid,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_registration_detail(uuid),public.bfe_reject_registration(uuid,integer,text) TO authenticated;

CREATE FUNCTION public.bfe_registration_account_approved() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE meta jsonb; actor uuid; application uuid; r public.registrations; m public.members; account auth.users;
BEGIN
 SELECT * INTO account FROM auth.users WHERE id=NEW.id;
 meta:=account.raw_app_meta_data->'bfe_manual_account';
 IF meta->>'registration_id' IS NULL THEN RETURN NEW; END IF;
 actor:=(meta->>'actor_id')::uuid; application:=(meta->>'registration_id')::uuid;
 IF NOT public.bfe_can_create_manual_account(actor) OR NOT public.bfe_can_for(actor,'registrations','approve','association') THEN RAISE EXCEPTION 'Registration approval required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT r FROM public.registrations WHERE id=application FOR UPDATE;
 SELECT * INTO STRICT m FROM public.members WHERE user_id=NEW.id;
 IF r.status IS DISTINCT FROM 'Pending' OR lower(btrim(r.email)) IS DISTINCT FROM lower(btrim(account.email)) OR r.role IS DISTINCT FROM m.role THEN RAISE EXCEPTION 'Application changed. Review it before creating an account.' USING ERRCODE='40001'; END IF;
 UPDATE public.registrations SET status='Approved',reviewed_by=actor::text,reviewed_at=now(),review_note='Verified by office; account created without email',bfe_version=bfe_version+1,bfe_user_id=NEW.id WHERE id=application;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_registration_account_approved() FROM PUBLIC,anon,authenticated;
-- Deferred trigger names run in order: manual member linking precedes this.
CREATE CONSTRAINT TRIGGER bfe_registration_account_approved AFTER INSERT ON auth.users DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.bfe_registration_account_approved();
NOTIFY pgrst,'reload schema'; COMMIT;
