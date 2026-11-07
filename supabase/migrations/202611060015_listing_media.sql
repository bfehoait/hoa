-- Apply once after 014. Member-only listing media, explicit optional public links, and re-review on edits.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_listing_assets(
 record_id uuid PRIMARY KEY REFERENCES public.bfe_feature_records(id),
 cover_path text UNIQUE,links jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(links)='array' AND jsonb_array_length(links)<=5)
);
ALTER TABLE public.bfe_listing_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_listing_assets FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bfe_listing_assets_audit AFTER INSERT OR UPDATE OR DELETE ON public.bfe_listing_assets FOR EACH ROW EXECUTE FUNCTION public.bfe_record_access_change();
CREATE FUNCTION public.bfe_listing_visible(p_record uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT cardinality(public.bfe_current_roles())>0 AND EXISTS(
 SELECT 1 FROM public.bfe_feature_records r WHERE r.id=p_record AND r.module IN ('businesses','buy-sell','jobs','garage-sales','workshops','booth-events') AND (
 (r.owner_id=auth.uid() AND public.bfe_can('livelihood','view','own')) OR public.bfe_can('livelihood','view','association') OR
 (r.status='Published' AND r.publication_consent AND r.expires_at>now() AND (r.audience='members' OR r.audience=ANY(public.bfe_current_roles())) AND (public.bfe_can('livelihood','view','own') OR public.bfe_can('livelihood','view','approved')))));
$$;
CREATE FUNCTION public.bfe_listing_media(p_record uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.bfe_listing_visible(p_record) THEN RAISE EXCEPTION 'Listing unavailable.' USING ERRCODE='42501';END IF;
 SELECT jsonb_build_object('cover_path',cover_path,'links',links) INTO result FROM public.bfe_listing_assets WHERE record_id=p_record;
 RETURN coalesce(result,'{"cover_path":null,"links":[]}'::jsonb);
END;$$;
CREATE FUNCTION public.bfe_save_listing_links(p_record uuid,p_links jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records;link jsonb;
BEGIN
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_record FOR UPDATE;
 IF r.id IS NULL OR r.owner_id<>auth.uid() OR r.status<>'Submitted' OR r.module NOT IN ('businesses','buy-sell','jobs','garage-sales','workshops','booth-events') OR NOT(public.bfe_can('livelihood','create','own') OR public.bfe_can('livelihood','create','association')) THEN RAISE EXCEPTION 'Only your unreviewed listing can be changed.' USING ERRCODE='42501';END IF;
 IF p_links IS NULL OR jsonb_typeof(p_links)<>'array' OR jsonb_array_length(p_links)>5 OR octet_length(p_links::text)>11000 THEN RAISE EXCEPTION 'Add at most five links.' USING ERRCODE='22023';END IF;
 FOR link IN SELECT value FROM jsonb_array_elements(p_links) LOOP
  IF jsonb_typeof(link)<>'object' OR jsonb_typeof(link->'label') IS DISTINCT FROM 'string' OR jsonb_typeof(link->'url') IS DISTINCT FROM 'string' OR length(btrim(link->>'label')) NOT BETWEEN 2 AND 40 OR length(link->>'url') NOT BETWEEN 10 AND 2000 OR link->>'url' !~ '^https://[A-Za-z0-9.-]+[.][A-Za-z]{2,}([/:?#][^[:space:]<>]*)?$' OR link->>'url' ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Use a link label and full HTTPS address without credentials.' USING ERRCODE='22023';END IF;
 END LOOP;
 IF NOT r.publication_consent AND jsonb_array_length(p_links)>0 THEN RAISE EXCEPTION 'Choose publication consent before adding public contact links.' USING ERRCODE='22023';END IF;
 INSERT INTO public.bfe_listing_assets(record_id,links) VALUES(p_record,p_links) ON CONFLICT(record_id) DO UPDATE SET links=excluded.links;
 UPDATE public.bfe_feature_records SET version=version+1,updated_at=now() WHERE id=p_record;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note) VALUES(p_record,auth.uid(),'Links updated','Optional publication links await staff review');
END;$$;
CREATE FUNCTION public.bfe_prepare_listing_cover(p_record uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records;path text;
BEGIN
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_record FOR UPDATE;
 IF r.id IS NULL OR r.owner_id<>auth.uid() OR r.status<>'Submitted' OR NOT r.publication_consent OR r.module NOT IN ('businesses','buy-sell','jobs','garage-sales','workshops','booth-events') OR NOT(public.bfe_can('livelihood','create','own') OR public.bfe_can('livelihood','create','association')) THEN RAISE EXCEPTION 'Your unreviewed listing and publication consent are required.' USING ERRCODE='42501';END IF;
 SELECT cover_path INTO path FROM public.bfe_listing_assets WHERE record_id=p_record;
 IF path IS NOT NULL THEN RETURN path;END IF;
 path:=p_record::text||'/'||gen_random_uuid()::text||'.webp';
 INSERT INTO public.bfe_listing_assets(record_id,cover_path) VALUES(p_record,path) ON CONFLICT(record_id) DO UPDATE SET cover_path=excluded.cover_path;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note) VALUES(p_record,auth.uid(),'Cover prepared','One immutable cover photo; staff review required');
 RETURN path;
END;$$;
CREATE FUNCTION public.bfe_remove_listing_cover(p_record uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records;
BEGIN
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_record FOR UPDATE;
 IF r.id IS NULL OR r.owner_id<>auth.uid() OR r.status<>'Submitted' OR NOT(public.bfe_can('livelihood','create','own') OR public.bfe_can('livelihood','create','association')) THEN RAISE EXCEPTION 'Only your unreviewed cover can be changed.' USING ERRCODE='42501';END IF;
 UPDATE public.bfe_listing_assets SET cover_path=NULL WHERE record_id=p_record;
 UPDATE public.bfe_feature_records SET version=version+1,updated_at=now() WHERE id=p_record;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note) VALUES(p_record,auth.uid(),'Cover removed','Old object is no longer accessible through listing policies');
END;$$;
CREATE FUNCTION public.bfe_listing_object_access(p_path text,p_write boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.bfe_listing_assets a JOIN public.bfe_feature_records r ON r.id=a.record_id WHERE a.cover_path=p_path AND
 CASE WHEN p_write THEN r.owner_id=auth.uid() AND r.status='Submitted' AND r.publication_consent AND (public.bfe_can('livelihood','create','own') OR public.bfe_can('livelihood','create','association')) ELSE public.bfe_listing_visible(r.id) END);
$$;
-- The Storage service validates the bucket's MIME and size limits. No public URLs or overwrite policies.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('bfe-listing-covers','bfe-listing-covers',false,1048576,ARRAY['image/webp'])
 ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=1048576,allowed_mime_types=ARRAY['image/webp'];
CREATE POLICY bfe_listing_cover_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='bfe-listing-covers' AND public.bfe_listing_object_access(name,true));
CREATE POLICY bfe_listing_cover_select ON storage.objects FOR SELECT TO authenticated USING(bucket_id='bfe-listing-covers' AND public.bfe_listing_object_access(name,false));
-- Restrictive policies prevent a broad pre-existing Storage policy from bypassing this bucket's boundaries.
CREATE POLICY bfe_listing_cover_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'bfe-listing-covers' OR public.bfe_listing_object_access(name,true));
CREATE POLICY bfe_listing_cover_select_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'bfe-listing-covers' OR public.bfe_listing_object_access(name,false));
CREATE POLICY bfe_listing_cover_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'bfe-listing-covers') WITH CHECK(bucket_id<>'bfe-listing-covers');
CREATE POLICY bfe_listing_cover_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'bfe-listing-covers');
CREATE POLICY bfe_listing_cover_anon_guard ON storage.objects AS RESTRICTIVE FOR ALL TO anon USING(bucket_id<>'bfe-listing-covers') WITH CHECK(bucket_id<>'bfe-listing-covers');
-- Serialize upload completion with review and invalidate a review opened before media changed.
CREATE FUNCTION public.bfe_listing_cover_uploaded() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records;
BEGIN
 IF NEW.bucket_id<>'bfe-listing-covers' THEN RETURN NEW;END IF;
 SELECT f.* INTO r FROM public.bfe_feature_records f JOIN public.bfe_listing_assets a ON a.record_id=f.id WHERE a.cover_path=NEW.name FOR UPDATE OF f;
 IF r.id IS NULL OR r.owner_id<>auth.uid() OR r.status<>'Submitted' OR NOT r.publication_consent OR NOT(public.bfe_can('livelihood','create','own') OR public.bfe_can('livelihood','create','association')) THEN RAISE EXCEPTION 'Photo upload is no longer permitted.' USING ERRCODE='42501';END IF;
 UPDATE public.bfe_feature_records SET version=version+1,updated_at=now() WHERE id=r.id;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note) VALUES(r.id,auth.uid(),'Cover uploaded','Review the cover before publication');
 RETURN NEW;
