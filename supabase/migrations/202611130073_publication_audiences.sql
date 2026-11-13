-- Owner-run AFTER 072, before publishing the matching review UI.
-- Existing publications retain their legacy single-audience visibility.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
ALTER TABLE public.bfe_feature_records ADD COLUMN audiences text[];
ALTER TABLE public.bfe_feature_records ADD CONSTRAINT bfe_feature_audiences_valid CHECK (
 audiences IS NULL OR (
  cardinality(audiences) BETWEEN 1 AND 5
  AND array_position(audiences,NULL) IS NULL
  AND audiences <@ ARRAY['members','homeowner','renter','board','security','driver']::text[]
  AND (NOT ('members'=ANY(audiences)) OR cardinality(audiences)=1)
 )
);

CREATE FUNCTION public.bfe_publication_audience_matches(p_legacy text,p_audiences text[],p_roles text[]) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(cardinality(p_roles)>0 AND (
  coalesce(p_audiences,ARRAY[p_legacy]) && ARRAY['members']::text[]
  OR coalesce(p_audiences,ARRAY[p_legacy]) && p_roles
 ),false);
$$;
REVOKE ALL ON FUNCTION public.bfe_publication_audience_matches(text,text[],text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_publication_audience_matches(text,text[],text[]) TO authenticated;

-- Old callers that explicitly publish one audience must clear any earlier set.
CREATE FUNCTION public.bfe_reset_legacy_publication_audiences() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 NEW.audiences:=NULL;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_reset_legacy_publication_audiences() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bfe_reset_legacy_publication_audiences BEFORE UPDATE OF audience
 ON public.bfe_feature_records FOR EACH ROW WHEN (NEW.status='Published')
 EXECUTE FUNCTION public.bfe_reset_legacy_publication_audiences();

CREATE FUNCTION public.bfe_review_feature_audiences(
 p_id uuid,p_version integer,p_status text,p_note text,
 p_public_title text DEFAULT NULL,p_public_body text DEFAULT NULL,
 p_audiences text[] DEFAULT NULL,p_expires timestamptz DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE selected text[];
BEGIN
 IF p_status='Published' THEN
  IF p_audiences IS NULL OR cardinality(p_audiences) NOT BETWEEN 1 AND 5
   OR array_position(p_audiences,NULL) IS NOT NULL
   OR NOT (p_audiences <@ ARRAY['members','homeowner','renter','board','security','driver']::text[])
   OR ('members'=ANY(p_audiences) AND cardinality(p_audiences)<>1) THEN
   RAISE EXCEPTION 'Select All members or at least one specific audience.' USING ERRCODE='22023';
  END IF;
  selected:=ARRAY(SELECT DISTINCT value FROM unnest(p_audiences) value ORDER BY value);
 END IF;
 -- Existing reviewer authority, consent, version, workflow, public-text,
 -- cover-upload and expiry checks remain authoritative and lock the record.
 PERFORM public.bfe_review_feature(p_id,p_version,p_status,p_note,p_public_title,p_public_body,selected[1],p_expires);
 IF p_status='Published' THEN
  UPDATE public.bfe_feature_records SET audiences=selected WHERE id=p_id;
  INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note)
  VALUES(p_id,auth.uid(),'Audience selected','Published audiences: '||array_to_string(selected,', '));
 END IF;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_review_feature_audiences(uuid,integer,text,text,text,text,text[],timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_review_feature_audiences(uuid,integer,text,text,text,text,text[],timestamptz) TO authenticated;

-- Existing read functions below retain their guards/projections/ordering.

-- Updated audience predicate only; source: 202611070019_published_event_dates.sql
CREATE OR REPLACE FUNCTION public.bfe_feature_dashboard(p_module text,p_view text DEFAULT 'mine',p_page integer DEFAULT 0,p_search text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.bfe_feature_definitions; rows jsonb; n bigint; manager boolean; creator boolean;
BEGIN
 SELECT * INTO d FROM public.bfe_feature_definitions WHERE code=p_module;
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR d.code IS NULL THEN RAISE EXCEPTION 'Active membership required.' USING ERRCODE='42501'; END IF;
 IF p_view IS NULL OR p_view NOT IN ('mine','review','published') OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 OR p_search IS NULL OR length(p_search)>100 THEN RAISE EXCEPTION 'Invalid feature filters.' USING ERRCODE='22023'; END IF;
 manager:=public.bfe_can(d.capability,'view','association');
 creator:=(d.resident_create AND public.bfe_current_roles() && ARRAY['homeowner','renter']::text[] AND public.bfe_can(d.capability,'create','own')) OR public.bfe_can(d.capability,'create','association');
 IF p_view='review' AND NOT manager THEN RAISE EXCEPTION 'Review access required.' USING ERRCODE='42501'; END IF;
 IF p_view='mine' AND NOT (public.bfe_can(d.capability,'view','own') OR manager) THEN RAISE EXCEPTION 'Own record access required.' USING ERRCODE='42501'; END IF;
 IF p_view='published' AND NOT (public.bfe_can(d.capability,'view','approved') OR public.bfe_can(d.capability,'view','own') OR manager) THEN RAISE EXCEPTION 'Published content access required.' USING ERRCODE='42501'; END IF;
 WITH visible AS (
  SELECT r.* FROM public.bfe_feature_records r WHERE r.module=p_module AND
   CASE p_view WHEN 'mine' THEN r.owner_id=auth.uid() WHEN 'review' THEN true ELSE r.status='Published' AND r.expires_at>now() AND public.bfe_publication_audience_matches(r.audience,r.audiences,public.bfe_current_roles()) END
   AND position(lower(p_search) IN lower(CASE WHEN p_view='published' THEN coalesce(r.public_title,'')||' '||coalesce(r.public_body,'') ELSE r.title||' '||r.detail END))>0
 ), page AS (SELECT * FROM visible ORDER BY created_at DESC,id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(CASE WHEN p_view='published' THEN jsonb_build_object('id',id,'module',module,'title',public_title,'detail',public_body,'status',status,'expires_at',expires_at,'created_at',created_at)||CASE WHEN module='events' THEN jsonb_build_object('fields',jsonb_strip_nulls(jsonb_build_object('date',fields->>'date','start',fields->>'start','end',fields->>'end','venue',fields->>'venue'))) ELSE '{}'::jsonb END ELSE to_jsonb(page) END ORDER BY created_at DESC,id),'[]') INTO n,rows FROM page;
 RETURN jsonb_build_object('rows',rows,'total',n,'can_create',creator,'can_review',manager AND public.bfe_can(d.capability,'status','association'),'can_publish',manager AND public.bfe_can(d.capability,'publish','association') AND d.publishable,'publishable',d.publishable);
END;$$;

-- Updated audience predicate only; source: 202611060011_activity_participation.sql
CREATE OR REPLACE FUNCTION public.bfe_request_participation(p_client uuid,p_activity uuid,p_places integer,p_details text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records; e public.bfe_activity_participation; cap integer; module_cap text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('activity:'||auth.uid()::text,0));
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_activity FOR UPDATE;
 module_cap:=CASE WHEN r.module='carpools' THEN 'transport' ELSE 'livelihood' END;
 IF NOT (public.bfe_current_roles() && ARRAY['homeowner','renter']::text[]) OR NOT public.bfe_can(module_cap,'create','own') OR r.id IS NULL OR NOT public.bfe_publication_audience_matches(r.audience,r.audiences,public.bfe_current_roles()) THEN RAISE EXCEPTION 'Participation permission and a visible activity required.' USING ERRCODE='42501'; END IF;
 IF p_client IS NULL OR p_places IS NULL OR p_places NOT BETWEEN 1 AND 50 OR p_details IS NULL OR char_length(btrim(p_details)) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Check participation details.' USING ERRCODE='22023'; END IF;
 SELECT * INTO e FROM public.bfe_activity_participation WHERE owner_id=auth.uid() AND client_id=p_client;
 IF FOUND THEN
  IF e.activity_id<>p_activity OR e.places<>p_places OR e.details<>btrim(p_details) THEN RAISE EXCEPTION 'Submission reference already used.' USING ERRCODE='22023'; END IF;
  RETURN e.id;
 END IF;
 IF NOT public.bfe_activity_open(p_activity) THEN RAISE EXCEPTION 'Activity applications are closed.'; END IF;
 cap:=coalesce(r.fields->>'capacity',r.fields->>'seats')::integer;
 IF p_places>cap OR (r.module='booth-events' AND p_places<>1) THEN RAISE EXCEPTION 'Choose a permitted number of places; a booth application reserves one booth.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.bfe_activity_participation WHERE owner_id=auth.uid() AND activity_id=p_activity AND status IN ('Pending','Confirmed')) THEN RAISE EXCEPTION 'You already have a current application for this activity.'; END IF;
 IF (SELECT count(*) FROM public.bfe_activity_participation WHERE owner_id=auth.uid() AND created_at>now()-interval '1 minute')>=5 THEN RAISE EXCEPTION 'Please wait before applying again.'; END IF;
 INSERT INTO public.bfe_activity_participation(activity_id,owner_id,client_id,places,details) VALUES(p_activity,auth.uid(),p_client,p_places,btrim(p_details)) RETURNING * INTO e;
 INSERT INTO public.bfe_participation_audit(participation_id,actor_id,action,note) VALUES(e.id,auth.uid(),'Pending','Application submitted; capacity is committed only on confirmation');RETURN e.id;
END;$$;

-- Updated audience predicate only; source: 202611060011_activity_participation.sql
CREATE OR REPLACE FUNCTION public.bfe_participation_dashboard(p_module text,p_office boolean DEFAULT false,p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE module_cap text;rows jsonb;n bigint;
BEGIN
 module_cap:=CASE WHEN p_module='carpools' THEN 'transport' ELSE 'livelihood' END;
 IF p_module IS NULL OR p_module NOT IN ('carpools','booth-events','workshops') OR p_office IS NULL OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Invalid participation filters.' USING ERRCODE='22023'; END IF;
 IF NOT public.bfe_can(module_cap,'view',CASE WHEN p_office THEN 'association' ELSE 'own' END) THEN RAISE EXCEPTION 'Participation access required.' USING ERRCODE='42501'; END IF;
 WITH visible AS (SELECT e.*,r.public_title AS activity_title FROM public.bfe_activity_participation e JOIN public.bfe_feature_records r ON r.id=e.activity_id WHERE r.module=p_module AND (p_office OR e.owner_id=auth.uid())),page AS (SELECT * FROM visible ORDER BY created_at DESC,id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(to_jsonb(page)||jsonb_build_object('history',coalesce((SELECT jsonb_agg(jsonb_build_object('action',a.action,'note',a.note,'at',a.at) ORDER BY a.id DESC) FROM (SELECT * FROM public.bfe_participation_audit WHERE participation_id=page.id ORDER BY id DESC LIMIT 100) a),'[]'::jsonb)) ORDER BY created_at DESC,id),'[]') INTO n,rows FROM page;
 RETURN jsonb_build_object('rows',rows,'total',n,'can_create',public.bfe_can(module_cap,'create','own') AND public.bfe_current_roles() && ARRAY['homeowner','renter']::text[],'can_approve',p_office AND public.bfe_can(module_cap,'approve','association'),
 'activities',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'title',r.public_title,'capacity',coalesce(r.fields->>'capacity',r.fields->>'seats')::integer,'confirmed',coalesce((SELECT sum(places) FROM public.bfe_activity_participation WHERE activity_id=r.id AND status='Confirmed'),0))) FROM public.bfe_feature_records r WHERE r.module=p_module AND public.bfe_activity_open(r.id) AND public.bfe_publication_audience_matches(r.audience,r.audiences,public.bfe_current_roles())),'[]'));
