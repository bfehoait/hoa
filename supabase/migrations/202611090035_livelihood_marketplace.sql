-- Apply after 034. Community marketplace reads; no listings are seeded.
-- Published-only browse baseline. Existing role/user rules and denials win.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
INSERT INTO public.bfe_tab_rules(subject_kind,subject_id,module,scope,mode)
SELECT 'role',role,'livelihood','approved','view'
FROM unnest(ARRAY['homeowner','renter','admin','board','security','driver']) role
ON CONFLICT DO NOTHING;

CREATE FUNCTION public.bfe_marketplace_feed(p_module text DEFAULT '',p_category text DEFAULT '',p_search text DEFAULT '',p_sort text DEFAULT 'latest',p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb; total bigint; postable jsonb;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0
 OR NOT (public.bfe_can('livelihood','view','approved') OR public.bfe_can('livelihood','view','own') OR public.bfe_can('livelihood','view','association')) THEN
  RAISE EXCEPTION 'Community marketplace access required.' USING ERRCODE='42501'; END IF;
 IF p_module IS NULL OR p_module NOT IN ('','businesses','buy-sell','jobs','garage-sales') OR p_category IS NULL OR length(p_category)>80 OR p_search IS NULL OR length(p_search)>100 OR p_sort IS NULL OR p_sort NOT IN ('latest','price_low','price_high') OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN
  RAISE EXCEPTION 'Check marketplace filters.' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(d.code ORDER BY d.code),'[]') INTO postable FROM public.bfe_feature_definitions d
 WHERE d.code IN ('businesses','buy-sell','jobs','garage-sales') AND
 ((d.resident_create AND public.bfe_current_roles() && ARRAY['homeowner','renter']::text[] AND public.bfe_can('livelihood','create','own')) OR public.bfe_can('livelihood','create','association'));
 WITH visible AS (
  SELECT r.*,CASE WHEN r.module='buy-sell' AND r.fields->>'price' ~ '^[0-9]+([.][0-9]+)?$' THEN (r.fields->>'price')::numeric ELSE NULL END AS asking_price
  FROM public.bfe_feature_records r WHERE r.module IN ('businesses','buy-sell','jobs','garage-sales')
  AND r.status='Published' AND r.publication_consent AND r.expires_at>now()
  AND (r.audience='members' OR r.audience=ANY(public.bfe_current_roles()))
  AND (p_module='' OR r.module=p_module) AND (p_category='' OR r.fields->>'category'=p_category)
  AND position(lower(p_search) IN lower(coalesce(r.public_title,'')||' '||coalesce(r.public_body,'')))>0
 ), page AS (
  SELECT * FROM visible ORDER BY
   CASE WHEN p_sort='price_low' THEN asking_price END ASC NULLS LAST,
   CASE WHEN p_sort='price_high' THEN asking_price END DESC NULLS LAST,
   created_at DESC,id OFFSET p_page*20 LIMIT 20
 )
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(jsonb_build_object(
  'id',id,'module',module,'title',public_title,'detail',public_body,'status',status,'expires_at',expires_at,'created_at',created_at,
  'fields',jsonb_strip_nulls(jsonb_build_object('category',fields->>'category','condition',fields->>'condition','price',CASE WHEN asking_price IS NOT NULL THEN fields->>'price' ELSE NULL END)))
  ORDER BY CASE WHEN p_sort='price_low' THEN asking_price END ASC NULLS LAST,
   CASE WHEN p_sort='price_high' THEN asking_price END DESC NULLS LAST,created_at DESC,id),'[]') INTO total,rows FROM page;
 RETURN jsonb_build_object('rows',rows,'total',total,'postable_modules',postable,
  'can_manage_own',public.bfe_can('livelihood','view','own') OR public.bfe_can('livelihood','view','association'));
END;$$;
REVOKE ALL ON FUNCTION public.bfe_marketplace_feed(text,text,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_marketplace_feed(text,text,text,text,integer) TO authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
