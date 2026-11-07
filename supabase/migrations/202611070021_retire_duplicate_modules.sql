-- Retire the resident-facing duplicates of the Helpdesk.
--
-- bfe_requests already accepts Complaint and Concern categories, and it carries
-- what those records need: threaded replies, status transitions and office
-- assignment. The `complaints` and `concerns` feature modules have none of
-- that, so a resident filing in one of them would get a record the office does
-- not watch and cannot reply to.
--
-- Migration 017 set resident_create=true on these to let residents raise
-- complaints. The real gap was discoverability — nothing in the interface said
-- the word "complaint" — and that was fixed by adding explicit entry points to
-- the Helpdesk. This reverts the flag, leaving one complaint channel.
--
-- The modules are not deleted. Existing records keep working, and the office
-- can still see them. Only the resident-facing create path is withdrawn.
--
-- Deliberately NOT changed:
--   gate-passes  Materials and crews may be a different record from a visiting
--                relative. That is an association policy question, not a code
--                one, and it stays resident-creatable until it is answered.
--   walk-ins     Same decision, same reason.
BEGIN;

UPDATE public.bfe_feature_definitions
SET resident_create = false
WHERE code IN ('complaints', 'concerns');

NOTIFY pgrst,'reload schema';
COMMIT;

-- To check which modules residents may still create:
--   SELECT code, capability FROM public.bfe_feature_definitions
--   WHERE resident_create ORDER BY code;
