-- Apply after 062. Optional private health notes and simplified registration.
-- Health notes are not profile bios, directory fields or notification content.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_private_health_notes (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id), note text NOT NULL DEFAULT '' CHECK(char_length(note)<=1000),
 version integer NOT NULL DEFAULT 1 CHECK(version>0), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bfe_private_health_notes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_private_health_notes FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bfe_private_health_note(p_target uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid:=coalesce(p_target,auth.uid()); r public.bfe_private_health_notes;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT (
  (target=auth.uid() AND public.bfe_can('profile','view','own')) OR
  ('admin'=ANY(public.bfe_current_roles()) AND public.bfe_can('people','view','association') AND public.bfe_can('people','manage','association'))
 ) THEN RAISE EXCEPTION 'Private health-note access required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.bfe_private_health_notes WHERE user_id=target;
 RETURN jsonb_build_object('note',coalesce(r.note,''),'version',coalesce(r.version,0),'can_edit',target=auth.uid() AND public.bfe_can('profile','create','own'));
END;$$;
CREATE FUNCTION public.bfe_save_private_health_note(p_version integer,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_private_health_notes;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT public.bfe_can('profile','view','own') OR NOT public.bfe_can('profile','create','own') THEN RAISE EXCEPTION 'Own profile access required.' USING ERRCODE='42501'; END IF;
 IF p_note IS NULL OR char_length(p_note)>1000 OR p_version IS NULL OR p_version<0 THEN RAISE EXCEPTION 'Use up to 1000 characters.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('private-health:'||auth.uid()::text,0));
 SELECT * INTO r FROM public.bfe_private_health_notes WHERE user_id=auth.uid() FOR UPDATE;
 IF r.note=btrim(p_note) AND (r.version=p_version OR r.version=p_version+1) THEN RETURN; END IF;
 IF coalesce(r.version,0)<>p_version THEN RAISE EXCEPTION 'Health note changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
 INSERT INTO public.bfe_private_health_notes(user_id,note) VALUES(auth.uid(),btrim(p_note))
 ON CONFLICT(user_id) DO UPDATE SET note=EXCLUDED.note,version=public.bfe_private_health_notes.version+1,updated_at=now();
END;$$;
REVOKE ALL ON FUNCTION public.bfe_private_health_note(uuid),public.bfe_save_private_health_note(integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_private_health_note(uuid),public.bfe_save_private_health_note(integer,text) TO authenticated;

CREATE FUNCTION public.bfe_copy_registration_health_note() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='Approved' AND NEW.bfe_user_id IS NOT NULL AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.bfe_user_id IS DISTINCT FROM NEW.bfe_user_id)
 AND nullif(btrim(NEW.bfe_details->>'healthNote'),'') IS NOT NULL THEN
  INSERT INTO public.bfe_private_health_notes(user_id,note) VALUES(NEW.bfe_user_id,btrim(NEW.bfe_details->>'healthNote')) ON CONFLICT(user_id) DO NOTHING;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_copy_registration_health_note() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bfe_copy_registration_health_note AFTER UPDATE OF status,bfe_user_id ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.bfe_copy_registration_health_note();

-- The guarded application-function patch is appended below. It retains
-- rate limits, idempotency and the existing independent approval path.

DO $registration$
DECLARE body text; definition text; changed text;
BEGIN
 SELECT prosrc,pg_get_functiondef(oid) INTO body,definition FROM pg_proc WHERE oid=to_regprocedure('public.bfe_apply_for_membership(jsonb)') AND prosecdef;
 IF md5(regexp_replace(body,'[[:space:]]','','g')) IS DISTINCT FROM 'daa692163c8414d118139ea807cb66e8' OR position(body IN definition)=0 THEN RAISE EXCEPTION 'Registration service differs from reviewed migration 028. No changes applied; inspect it first.'; END IF;
 changed:=replace(body,$old$'proofRef','note','senior'$old$,$new$'proofRef','note','healthNote','senior'$new$);
 changed:=replace(changed,$old$OR coalesce(length(btrim(p_fields->>'proof')),0) NOT BETWEEN 1 AND 60$old$,$new$OR coalesce(length(btrim(p_fields->>'proof')),0)>60$new$);
 changed:=replace(changed,$old$OR coalesce(length(btrim(p_fields->>'proofRef')),0) NOT BETWEEN 1 AND 120$old$,$new$OR coalesce(length(btrim(p_fields->>'proofRef')),0)>120$new$);
 changed:=replace(changed,$old$btrim(p_fields->>'proof'),btrim(p_fields->>'proofRef')$old$,$new$btrim(coalesce(p_fields->>'proof','')),btrim(coalesce(p_fields->>'proofRef',''))$new$);
 changed:=replace(changed,$old$IF jsonb_array_length(p_fields->'household')>20$old$,$new$IF (p_fields ? 'healthNote') AND (jsonb_typeof(p_fields->'healthNote') IS DISTINCT FROM 'string' OR char_length(p_fields->>'healthNote')>1000) THEN RAISE EXCEPTION 'Check the optional health note.' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_fields->'household')>20$new$);
 IF changed=body OR position('optional health note' IN changed)=0 OR position('healthNote' IN changed)=0 THEN RAISE EXCEPTION 'Registration patch could not be applied safely.'; END IF;
 EXECUTE replace(definition,body,changed);
END;$registration$;
NOTIFY pgrst,'reload schema'; COMMIT;
