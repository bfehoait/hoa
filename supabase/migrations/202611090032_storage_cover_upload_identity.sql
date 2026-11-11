-- Apply after 031. Fix cover finalization without changing Storage policies.
-- Storage authorizes the caller with RLS, then may commit metadata under a
-- service identity. Validate the server-populated object owner against the
-- prepared record; never derive authority from image user_metadata.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE OR REPLACE FUNCTION public.bfe_listing_cover_uploaded() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records; object_owner text; capability text;
BEGIN
 IF NEW.bucket_id<>'bfe-listing-covers' THEN RETURN NEW; END IF;
 SELECT f.* INTO r FROM public.bfe_feature_records f
 JOIN public.bfe_listing_assets a ON a.record_id=f.id
 WHERE a.cover_path=NEW.name FOR UPDATE OF f;
 object_owner:=coalesce(nullif(to_jsonb(NEW)->>'owner_id',''),nullif(to_jsonb(NEW)->>'owner',''));
 capability:=CASE WHEN r.module='publishing' THEN 'community' ELSE 'livelihood' END;
 IF r.id IS NULL OR r.module NOT IN ('publishing','businesses','buy-sell','jobs','garage-sales','workshops','booth-events')
 OR object_owner IS DISTINCT FROM r.owner_id::text
 OR r.status IS DISTINCT FROM 'Submitted' OR r.publication_consent IS DISTINCT FROM true
 OR cardinality(public.bfe_roles_for(r.owner_id))=0
 OR NOT (public.bfe_can_for(r.owner_id,capability,'create','own') OR public.bfe_can_for(r.owner_id,capability,'create','association')) THEN
  RAISE EXCEPTION 'Photo upload is no longer permitted.' USING ERRCODE='42501';
 END IF;
 -- An ordinary authenticated caller cannot name somebody else as object owner.
 -- Final service writes may carry no end-user sub, or a service-only sub;
 -- RLS already checked the request, and the prepared path/owner stay binding.
 IF coalesce(auth.role(),'')='authenticated' AND auth.uid() IS DISTINCT FROM r.owner_id THEN
  RAISE EXCEPTION 'Photo owner does not match the signed-in account.' USING ERRCODE='42501';
 END IF;
 UPDATE public.bfe_feature_records SET version=version+1,updated_at=now() WHERE id=r.id;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note)
 VALUES(r.id,r.owner_id,'Cover uploaded','Prepared cover stored; publication permissions remain separate');
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_listing_cover_uploaded() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
