-- Apply after 038. Staff calendar reads existing bookings only; no PDF import,
-- facility setup, approval decisions or permission grants are performed.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.bfe_office_facility_calendar(p_month date,p_facility uuid DEFAULT NULL,p_status text DEFAULT '',p_day date DEFAULT NULL,p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE first_day date; next_month date; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT public.bfe_can('calendar','view','association') THEN
  RAISE EXCEPTION 'Facility calendar access required.' USING ERRCODE='42501'; END IF;
 IF p_month IS NULL OR p_status IS NULL OR p_status NOT IN ('','Pending','Approved','Rejected','Cancelled') OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN
  RAISE EXCEPTION 'Check calendar filters.' USING ERRCODE='22023'; END IF;
 first_day:=date_trunc('month',p_month)::date; next_month:=(first_day+interval '1 month')::date;
 IF p_day IS NULL OR p_day<first_day OR p_day>=next_month THEN RAISE EXCEPTION 'Choose a day in this month.' USING ERRCODE='22023'; END IF;
 WITH visible AS MATERIALIZED (
  SELECT r.*,f.name AS facility_name FROM public.bfe_bookings r JOIN public.bfe_facilities f ON f.id=r.facility_id
  WHERE r.starts_at<(next_month::timestamp AT TIME ZONE 'Asia/Manila') AND r.ends_at>(first_day::timestamp AT TIME ZONE 'Asia/Manila')
  AND (p_facility IS NULL OR r.facility_id=p_facility) AND (p_status='' OR r.status=p_status)
 ), dates AS (
  SELECT first_day+n AS day FROM generate_series(0,next_month-first_day-1)n
 ), selected AS MATERIALIZED (
  SELECT * FROM visible WHERE starts_at<((p_day+1)::timestamp AT TIME ZONE 'Asia/Manila') AND ends_at>(p_day::timestamp AT TIME ZONE 'Asia/Manila')
 ), page AS (
  SELECT * FROM selected ORDER BY starts_at,facility_name,id OFFSET p_page*20 LIMIT 20
 ), days AS (
  SELECT d.day,count(v.id) AS total,count(v.id) FILTER(WHERE v.status='Pending') AS pending,count(v.id) FILTER(WHERE v.status='Approved') AS approved
  FROM dates d LEFT JOIN visible v ON v.starts_at<((d.day+1)::timestamp AT TIME ZONE 'Asia/Manila') AND v.ends_at>(d.day::timestamp AT TIME ZONE 'Asia/Manila') GROUP BY d.day
 ) SELECT jsonb_build_object(
  'days',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.day),'[]'::jsonb) FROM days d),
  'rows',(SELECT coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('requestor',coalesce((SELECT m.name FROM public.members m WHERE m.user_id=p.owner_id LIMIT 1),'Account holder')) ORDER BY p.starts_at,p.facility_name,p.id),'[]'::jsonb) FROM page p),
  'total',(SELECT count(*) FROM selected),
  'month_total',(SELECT count(*) FROM visible),
  'facilities',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'active',f.active) ORDER BY f.name),'[]'::jsonb) FROM public.bfe_facilities f)
 ) INTO result;
 RETURN result;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_office_facility_calendar(date,uuid,text,date,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_office_facility_calendar(date,uuid,text,date,integer) TO authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
