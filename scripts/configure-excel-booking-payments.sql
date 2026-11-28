-- OWNER RUN ONLY after 104 and after HOA supplies these values.
-- Do not put bank passwords, private API keys or credentials here.
-- instructions: published HOA payment instructions/link. Excel defines 20% of Total Booking Fee.
BEGIN;
DO $$
DECLARE instructions text:=NULL; basis text:='rental_and_bond'; reference text:=NULL;
BEGIN
 IF instructions IS NULL OR basis IS NULL OR reference IS NULL THEN
 RAISE EXCEPTION 'Fill in HOA-approved payment instructions and policy reference first. Nothing changed.'; END IF;
 INSERT INTO public.bfe_booking_payment_settings(singleton,instructions,reservation_basis,policy_reference)
 VALUES(true,instructions,basis,reference) ON CONFLICT(singleton) DO UPDATE SET instructions=EXCLUDED.instructions,reservation_basis=EXCLUDED.reservation_basis,policy_reference=EXCLUDED.policy_reference;
END;$$;
COMMIT;
