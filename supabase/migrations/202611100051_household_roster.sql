-- Apply after 050. Restore named household occupants without creating accounts,
-- legal ownership, lot memberships or receipt entitlements. No roster is seeded.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_household_occupants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lot_id uuid NOT NULL REFERENCES public.bfe_lots(id),
 name text NOT NULL CHECK(char_length(btrim(name)) BETWEEN 1 AND 120),
 member_type text NOT NULL CHECK(char_length(btrim(member_type)) BETWEEN 1 AND 40),
 relationship text NOT NULL CHECK(char_length(btrim(relationship)) BETWEEN 1 AND 60),
 phone text NOT NULL DEFAULT '' CHECK(char_length(phone)<=40),
 active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1 CHECK(version>0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bfe_household_occupants_lot ON public.bfe_household_occupants(lot_id,active,name,id);
CREATE TABLE public.bfe_household_occupant_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,occupant_id uuid NOT NULL REFERENCES public.bfe_household_occupants(id),
 actor_id uuid NOT NULL,reference text NOT NULL,before_values jsonb,after_values jsonb NOT NULL,at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bfe_household_occupants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_household_occupant_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_household_occupants,public.bfe_household_occupant_audit FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bfe_household_roster(p_target uuid,p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE staff boolean; lots jsonb; rows jsonb; total bigint;
BEGIN
 staff:=auth.uid() IS NOT NULL AND cardinality(public.bfe_current_roles())>0 AND public.bfe_can('property','view','association');
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT (staff OR (p_target=auth.uid() AND public.bfe_can('property','view','own'))) THEN RAISE EXCEPTION 'Household roster access required.' USING ERRCODE='42501'; END IF;
 IF p_target IS NULL OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Check household filters.' USING ERRCODE='22023'; END IF;
 WITH permitted AS MATERIALIZED (
  SELECT DISTINCT l.id,l.physical_id FROM public.bfe_lot_memberships m JOIN public.bfe_lots l ON l.id=m.lot_id
  JOIN public.bfe_import_batches b ON b.id=l.batch_id AND b.status='active'
  WHERE m.user_id=p_target AND (staff OR m.relationship IN ('owner','renter')) AND m.state='approved' AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now())
 ), visible AS MATERIALIZED (
  SELECT o.*,l.physical_id FROM public.bfe_household_occupants o JOIN permitted l ON l.id=o.lot_id WHERE staff OR o.active
 ), page AS (SELECT * FROM visible ORDER BY active DESC,name,id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT coalesce(jsonb_agg(to_jsonb(l) ORDER BY l.physical_id),'[]') FROM permitted l),
  (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.active DESC,r.name,r.id),'[]') FROM page r),
  (SELECT count(*) FROM visible) INTO lots,rows,total;
 RETURN jsonb_build_object('lots',lots,'rows',rows,'total',total,'can_manage',staff AND 'admin'=ANY(public.bfe_current_roles()) AND public.bfe_can('property','manage','association'));
END;$$;
CREATE FUNCTION public.bfe_save_household_occupant(p_id uuid,p_lot uuid,p_version integer,p_name text,p_type text,p_relationship text,p_phone text,p_active boolean,p_reference text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE old_row public.bfe_household_occupants; new_row public.bfe_household_occupants;
BEGIN
 IF auth.uid() IS NULL OR NOT ('admin'=ANY(public.bfe_current_roles())) OR NOT public.bfe_can('property','view','association') OR NOT public.bfe_can('property','manage','association') THEN RAISE EXCEPTION 'Office property management required.' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_lot IS NULL OR p_version IS NULL OR p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 1 AND 120 OR p_type IS NULL OR char_length(btrim(p_type)) NOT BETWEEN 1 AND 40 OR p_relationship IS NULL OR char_length(btrim(p_relationship)) NOT BETWEEN 1 AND 60 OR p_phone IS NULL OR char_length(btrim(p_phone))>40 OR p_active IS NULL OR p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Check occupant details and verification reference.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('occupant:'||p_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.bfe_lots l JOIN public.bfe_import_batches b ON b.id=l.batch_id WHERE l.id=p_lot AND b.status='active') THEN RAISE EXCEPTION 'Choose an active imported lot.' USING ERRCODE='22023'; END IF;
 SELECT * INTO old_row FROM public.bfe_household_occupants WHERE id=p_id FOR UPDATE;
 IF old_row.id IS NOT NULL AND old_row.lot_id<>p_lot THEN RAISE EXCEPTION 'An occupant cannot be moved by changing a lot reference. End the old entry and create the reviewed new entry.' USING ERRCODE='22023'; END IF;
 IF old_row.id IS NOT NULL AND old_row.name=btrim(p_name) AND old_row.member_type=btrim(p_type) AND old_row.relationship=btrim(p_relationship) AND old_row.phone=btrim(p_phone) AND old_row.active=p_active THEN RETURN old_row.id; END IF;
 IF coalesce(old_row.version,0)<>p_version THEN RAISE EXCEPTION 'Occupant record changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
 INSERT INTO public.bfe_household_occupants(id,lot_id,name,member_type,relationship,phone,active)
 VALUES(p_id,p_lot,btrim(p_name),btrim(p_type),btrim(p_relationship),btrim(p_phone),p_active)
 ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,member_type=EXCLUDED.member_type,relationship=EXCLUDED.relationship,phone=EXCLUDED.phone,active=EXCLUDED.active,version=bfe_household_occupants.version+1,updated_at=now() RETURNING * INTO new_row;
 INSERT INTO public.bfe_household_occupant_audit(occupant_id,actor_id,reference,before_values,after_values)
 VALUES(p_id,auth.uid(),btrim(p_reference),CASE WHEN old_row.id IS NULL THEN NULL ELSE to_jsonb(old_row) END,to_jsonb(new_row));
 RETURN p_id;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_household_roster(uuid,integer),public.bfe_save_household_occupant(uuid,uuid,integer,text,text,text,text,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_household_roster(uuid,integer),public.bfe_save_household_occupant(uuid,uuid,integer,text,text,text,text,boolean,text) TO authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
