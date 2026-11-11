-- Apply once after 029. No announcements, images or permissions are seeded.
-- Reuse 015 private cover storage, immutable paths, restrictive policies and
-- the upload/review lock. Publishing uses community permissions, not livelihood.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF to_regclass('public.bfe_listing_assets') IS NULL
 OR NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='bfe-listing-covers' AND NOT public)
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='storage.objects'::regclass AND tgname='bfe_listing_cover_uploaded' AND tgenabled IN ('O','A')) THEN
  RAISE EXCEPTION 'Install the existing private listing cover setup through migration 029 first.';
 END IF;
END; $$;
CREATE OR REPLACE FUNCTION public.bfe_listing_visible(p_record uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT cardinality(public.bfe_current_roles())>0 AND EXISTS(
 SELECT 1 FROM public.bfe_feature_records r WHERE r.id=p_record AND r.module IN ('businesses','buy-sell','jobs','garage-sales','workshops','booth-events','publishing') AND (
 (r.owner_id=auth.uid() AND public.bfe_can(CASE WHEN r.module='publishing' THEN 'community' ELSE 'livelihood' END,'view','own')) OR public.bfe_can(CASE WHEN r.module='publishing' THEN 'community' ELSE 'livelihood' END,'view','association') OR
 (r.status='Published' AND r.publication_consent AND r.expires_at>now() AND (r.audience='members' OR r.audience=ANY(public.bfe_current_roles())) AND (public.bfe_can(CASE WHEN r.module='publishing' THEN 'community' ELSE 'livelihood' END,'view','own') OR public.bfe_can(CASE WHEN r.module='publishing' THEN 'community' ELSE 'livelihood' END,'view','approved')))));
$$;
CREATE OR REPLACE FUNCTION public.bfe_listing_media(p_record uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.bfe_listing_visible(p_record) THEN RAISE EXCEPTION 'Announcement or listing unavailable.' USING ERRCODE='42501';END IF;
 SELECT jsonb_build_object('cover_path',cover_path,'links',links) INTO result FROM public.bfe_listing_assets WHERE record_id=p_record;
 RETURN coalesce(result,'{"cover_path":null,"links":[]}'::jsonb);
END;$$;
CREATE OR REPLACE FUNCTION public.bfe_prepare_listing_cover(p_record uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records;path text;
BEGIN
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_record FOR UPDATE;
 IF r.id IS NULL OR r.owner_id<>auth.uid() OR r.status<>'Submitted' OR NOT r.publication_consent OR r.module NOT IN ('businesses','buy-sell','jobs','garage-sales','workshops','booth-events','publishing') OR NOT(public.bfe_can(CASE WHEN r.module='publishing' THEN 'community' ELSE 'livelihood' END,'create','own') OR public.bfe_can(CASE WHEN r.module='publishing' THEN 'community' ELSE 'livelihood' END,'create','association')) THEN RAISE EXCEPTION 'Your unreviewed announcement or listing and publication consent are required.' USING ERRCODE='42501';END IF;
 SELECT cover_path INTO path FROM public.bfe_listing_assets WHERE record_id=p_record;
 IF path IS NOT NULL THEN RETURN path;END IF;
 path:=p_record::text||'/'||gen_random_uuid()::text||'.webp';
 INSERT INTO public.bfe_listing_assets(record_id,cover_path) VALUES(p_record,path) ON CONFLICT(record_id) DO UPDATE SET cover_path=excluded.cover_path;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note) VALUES(p_record,auth.uid(),'Cover prepared','One immutable cover photo; staff review required');
 RETURN path;
END;$$;
CREATE OR REPLACE FUNCTION public.bfe_remove_listing_cover(p_record uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records;
BEGIN
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_record FOR UPDATE;
 IF r.id IS NULL OR r.owner_id<>auth.uid() OR r.status<>'Submitted' OR NOT(public.bfe_can(CASE WHEN r.module='publishing' THEN 'community' ELSE 'livelihood' END,'create','own') OR public.bfe_can(CASE WHEN r.module='publishing' THEN 'community' ELSE 'livelihood' END,'create','association')) THEN RAISE EXCEPTION 'Only your unreviewed cover can be changed.' USING ERRCODE='42501';END IF;
 UPDATE public.bfe_listing_assets SET cover_path=NULL WHERE record_id=p_record;
 UPDATE public.bfe_feature_records SET version=version+1,updated_at=now() WHERE id=p_record;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note) VALUES(p_record,auth.uid(),'Cover removed','Old object is no longer accessible through listing policies');
END;$$;
CREATE OR REPLACE FUNCTION public.bfe_listing_object_access(p_path text,p_write boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.bfe_listing_assets a JOIN public.bfe_feature_records r ON r.id=a.record_id WHERE a.cover_path=p_path AND
 CASE WHEN p_write THEN r.owner_id=auth.uid() AND r.status='Submitted' AND r.publication_consent AND (public.bfe_can(CASE WHEN r.module='publishing' THEN 'community' ELSE 'livelihood' END,'create','own') OR public.bfe_can(CASE WHEN r.module='publishing' THEN 'community' ELSE 'livelihood' END,'create','association')) ELSE public.bfe_listing_visible(r.id) END);
$$;
-- Serialize upload completion with review and invalidate a review opened before media changed.
CREATE OR REPLACE FUNCTION public.bfe_listing_cover_uploaded() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records;
BEGIN
 IF NEW.bucket_id<>'bfe-listing-covers' THEN RETURN NEW;END IF;
 SELECT f.* INTO r FROM public.bfe_feature_records f JOIN public.bfe_listing_assets a ON a.record_id=f.id WHERE a.cover_path=NEW.name FOR UPDATE OF f;
 IF r.id IS NULL OR r.owner_id<>auth.uid() OR r.status<>'Submitted' OR NOT r.publication_consent OR NOT(public.bfe_can(CASE WHEN r.module='publishing' THEN 'community' ELSE 'livelihood' END,'create','own') OR public.bfe_can(CASE WHEN r.module='publishing' THEN 'community' ELSE 'livelihood' END,'create','association')) THEN RAISE EXCEPTION 'Photo upload is no longer permitted.' USING ERRCODE='42501';END IF;
 UPDATE public.bfe_feature_records SET version=version+1,updated_at=now() WHERE id=r.id;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note) VALUES(r.id,auth.uid(),'Cover uploaded','Review the cover before publication');
 RETURN NEW;
END;$$;

REVOKE ALL ON FUNCTION public.bfe_listing_cover_uploaded() FROM PUBLIC,anon,authenticated;

NOTIFY pgrst,'reload schema'; COMMIT;
