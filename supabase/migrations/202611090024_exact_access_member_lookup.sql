-- Extend the existing protected picker, not the record monitor projection.
-- Email searches match exactly; ordinary name/unit searches retain pagination.
-- No permission grants or account changes. Apply after 023.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE OR REPLACE FUNCTION public.bfe_access_members(
 p_search text DEFAULT '', p_page integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_rows jsonb;
 v_total bigint;
 v_search text := lower(btrim(p_search));
 v_exact boolean := position('@' IN coalesce(p_search,'')) > 0;
BEGIN
 IF NOT public.bfe_is_access_manager() THEN
  RAISE EXCEPTION 'Access manager required.' USING ERRCODE='42501';
 END IF;
 IF p_search IS NULL
    OR char_length(p_search) > (CASE WHEN v_exact THEN 254 ELSE 100 END)
    OR p_page IS NULL OR p_page < 0 OR p_page > 10000 THEN
  RAISE EXCEPTION 'Invalid search.' USING ERRCODE='22023';
 END IF;

 SELECT count(*) INTO v_total
 FROM public.members m
 WHERE m.user_id IS NOT NULL
   AND (SELECT count(*) FROM public.members d WHERE d.user_id=m.user_id)=1
   AND CASE WHEN v_exact THEN lower(btrim(m.email))=v_search
       ELSE position(lower(p_search) IN lower(coalesce(m.name,'')||' '||coalesce(m.unit,'')))>0
       END;

 SELECT coalesce(jsonb_agg(to_jsonb(page) ORDER BY page.name,page.user_id),'[]'::jsonb)
 INTO v_rows FROM (
  SELECT m.user_id,m.name,m.unit,m.role,m.extra_roles,m.status
  FROM public.members m
  WHERE m.user_id IS NOT NULL
    AND (SELECT count(*) FROM public.members d WHERE d.user_id=m.user_id)=1
    AND CASE WHEN v_exact THEN lower(btrim(m.email))=v_search
        ELSE position(lower(p_search) IN lower(coalesce(m.name,'')||' '||coalesce(m.unit,'')))>0
        END
  ORDER BY m.name,m.user_id OFFSET p_page*20 LIMIT 20
 ) page;

 RETURN jsonb_build_object(
  'rows',v_rows,'total',v_total,
  'lookup_mode',CASE WHEN v_exact THEN 'email_exact' ELSE 'name_unit' END
 );
END;
$$;

-- Preserve the existing authentication and access-manager checks.
REVOKE ALL ON FUNCTION public.bfe_access_members(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_access_members(text,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
