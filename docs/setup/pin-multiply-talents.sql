-- Owner-run configuration AFTER migration 071. No live SQL is run by Codex.
-- STEP 1: Run this SELECT separately and verify the official business record.
-- A matching name alone is not proof of ownership. Do not pin an imitation.
SELECT id,public_title,module,status,expires_at
FROM public.bfe_feature_records
WHERE module='businesses'
 AND public_title ILIKE '%multiply%talents%'
ORDER BY created_at DESC,id;

-- STEP 2: Replace NULL below with the verified UUID, quoted, then run the
-- transaction separately. Leaving NULL intentionally prevents configuration.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $pin$
DECLARE chosen uuid := NULL; -- Replace with 'verified-record-uuid'::uuid
BEGIN
 IF chosen IS NULL THEN
  RAISE EXCEPTION 'Set chosen to the verified Multiply Talents listing UUID first.';
 END IF;
 PERFORM 1 FROM public.bfe_feature_records
 WHERE id=chosen AND module='businesses' AND status='Published'
  AND publication_consent AND expires_at>now()
 FOR UPDATE;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Choose a published, consented, unexpired business listing.';
 END IF;
 INSERT INTO public.bfe_marketplace_pins(slot,record_id)
 VALUES('multiply-talents',chosen)
 ON CONFLICT(slot) DO UPDATE SET record_id=EXCLUDED.record_id,updated_at=now();
END;
$pin$;
COMMIT;

-- STEP 3: Verify the selected record, then reload Livelihood in the browser.
SELECT pin.slot,r.id,r.public_title,r.status,r.expires_at
FROM public.bfe_marketplace_pins pin
JOIN public.bfe_feature_records r ON r.id=pin.record_id;

-- To remove priority later, run this separately:
-- DELETE FROM public.bfe_marketplace_pins WHERE slot='multiply-talents';
