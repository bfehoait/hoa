-- Apply after 030. No records or permission grants are created.
-- Authorized authors publish their own announcement without a separate review.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.bfe_publish_announcement(p_id uuid,p_title text,p_detail text,p_fields jsonb,p_expires timestamptz,p_cover_path text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records; cover text; audience text;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0
 OR NOT public.bfe_can('community','view','association')
 OR NOT public.bfe_can('community','publish','association') THEN
  RAISE EXCEPTION 'Announcement publishing permission required.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_id FOR UPDATE;
 IF r.id IS NULL OR r.module<>'publishing' OR r.owner_id IS DISTINCT FROM auth.uid() OR NOT r.publication_consent THEN
  RAISE EXCEPTION 'Your announcement and publication consent are required.' USING ERRCODE='42501';
 END IF;
 SELECT cover_path INTO cover FROM public.bfe_listing_assets WHERE record_id=p_id;
 IF r.title IS DISTINCT FROM btrim(p_title) OR r.detail IS DISTINCT FROM btrim(p_detail) OR r.fields IS DISTINCT FROM p_fields OR cover IS DISTINCT FROM p_cover_path THEN
  RAISE EXCEPTION 'Announcement changed. Reopen it before publishing.' USING ERRCODE='40001';
 END IF;
 audience:=CASE r.fields->>'audience' WHEN 'All members' THEN 'members' WHEN 'Homeowners' THEN 'homeowner' WHEN 'Renters' THEN 'renter' WHEN 'Board' THEN 'board' WHEN 'Security' THEN 'security' END;
 -- A repeated request never creates a duplicate or changes a published post.
 IF r.status='Published' AND r.public_title=r.title AND r.public_body=r.detail AND r.audience=audience AND r.expires_at=p_expires THEN RETURN; END IF;
 IF r.status<>'Submitted' THEN RAISE EXCEPTION 'Announcement is already being handled. Refresh it.' USING ERRCODE='40001'; END IF;
 IF audience IS NULL OR p_expires IS NULL OR p_expires<=now() OR p_expires>now()+interval '366 days'
 OR NOT EXISTS(SELECT 1 FROM public.bfe_feature_definitions WHERE code='publishing' AND publishable) THEN
  RAISE EXCEPTION 'Choose an audience and expiry within one year.' USING ERRCODE='22023';
 END IF;
 IF cover IS NOT NULL AND NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='bfe-listing-covers' AND name=cover) THEN
  RAISE EXCEPTION 'Finish the image upload before publishing.' USING ERRCODE='40001';
 END IF;
 UPDATE public.bfe_feature_records SET status='Published',public_title=title,public_body=detail,audience=bfe_publish_announcement.audience,expires_at=p_expires,version=version+1,updated_at=now() WHERE id=p_id;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note)
 VALUES(p_id,auth.uid(),'Published','Published directly by the authorized announcement author');
END;$$;
REVOKE ALL ON FUNCTION public.bfe_publish_announcement(uuid,text,text,jsonb,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_publish_announcement(uuid,text,text,jsonb,timestamptz,text) TO authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
