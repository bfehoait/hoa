-- Apply after 042. Complete month projection; never exposes other residents' bookings.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.bfe_resident_calendar_month(p_month date) RETURNS jsonb
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
   AND (r.audience='members' OR r.audience=ANY(roles))
   AND can_events
 ) SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.day,e.kind,e.label),'[]'::jsonb) INTO result FROM entries e;
 RETURN result;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_resident_calendar_month(date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_resident_calendar_month(date) TO authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
