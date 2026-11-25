-- Owner-run after 096. Owner request, 25 November 2026: carpools posted before
-- 096 that are still waiting for office review should show in Community rides.
-- One-time update with the same rule as 096: only carpools whose owner gave
-- publication consent and whose departure date is from today up to one year
-- ahead. Carpools without consent, with a past date, or already decided
-- (Rejected, Withdrawn, Published) are left unchanged. No notifications are
-- sent for these older carpools.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';

WITH pending AS (
 SELECT r.id,((r.fields->>'date')::date+1)::timestamp AT TIME ZONE 'Asia/Manila' AS until
 FROM public.bfe_feature_records r
 WHERE r.module='carpools' AND r.status IN ('Submitted','In review','Reviewed')
  AND r.publication_consent AND coalesce(r.fields->>'date','') ~ '^\d{4}-\d{2}-\d{2}$'
 FOR UPDATE
), eligible AS (
 SELECT id,until FROM pending WHERE until>now() AND until<=now()+interval '366 days'
), published AS (
 UPDATE public.bfe_feature_records r
 SET status='Published',public_title=r.title,public_body=r.detail,
  audience='homeowner',expires_at=e.until,version=r.version+1,updated_at=now()
 FROM eligible e WHERE r.id=e.id
 RETURNING r.id,r.owner_id
)
INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note)
SELECT id,owner_id,'Published','Published to homeowners by the one-time carpool update (owner request)'
FROM published;

NOTIFY pgrst,'reload schema';
COMMIT;
