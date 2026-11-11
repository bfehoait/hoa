-- Apply after 039. Read-only role filtering for the existing access manager.
-- Matches 024's account selection; no role, tab rule or permission is changed.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.bfe_filtered_access_members(p_search text DEFAULT '',p_role text DEFAULT '',p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb; n bigint; exact boolean:=position('@' IN coalesce(p_search,''))>0;
BEGIN
 IF NOT public.bfe_is_access_manager() THEN RAISE EXCEPTION 'Access manager required.' USING ERRCODE='42501'; END IF;
 IF p_search IS NULL OR length(p_search)>(CASE WHEN exact THEN 254 ELSE 100 END) OR p_role IS NULL
 OR p_role NOT IN ('','homeowner','renter','admin','board','security','driver','developer') OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN
  RAISE EXCEPTION 'Invalid account filters.' USING ERRCODE='22023'; END IF;
 WITH visible AS MATERIALIZED (
  SELECT m.user_id,m.name,m.unit,m.role,m.extra_roles,m.status FROM public.members m
  WHERE m.user_id IS NOT NULL AND (SELECT count(*) FROM public.members d WHERE d.user_id=m.user_id)=1
  AND (p_role='' OR m.role=p_role OR p_role=ANY(coalesce(m.extra_roles,'{}'::text[])))
  AND CASE WHEN exact THEN lower(btrim(m.email))=lower(btrim(p_search))
   ELSE position(lower(p_search) IN lower(coalesce(m.name,'')||' '||coalesce(m.unit,'')))>0 END
 ), page AS (SELECT * FROM visible ORDER BY name,user_id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.name,p.user_id),'[]'::jsonb) INTO n,rows FROM page p;
 RETURN jsonb_build_object('rows',rows,'total',n,'lookup_mode',CASE WHEN exact THEN 'email_exact' ELSE 'name_unit' END);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_filtered_access_members(text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_filtered_access_members(text,text,integer) TO authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
