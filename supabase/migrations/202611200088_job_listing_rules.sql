-- Owner-run after 085 (independent of 086 and 087). Owner request, 20 November 2026,
-- for Livelihood > Post a listing > Jobs & referrals:
--  * Job type no longer offers "One-off".
--  * Pay description becomes optional.
--  * A job listing stops showing once its application deadline has passed: its
--    publication expiry can never be later than the end of the deadline day in
--    Philippine time (Asia/Manila). Published listings already past their
--    deadline disappear when this runs.
-- Existing listings keep their saved job type and pay. Only the jobs definition,
-- a new expiry trigger and the expiry of existing job listings change.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';

UPDATE public.bfe_feature_definitions d
SET fields=(
  SELECT jsonb_agg(
    CASE f->>'key'
      WHEN 'jobType' THEN jsonb_set(f,'{options}',(SELECT coalesce(jsonb_agg(o),'[]'::jsonb) FROM jsonb_array_elements(f->'options') o WHERE o<>'"One-off"'::jsonb))
      WHEN 'pay' THEN jsonb_set(f,'{required}','false'::jsonb)
      ELSE f END
    ORDER BY i)
  FROM jsonb_array_elements(d.fields) WITH ORDINALITY AS t(f,i))
WHERE d.code='jobs';

-- End of the deadline day in Philippine time, or NULL when no valid date is saved.
CREATE OR REPLACE FUNCTION public.bfe_job_deadline_end(p_fields jsonb) RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v text:=p_fields->>'deadline';
BEGIN
 IF v IS NULL OR v !~ '^\d{4}-\d{2}-\d{2}$' THEN RETURN NULL; END IF;
 RETURN ((v::date+1)::timestamp AT TIME ZONE 'Asia/Manila');
EXCEPTION WHEN others THEN RETURN NULL;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_job_deadline_end(jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.bfe_cap_job_expiry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cutoff timestamptz:=public.bfe_job_deadline_end(NEW.fields);
BEGIN
 IF NEW.module='jobs' AND NEW.expires_at IS NOT NULL AND cutoff IS NOT NULL AND NEW.expires_at>cutoff THEN
  NEW.expires_at:=cutoff;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_cap_job_expiry() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS bfe_cap_job_expiry ON public.bfe_feature_records;
CREATE TRIGGER bfe_cap_job_expiry BEFORE INSERT OR UPDATE OF expires_at,fields ON public.bfe_feature_records
FOR EACH ROW WHEN (NEW.module='jobs') EXECUTE FUNCTION public.bfe_cap_job_expiry();

-- Apply the same cap to job listings that already have an expiry.
UPDATE public.bfe_feature_records r
SET expires_at=public.bfe_job_deadline_end(r.fields)
WHERE r.module='jobs' AND r.expires_at IS NOT NULL
  AND public.bfe_job_deadline_end(r.fields) IS NOT NULL
  AND r.expires_at>public.bfe_job_deadline_end(r.fields);

DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.bfe_feature_definitions WHERE code='jobs'
    AND fields @> '[{"key":"pay","required":false}]'::jsonb)
    OR EXISTS(SELECT 1 FROM public.bfe_feature_definitions WHERE code='jobs'
    AND fields @> '[{"key":"jobType","options":["One-off"]}]'::jsonb)
  THEN RAISE EXCEPTION 'jobs definition was not updated.'; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
