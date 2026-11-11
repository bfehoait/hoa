-- TEST CONFIGURATION — NOT ASSOCIATION POLICY.
--
-- Every value below is a placeholder chosen only so the booking and shuttle
-- features can be exercised end to end. Opening hours, slot lengths,
-- capacities, facility names and shuttle details are decisions for the
-- association. Replace them, or delete these rows, before anyone treats this
-- as the real schedule.
--
-- This is deliberately NOT a migration. Migrations describe the system; this
-- describes one test environment, and it should not be replayed anywhere that
-- matters.
--
-- Run it in the SQL editor as the project owner. It writes directly to the
-- tables rather than through bfe_configure_facility / bfe_configure_shuttle,
-- because those require an account holding calendar/manage/association and the
-- developer role respectively. Using them from the app is the real path; this
-- is a shortcut for setting up a test.
-- Deliberate opt-in for an isolated test database. Do not enable this on the
-- resident-facing production database. The script refuses to run by default.
-- In a test database only, change the next setting to 'on' after BEGIN.
BEGIN;
SET LOCAL app.bfe_allow_synthetic_configuration = 'off';
DO $$
BEGIN
 IF current_setting('app.bfe_allow_synthetic_configuration',true) IS DISTINCT FROM 'on' THEN
  RAISE EXCEPTION 'Synthetic test configuration is disabled. Use an isolated test database and explicitly opt in.';
 END IF;
END;
$$;

-- 1. Facilities ------------------------------------------------------------
-- slot_minutes must be 15, 30 or 60; max_minutes must be a multiple of it.
INSERT INTO public.bfe_facilities
  (name, opens, closes, slot_minutes, max_minutes, capacity, renters, active, policy_reference)
VALUES
  ('SYNTHETIC TEST - Function hall',    '08:00', '22:00', 60, 480, 120, true,  true,
   'TEST CONFIGURATION — placeholder hours and capacity, not approved policy'),
  ('SYNTHETIC TEST - Basketball court', '06:00', '22:00', 30, 240,  30, true,  true,
   'TEST CONFIGURATION — placeholder hours and capacity, not approved policy'),
  ('SYNTHETIC TEST - Clubhouse',        '08:00', '21:00', 60, 360,  60, false, true,
   'TEST CONFIGURATION — placeholder hours and capacity, not approved policy')
ON CONFLICT (name) DO NOTHING;

-- 2. Shuttle ---------------------------------------------------------------
-- bfe_shuttles.driver_id must belong to an account whose roles include
-- 'driver'. Create a driver auth user first, then put its UUID below and
-- uncomment this block.
--
-- INSERT INTO public.members (user_id, email, name, unit, role, extra_roles, status)
-- VALUES ('<driver-user-uuid>', 'driver.test@example.invalid', 'Test Driver',
--         '', 'driver', '{}', 'Active');
--
-- INSERT INTO public.bfe_shuttles
--   (code, driver_id, driver_name, contact, capacity, active, ready, approval_reference)
-- VALUES ('Shuttle 1', '<driver-user-uuid>', 'Test Driver', '', 12, true, true,
--         'TEST CONFIGURATION — placeholder roster entry, not an approved assignment')
-- ON CONFLICT (code) DO UPDATE SET
--   driver_id = excluded.driver_id, driver_name = excluded.driver_name,
--   capacity = excluded.capacity, active = excluded.active,
--   approval_reference = excluded.approval_reference;

COMMIT;

-- To remove this test configuration again:
--   DELETE FROM public.bfe_bookings  WHERE facility_id IN
--     (SELECT id FROM public.bfe_facilities WHERE policy_reference LIKE 'TEST CONFIGURATION%');
--   DELETE FROM public.bfe_facilities WHERE policy_reference LIKE 'TEST CONFIGURATION%';
--   DELETE FROM public.bfe_shuttles   WHERE approval_reference LIKE 'TEST CONFIGURATION%';