END;$$;
CREATE TRIGGER bfe_listing_cover_uploaded AFTER INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION public.bfe_listing_cover_uploaded();
REVOKE ALL ON FUNCTION public.bfe_listing_cover_uploaded() FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bfe_revise_listing(p_id uuid,p_version integer,p_title text,p_detail text,p_fields jsonb,p_consent boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records;
BEGIN
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_id FOR UPDATE;
 IF r.id IS NULL OR r.owner_id<>auth.uid() OR r.module NOT IN ('businesses','buy-sell','jobs','garage-sales') OR NOT(public.bfe_can('livelihood','create','own') OR public.bfe_can('livelihood','create','association')) THEN RAISE EXCEPTION 'Listing edit access required.' USING ERRCODE='42501';END IF;
 IF p_version IS NULL OR r.version<>p_version THEN RAISE EXCEPTION 'Listing changed. Refresh before saving.' USING ERRCODE='40001';END IF;
 IF r.status NOT IN ('Submitted','Published','Rejected','Withdrawn') THEN RAISE EXCEPTION 'Wait for the current review to finish before editing.';END IF;
 IF p_title IS NULL OR p_detail IS NULL OR p_consent IS NULL OR length(btrim(p_title)) NOT BETWEEN 3 AND 120 OR length(btrim(p_detail)) NOT BETWEEN 10 AND 5000 THEN RAISE EXCEPTION 'Check the title and description.' USING ERRCODE='22023';END IF;
 PERFORM public.bfe_validate_feature_fields(r.module,p_fields);
 UPDATE public.bfe_feature_records SET title=btrim(p_title),detail=btrim(p_detail),fields=p_fields,publication_consent=p_consent,status='Submitted',version=version+1,public_title=NULL,public_body=NULL,audience=NULL,expires_at=NULL,updated_at=now() WHERE id=p_id;
 IF NOT p_consent THEN UPDATE public.bfe_listing_assets SET links='[]' WHERE record_id=p_id;END IF;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note) VALUES(p_id,auth.uid(),'Resubmitted','Changes are hidden from member browsing until reviewed again');
