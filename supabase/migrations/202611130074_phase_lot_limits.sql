-- Owner-run AFTER 073. Enforces the supplied phase-specific ranges for NEW
-- resident accounts/applications only. Existing address/history is untouched.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.bfe_lot_address_in_phase(p_unit text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(CASE
 WHEN p_unit ~ '^[1-3]-[0-9]{2}-[0-9]{3}$' THEN
  split_part(p_unit,'-',2)::integer BETWEEN 1 AND
   CASE left(p_unit,1) WHEN '1' THEN 19 WHEN '2' THEN 9 ELSE 1 END
  AND split_part(p_unit,'-',3)::integer BETWEEN 1 AND
   CASE left(p_unit,1) WHEN '1' THEN 111 WHEN '2' THEN 36 ELSE 54 END
 ELSE false END,false);
$$;
CREATE FUNCTION public.bfe_new_resident_lot_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.role IN ('homeowner','renter') AND NOT public.bfe_lot_address_in_phase(NEW.unit) THEN
  RAISE EXCEPTION 'Check phase/block/lot: Phase 1 blocks 01-19 lots 001-111; Phase 2 blocks 01-09 lots 001-036; Phase 3 block 01 lots 001-054.' USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_lot_address_in_phase(text),public.bfe_new_resident_lot_guard() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bfe_new_registration_lot_guard BEFORE INSERT ON public.registrations
 FOR EACH ROW EXECUTE FUNCTION public.bfe_new_resident_lot_guard();
CREATE TRIGGER bfe_new_member_lot_guard BEFORE INSERT ON public.members
 FOR EACH ROW EXECUTE FUNCTION public.bfe_new_resident_lot_guard();
NOTIFY pgrst,'reload schema';
COMMIT;
