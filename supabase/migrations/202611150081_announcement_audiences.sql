-- Owner-run after 080, before deploying the matching announcement form.
-- No content, accounts, role/capability grants, or facility rules are seeded.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

-- Keep the existing validated legacy label truthful for a Drivers-only draft.
-- Specific Driver targeting already exists in 073's publication reader.
UPDATE public.bfe_feature_definitions d SET fields=(
 SELECT jsonb_agg(CASE WHEN f.value->>'key'='audience'
   AND NOT (f.value->'options' ? 'Drivers')
  THEN jsonb_set(f.value,'{options}',(f.value->'options')||'["Drivers"]'::jsonb)
  ELSE f.value END ORDER BY f.ordinality)
 FROM jsonb_array_elements(d.fields) WITH ORDINALITY AS f(value,ordinality)
) WHERE d.code='publishing';

-- Save the audience with the draft, in the same transaction as submission.
-- Image-upload failure or reopening an unpublished post cannot lose targeting.
CREATE FUNCTION public.bfe_submit_announcement(
 p_client uuid,p_module text,p_title text,p_detail text,p_fields jsonb,
 p_consent boolean,p_audiences text[]
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE selected text[]; record_id uuid; r public.bfe_feature_records;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0
 OR NOT public.bfe_can('community','view','association')
 OR NOT public.bfe_can('community','publish','association') THEN
  RAISE EXCEPTION 'Announcement publishing permission required.' USING ERRCODE='42501';
 END IF;
 IF p_module IS DISTINCT FROM 'publishing' OR p_consent IS DISTINCT FROM true
 OR p_audiences IS NULL OR cardinality(p_audiences) NOT BETWEEN 1 AND 5
 OR array_position(p_audiences,NULL) IS NOT NULL
 OR NOT (p_audiences <@ ARRAY['members','homeowner','renter','board','security','driver']::text[])
 OR ('members'=ANY(p_audiences) AND cardinality(p_audiences)<>1) THEN
  RAISE EXCEPTION 'Choose All members or one or more audiences, and confirm permission to share.' USING ERRCODE='22023';
 END IF;
 selected:=ARRAY(SELECT DISTINCT value FROM unnest(p_audiences) value ORDER BY value);
 -- Retains create permission, field validation, rate limit, author ownership,
 -- advisory lock and client-reference idempotency of the original submitter.
 record_id:=public.bfe_submit_feature(p_client,p_module,p_title,p_detail,p_fields,p_consent);
 SELECT * INTO STRICT r FROM public.bfe_feature_records WHERE id=record_id FOR UPDATE;
 IF r.audiences IS NOT NULL THEN
  IF r.audiences IS DISTINCT FROM selected THEN
   RAISE EXCEPTION 'This submission was already saved with a different audience. Reopen it.' USING ERRCODE='40001';
  END IF;
  RETURN record_id;
 END IF;
 IF r.status<>'Submitted' THEN
  RAISE EXCEPTION 'Announcement already handled. Reopen it.' USING ERRCODE='40001';
 END IF;
 UPDATE public.bfe_feature_records SET audiences=selected WHERE id=record_id;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note)
 VALUES(record_id,auth.uid(),'Audience selected','Saved announcement audiences: '||array_to_string(selected,', '));
 RETURN record_id;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_submit_announcement(uuid,text,text,text,jsonb,boolean,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_submit_announcement(uuid,text,text,text,jsonb,boolean,text[]) TO authenticated;

-- Migration 034's publisher, retaining its permissions, author/consent, exact
-- content/image comparison, expiry, retry and republish rules. The only policy
-- change is honoring the saved audience set instead of a single legacy label.
CREATE OR REPLACE FUNCTION public.bfe_publish_announcement(
 p_id uuid,p_title text,p_detail text,p_fields jsonb,p_expires timestamptz,p_cover_path text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records; cover text; v_audience text; selected text[];
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
 v_audience:=CASE r.fields->>'audience' WHEN 'All members' THEN 'members' WHEN 'Homeowners' THEN 'homeowner' WHEN 'Renters' THEN 'renter' WHEN 'Board' THEN 'board' WHEN 'Security' THEN 'security' WHEN 'Drivers' THEN 'driver' END;
 selected:=coalesce(r.audiences,ARRAY[v_audience]);
 IF cardinality(selected) NOT BETWEEN 1 AND 5 OR array_position(selected,NULL) IS NOT NULL
 OR NOT (selected <@ ARRAY['members','homeowner','renter','board','security','driver']::text[])
 OR ('members'=ANY(selected) AND cardinality(selected)<>1) THEN
  RAISE EXCEPTION 'Choose All members or one or more audiences.' USING ERRCODE='22023';
 END IF;
 v_audience:=selected[1];
 IF r.status='Published' AND r.public_title=r.title AND r.public_body=r.detail AND r.audience=v_audience AND r.expires_at=p_expires THEN RETURN; END IF;
 IF r.status NOT IN ('Submitted','In review','Reviewed','Withdrawn') AND NOT (r.status='Published' AND r.expires_at<=now()) THEN
  RAISE EXCEPTION 'Announcement is already being handled. Refresh it.' USING ERRCODE='40001';
 END IF;
 IF p_expires IS NULL OR p_expires<=now() OR p_expires>now()+interval '366 days'
 OR NOT EXISTS(SELECT 1 FROM public.bfe_feature_definitions WHERE code='publishing' AND publishable) THEN
  RAISE EXCEPTION 'Choose a future end date within one year.' USING ERRCODE='22023';
 END IF;
 IF cover IS NOT NULL AND NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='bfe-listing-covers' AND name=cover) THEN
  RAISE EXCEPTION 'Finish the image upload before publishing.' USING ERRCODE='40001';
 END IF;
 UPDATE public.bfe_feature_records SET status='Published',public_title=title,public_body=detail,
  audience=v_audience,expires_at=p_expires,version=version+1,updated_at=now() WHERE id=p_id;
 -- 073 deliberately clears arrays on legacy audience updates. Restore the
 -- validated set after that trigger, before this transaction becomes visible.
 UPDATE public.bfe_feature_records SET audiences=selected WHERE id=p_id;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note)
 VALUES(p_id,auth.uid(),'Published','Published by the announcement author to: '||array_to_string(selected,', '));
END;$$;
REVOKE ALL ON FUNCTION public.bfe_publish_announcement(uuid,text,text,jsonb,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_publish_announcement(uuid,text,text,jsonb,timestamptz,text) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