END;$$;
REVOKE ALL ON FUNCTION public.bfe_listing_visible(uuid),public.bfe_listing_media(uuid),public.bfe_save_listing_links(uuid,jsonb),public.bfe_prepare_listing_cover(uuid),public.bfe_listing_object_access(text,boolean),public.bfe_revise_listing(uuid,integer,text,text,jsonb,boolean),public.bfe_remove_listing_cover(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_listing_media(uuid),public.bfe_save_listing_links(uuid,jsonb),public.bfe_prepare_listing_cover(uuid),public.bfe_listing_object_access(text,boolean),public.bfe_revise_listing(uuid,integer,text,text,jsonb,boolean),public.bfe_remove_listing_cover(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.bfe_account_preview_read(p_session uuid,p_name text,p_args jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.bfe_member_inspections;actor uuid:=auth.uid();original_sub text:=current_setting('request.jwt.claim.sub',true);proc record;k text;arg_sql text:='';idx integer;result jsonb;
BEGIN
 IF NOT ('developer'=ANY(public.bfe_current_roles())) THEN RAISE EXCEPTION 'Active developer required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.bfe_member_inspections WHERE id=p_session AND developer_id=actor FOR UPDATE;
 IF s.id IS NULL OR s.ended_at IS NOT NULL OR s.expires_at<=now() OR cardinality(public.bfe_roles_for(s.target_id))=0 THEN RAISE EXCEPTION 'Account preview expired or member access unavailable.' USING ERRCODE='42501'; END IF;
 IF p_name IS NULL OR p_name NOT IN ('bfe_get_member','bfe_get_profile','bfe_my_access','bfe_my_notifications','bfe_list_lots','bfe_lot_detail','bfe_lot_receipts','bfe_staff_directory','bfe_access_members','bfe_member_assignments','bfe_monitor_module','bfe_feature_dashboard','bfe_booking_dashboard','bfe_booking_availability','bfe_visitor_dashboard','bfe_workflow_history','bfe_participation_dashboard','bfe_shuttle_dashboard','bfe_preview_requests','bfe_preview_request_thread','bfe_listing_media') THEN RAISE EXCEPTION 'Changes and unsupported endpoints are disabled in account preview.' USING ERRCODE='42501'; END IF;
 IF p_args IS NULL OR jsonb_typeof(p_args)<>'object' OR octet_length(p_args::text)>10000 THEN RAISE EXCEPTION 'Invalid read arguments.' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=p_name)<>1 OR NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=p_name AND p.provolatile='s' AND p.prosecdef) THEN RAISE EXCEPTION 'Read endpoint unavailable.' USING ERRCODE='42501'; END IF;
 SELECT p.* INTO proc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=p_name AND p.provolatile='s' AND p.prosecdef;
 FOR k IN SELECT jsonb_object_keys(p_args) LOOP
  idx:=array_position(proc.proargnames,k);
  IF idx IS NULL THEN RAISE EXCEPTION 'Unexpected read argument.' USING ERRCODE='22023'; END IF;
  arg_sql:=arg_sql||CASE WHEN arg_sql='' THEN '' ELSE ',' END||format('%I => ($1 ->> %L)::%s',k,k,pg_catalog.format_type(proc.proargtypes[idx-1],NULL));
 END LOOP;
 -- No request-supplied SQL, function identifier or cast type is executed.
 -- Names are an explicit allowlist; casts/argument names come from the system catalog.
 BEGIN
  PERFORM set_config('request.jwt.claim.sub',s.target_id::text,true);
  EXECUTE format('SELECT public.%I(%s)',p_name,arg_sql) INTO result USING p_args;
  PERFORM set_config('request.jwt.claim.sub',coalesce(original_sub,''),true);
 EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('request.jwt.claim.sub',coalesce(original_sub,''),true);RAISE;
 END;
 INSERT INTO public.bfe_member_inspection_audit(inspection_id,actor_id,action,section) VALUES(s.id,actor,'Viewed','interface:'||p_name);
 IF p_name='bfe_get_member' THEN result:=result||jsonb_build_object('_preview_expires_at',s.expires_at,'_preview_server_now',now()); END IF;
 RETURN result;
END;$$;
NOTIFY pgrst,'reload schema';COMMIT;