END;$$;

-- Updated audience predicate only; source: 202611090030_announcement_images.sql
CREATE OR REPLACE FUNCTION public.bfe_listing_visible(p_record uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT cardinality(public.bfe_current_roles())>0 AND EXISTS(
 SELECT 1 FROM public.bfe_feature_records r WHERE r.id=p_record AND r.module IN ('businesses','buy-sell','jobs','garage-sales','workshops','booth-events','publishing') AND (
 (r.owner_id=auth.uid() AND public.bfe_can(CASE WHEN r.module='publishing' THEN 'community' ELSE 'livelihood' END,'view','own')) OR public.bfe_can(CASE WHEN r.module='publishing' THEN 'community' ELSE 'livelihood' END,'view','association') OR
 (r.status='Published' AND r.publication_consent AND r.expires_at>now() AND public.bfe_publication_audience_matches(r.audience,r.audiences,public.bfe_current_roles()) AND (public.bfe_can(CASE WHEN r.module='publishing' THEN 'community' ELSE 'livelihood' END,'view','own') OR public.bfe_can(CASE WHEN r.module='publishing' THEN 'community' ELSE 'livelihood' END,'view','approved')))));
$$;

-- Updated audience predicate only; source: 202611090029_resident_documents_livelihood.sql
CREATE OR REPLACE FUNCTION public.bfe_document_access(p_record uuid,p_write boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(cardinality(public.bfe_current_roles())>0 AND EXISTS(
 SELECT 1 FROM public.bfe_feature_records r WHERE r.id=p_record AND r.module='board-records' AND
 CASE WHEN p_write THEN r.owner_id=auth.uid() AND r.status='Submitted' AND r.publication_consent
   AND public.bfe_current_roles() && ARRAY['admin','developer']::text[] AND public.bfe_can('documents','create','association')
 ELSE (r.owner_id=auth.uid() AND public.bfe_can('documents','view','own')) OR public.bfe_can('documents','view','association')
  OR (r.status='Published' AND r.expires_at>now() AND public.bfe_publication_audience_matches(r.audience,r.audiences,public.bfe_current_roles()) AND public.bfe_can('documents','view','approved')) END
 ),false);
$$;

-- Updated audience predicate only; source: 202611090029_resident_documents_livelihood.sql
CREATE OR REPLACE FUNCTION public.bfe_document_library(p_search text DEFAULT '',p_category text DEFAULT '',p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; total bigint;
BEGIN
 IF NOT (public.bfe_can('documents','view','approved') OR public.bfe_can('documents','view','association')) THEN RAISE EXCEPTION 'Document access required.' USING ERRCODE='42501'; END IF;
 IF p_search IS NULL OR length(p_search)>100 OR p_category IS NULL OR length(p_category)>60 OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Check document filters.' USING ERRCODE='22023'; END IF;
 WITH visible AS(SELECT r.id,r.public_title AS title,r.public_body AS summary,
 coalesce((SELECT max(a.at) FROM public.bfe_feature_audit a WHERE a.record_id=r.id AND a.action='Published'),r.updated_at,r.created_at) AS created_at,
 r.fields->>'category' AS category,r.fields->>'version' AS version
 FROM public.bfe_feature_records r WHERE r.module='board-records' AND r.status='Published' AND r.expires_at>now() AND public.bfe_publication_audience_matches(r.audience,r.audiences,public.bfe_current_roles())
 AND (p_category='' OR r.fields->>'category'=p_category) AND position(lower(p_search) IN lower(coalesce(r.public_title,'')||' '||coalesce(r.public_body,'')))>0),
 page AS(SELECT * FROM visible ORDER BY created_at DESC,id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(to_jsonb(page) ORDER BY created_at DESC,id),'[]') INTO total,result FROM page;
 RETURN jsonb_build_object('rows',result,'total',total);
END;$$;

-- Updated audience predicate only; source: 202611090029_resident_documents_livelihood.sql
CREATE OR REPLACE FUNCTION public.bfe_livelihood_dashboard(p_module text,p_view text DEFAULT 'published',p_page integer DEFAULT 0,p_search text DEFAULT '',p_category text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; rows jsonb; total bigint;
BEGIN
 IF p_module IS NULL OR p_module NOT IN ('businesses','buy-sell','jobs','garage-sales') OR p_view IS DISTINCT FROM 'published'
 OR p_category IS NULL OR length(p_category)>80 THEN RAISE EXCEPTION 'Check livelihood filters.' USING ERRCODE='22023'; END IF;
 result:=public.bfe_feature_dashboard(p_module,p_view,p_page,p_search);
 WITH visible AS(SELECT r.* FROM public.bfe_feature_records r WHERE r.module=p_module AND r.status='Published' AND r.expires_at>now()
 AND public.bfe_publication_audience_matches(r.audience,r.audiences,public.bfe_current_roles())
 AND position(lower(p_search) IN lower(coalesce(r.public_title,'')||' '||coalesce(r.public_body,'')))>0
 AND (p_category='' OR r.fields->>'category'=p_category)),
 page AS(SELECT * FROM visible ORDER BY created_at DESC,id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(jsonb_build_object('id',id,'module',module,'title',public_title,'detail',public_body,'status',status,'expires_at',expires_at,'created_at',created_at,'fields',jsonb_strip_nulls(jsonb_build_object('category',fields->>'category','condition',fields->>'condition','price',CASE WHEN module='buy-sell' THEN fields->>'price' ELSE NULL END))) ORDER BY created_at DESC,id),'[]') INTO total,rows FROM page;
 RETURN result||jsonb_build_object('rows',rows,'total',total);
END;$$;

-- Updated audience predicate only; source: 202611130071_marketplace_priority.sql
CREATE OR REPLACE FUNCTION public.bfe_marketplace_feed(p_module text DEFAULT '',p_category text DEFAULT '',p_search text DEFAULT '',p_sort text DEFAULT 'latest',p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb; total bigint; postable jsonb;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0
 OR NOT (public.bfe_can('livelihood','view','approved') OR public.bfe_can('livelihood','view','own') OR public.bfe_can('livelihood','view','association')) THEN
  RAISE EXCEPTION 'Community marketplace access required.' USING ERRCODE='42501'; END IF;
 IF p_module IS NULL OR p_module NOT IN ('','businesses','buy-sell','jobs','garage-sales','booth-events','workshops') OR p_category IS NULL OR length(p_category)>80 OR p_search IS NULL OR length(p_search)>100 OR p_sort IS NULL OR p_sort NOT IN ('latest','price_low','price_high') OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN
  RAISE EXCEPTION 'Check marketplace filters.' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(d.code ORDER BY d.code),'[]') INTO postable FROM public.bfe_feature_definitions d
 WHERE d.code IN ('businesses','buy-sell','jobs','garage-sales','booth-events','workshops') AND
 ((d.resident_create AND public.bfe_current_roles() && ARRAY['homeowner','renter']::text[] AND public.bfe_can('livelihood','create','own')) OR public.bfe_can('livelihood','create','association'));
 WITH visible AS (
  SELECT r.*,EXISTS(SELECT 1 FROM public.bfe_marketplace_pins pin WHERE pin.record_id=r.id) AS promoted,CASE WHEN r.module='buy-sell' AND r.fields->>'price' ~ '^[0-9]+([.][0-9]+)?$' THEN (r.fields->>'price')::numeric ELSE NULL END AS asking_price
  FROM public.bfe_feature_records r WHERE r.module IN ('businesses','buy-sell','jobs','garage-sales','booth-events','workshops')
  AND r.status='Published' AND r.publication_consent AND r.expires_at>now()
  AND public.bfe_publication_audience_matches(r.audience,r.audiences,public.bfe_current_roles())
  AND (p_module='' OR r.module=p_module) AND (p_category='' OR r.fields->>'category'=p_category)
  AND position(lower(p_search) IN lower(coalesce(r.public_title,'')||' '||coalesce(r.public_body,'')))>0
 ), page AS (
  SELECT * FROM visible ORDER BY promoted DESC,
   CASE WHEN p_sort='price_low' THEN asking_price END ASC NULLS LAST,
   CASE WHEN p_sort='price_high' THEN asking_price END DESC NULLS LAST,
   created_at DESC,id OFFSET p_page*20 LIMIT 20
 )
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(jsonb_build_object(
  'id',id,'module',module,'title',public_title,'detail',public_body,'status',status,'expires_at',expires_at,'created_at',created_at,
  'fields',jsonb_strip_nulls(jsonb_build_object('category',fields->>'category','condition',fields->>'condition','price',CASE WHEN asking_price IS NOT NULL THEN fields->>'price' ELSE NULL END)))
  ORDER BY promoted DESC,CASE WHEN p_sort='price_low' THEN asking_price END ASC NULLS LAST,
   CASE WHEN p_sort='price_high' THEN asking_price END DESC NULLS LAST,created_at DESC,id),'[]') INTO total,rows FROM page;
 RETURN jsonb_build_object('rows',rows,'total',total,'postable_modules',postable,
  'can_manage_own',public.bfe_can('livelihood','view','own') OR public.bfe_can('livelihood','view','association'));
END;$$;

-- Updated audience predicate only; source: 202611100043_resident_calendar_month.sql
CREATE OR REPLACE FUNCTION public.bfe_resident_calendar_month(p_month date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE first_day date; next_month date; result jsonb; can_bookings boolean; can_events boolean; roles text[];
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 THEN RAISE EXCEPTION 'Active account required.' USING ERRCODE='42501'; END IF;
 IF p_month IS NULL THEN RAISE EXCEPTION 'Choose a calendar month.' USING ERRCODE='22023'; END IF;
 roles:=public.bfe_current_roles();
 can_bookings:=public.bfe_can('calendar','view','own') OR public.bfe_can('calendar','view','association');
 can_events:=public.bfe_can('community','view','own') OR public.bfe_can('community','view','approved') OR public.bfe_can('community','view','association');
 first_day:=date_trunc('month',p_month)::date; next_month:=(first_day+interval '1 month')::date;
 WITH dates AS (SELECT first_day+n AS day FROM generate_series(0,next_month-first_day-1)n), entries AS (
  SELECT d.day,f.name AS label,
    to_char(b.starts_at AT TIME ZONE 'Asia/Manila','HH24:MI')||' – '||to_char(b.ends_at AT TIME ZONE 'Asia/Manila','HH24:MI')||' · '||b.status AS detail,'booking' AS kind
  FROM public.bfe_bookings b JOIN public.bfe_facilities f ON f.id=b.facility_id
  JOIN dates d ON b.starts_at<((d.day+1)::timestamp AT TIME ZONE 'Asia/Manila') AND b.ends_at>(d.day::timestamp AT TIME ZONE 'Asia/Manila')
  WHERE b.owner_id=auth.uid() AND b.status IN ('Pending','Approved')
   AND can_bookings
  UNION ALL
  SELECT d.day,r.public_title,coalesce(nullif(concat_ws(' · ',nullif(r.fields->>'start',''),nullif(r.fields->>'venue','')),''),'Community event'),'event'
  FROM public.bfe_feature_records r JOIN dates d ON r.fields->>'date'=d.day::text
  WHERE r.module='events' AND r.status='Published' AND r.publication_consent AND r.expires_at>now()
   AND public.bfe_publication_audience_matches(r.audience,r.audiences,roles)
   AND can_events
 ) SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.day,e.kind,e.label),'[]'::jsonb) INTO result FROM entries e;
 RETURN result;
END;$$;

-- Updated audience predicate only; source: 202611100059_garage_sale_items.sql
CREATE OR REPLACE FUNCTION public.bfe_garage_items(p_record uuid DEFAULT NULL,p_office boolean DEFAULT false,p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE review boolean; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 THEN RAISE EXCEPTION 'Active account required.' USING ERRCODE='42501'; END IF;
 IF p_office IS NULL OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Check item filters.' USING ERRCODE='22023'; END IF;
 review:=public.bfe_can('livelihood','view','association');
 IF p_office AND NOT review THEN RAISE EXCEPTION 'Office listing access required.' USING ERRCODE='42501'; END IF;
 IF NOT p_office AND (p_record IS NULL OR NOT public.bfe_listing_visible(p_record)) THEN RAISE EXCEPTION 'Garage sale unavailable.' USING ERRCODE='42501'; END IF;
 WITH visible AS MATERIALIZED (
  SELECT i.*,CASE WHEN review OR r.owner_id=auth.uid() THEN r.title ELSE r.public_title END AS sale_title,r.owner_id=auth.uid() AS is_owner,r.owner_id=auth.uid() AND (public.bfe_can('livelihood','create','own') OR public.bfe_can('livelihood','create','association')) AND r.status IN ('Submitted','Published') AS can_edit,
   review AND public.bfe_can('livelihood','approve','association') AND public.bfe_can('livelihood','publish','association') AS can_moderate, review AND public.bfe_can('livelihood','approve','association') AND public.bfe_can('livelihood','publish','association') AND i.status='Submitted' AS can_review, r.status='Published' AND r.publication_consent AND r.expires_at>now() AS can_publish
  FROM public.bfe_garage_items i JOIN public.bfe_feature_records r ON r.id=i.record_id AND r.module='garage-sales'
  WHERE (p_record IS NULL OR i.record_id=p_record) AND (p_office OR review OR (r.owner_id=auth.uid() AND public.bfe_can('livelihood','view','own')) OR
   (i.status='Published' AND r.status='Published' AND r.publication_consent AND r.expires_at>now() AND public.bfe_publication_audience_matches(r.audience,r.audiences,public.bfe_current_roles())))
 ), page AS (SELECT * FROM visible ORDER BY updated_at DESC,id OFFSET p_page*20 LIMIT 20)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM visible),'rows',(SELECT coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('price_centavos',p.price_centavos::text,'review_note',CASE WHEN review OR p.is_owner THEN p.review_note ELSE '' END) ORDER BY updated_at DESC,id),'[]') FROM page p),
 'can_create',EXISTS(SELECT 1 FROM public.bfe_feature_records r WHERE r.id=p_record AND r.module='garage-sales' AND r.owner_id=auth.uid() AND r.status IN ('Submitted','Published') AND (public.bfe_can('livelihood','create','own') OR public.bfe_can('livelihood','create','association')))) INTO result;
 RETURN result;
END;$$;

NOTIFY pgrst,'reload schema';
COMMIT;
