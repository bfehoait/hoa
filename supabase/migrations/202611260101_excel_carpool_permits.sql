-- HOA.xlsx carpool sections and permit labels. AFTER 100. No automatic role assignments.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE OR REPLACE FUNCTION public.bfe_excel_carpool_dashboard(p_module text,p_view text DEFAULT 'mine',p_page integer DEFAULT 0,p_search text DEFAULT '',p_kind text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.bfe_feature_definitions; rows jsonb; n bigint; manager boolean; creator boolean;
BEGIN
 IF p_module<>'carpools' OR p_kind IS NULL OR p_kind NOT IN ('','Offering a ride','Looking for a ride') THEN RAISE EXCEPTION 'Choose carpool offers or requests.' USING ERRCODE='22023'; END IF;
 SELECT * INTO d FROM public.bfe_feature_definitions WHERE code=p_module;
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR d.code IS NULL THEN RAISE EXCEPTION 'Active membership required.' USING ERRCODE='42501'; END IF;
 IF p_view IS NULL OR p_view NOT IN ('mine','review','published') OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 OR p_search IS NULL OR length(p_search)>100 THEN RAISE EXCEPTION 'Invalid feature filters.' USING ERRCODE='22023'; END IF;
 manager:=public.bfe_can(d.capability,'view','association');
 creator:=(d.resident_create AND public.bfe_current_roles() && ARRAY['homeowner','renter']::text[] AND public.bfe_can(d.capability,'create','own')) OR public.bfe_can(d.capability,'create','association');
 IF p_view='review' AND NOT manager THEN RAISE EXCEPTION 'Review access required.' USING ERRCODE='42501'; END IF;
 IF p_view='mine' AND NOT (public.bfe_can(d.capability,'view','own') OR manager) THEN RAISE EXCEPTION 'Own record access required.' USING ERRCODE='42501'; END IF;
 IF p_view='published' AND NOT (public.bfe_can(d.capability,'view','approved') OR public.bfe_can(d.capability,'view','own') OR manager) THEN RAISE EXCEPTION 'Published content access required.' USING ERRCODE='42501'; END IF;
 WITH visible AS (
  SELECT r.* FROM public.bfe_feature_records r WHERE r.module=p_module AND (p_kind='' OR r.fields->>'kind'=p_kind) AND
   CASE p_view WHEN 'mine' THEN r.owner_id=auth.uid() WHEN 'review' THEN true ELSE r.status='Published' AND r.expires_at>now() AND public.bfe_publication_audience_matches(r.audience,r.audiences,public.bfe_current_roles()) END
   AND position(lower(p_search) IN lower(CASE WHEN p_view='published' THEN coalesce(r.public_title,'')||' '||coalesce(r.public_body,'') ELSE r.title||' '||r.detail END))>0
 ), page AS (SELECT * FROM visible ORDER BY created_at DESC,id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(CASE WHEN p_view='published' THEN jsonb_build_object('id',id,'module',module,'title',public_title,'detail',public_body,'status',status,'expires_at',expires_at,'created_at',created_at,'fields',jsonb_build_object('kind',fields->>'kind'))||CASE WHEN module='events' THEN jsonb_build_object('fields',jsonb_strip_nulls(jsonb_build_object('date',fields->>'date','start',fields->>'start','end',fields->>'end','venue',fields->>'venue'))) ELSE '{}'::jsonb END ELSE to_jsonb(page) END ORDER BY created_at DESC,id),'[]') INTO n,rows FROM page;
 RETURN jsonb_build_object('rows',rows,'total',n,'can_create',creator,'can_review',manager AND public.bfe_can(d.capability,'status','association'),'can_publish',manager AND public.bfe_can(d.capability,'publish','association') AND d.publishable,'publishable',d.publishable);
END;$$;

REVOKE ALL ON FUNCTION public.bfe_excel_carpool_dashboard(text,text,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_excel_carpool_dashboard(text,text,integer,text,text) TO authenticated;
-- Preserve historical permit answers. Only new form metadata is renamed.
UPDATE public.bfe_feature_definitions SET fields=replace(replace(fields::text,'"Construction"','"Construction Permit"'),'"Renovation"','"Renovation Permit"')::jsonb WHERE code='permits';
NOTIFY pgrst,'reload schema';
COMMIT;
