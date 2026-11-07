-- Apply once after 001-004 to an approved private staging project.
-- No accounts, assignments, workbook values or legacy policies are changed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE public.bfe_import_batches (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 checksum text NOT NULL UNIQUE CHECK(checksum ~ '^[a-f0-9]{64}$'),
 source_name text NOT NULL CHECK(char_length(source_name) BETWEEN 1 AND 200),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','withdrawn')),
 lot_count integer NOT NULL, receipt_count integer NOT NULL,
 total_centavos bigint NOT NULL, imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.bfe_lots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 physical_id text NOT NULL UNIQUE CHECK(physical_id ~ '^[1-9][0-9]*-[0-9]{2}-[0-9]{3}$'),
 phase integer NOT NULL CHECK(phase>0), block integer NOT NULL CHECK(block>0),
 lot integer NOT NULL CHECK(lot>0), admin_unit text NOT NULL,
 registry_status text NOT NULL, review_priority text NOT NULL CHECK(review_priority IN ('LOW','MEDIUM','HIGH')),
 recorded_homeowner text NOT NULL DEFAULT '',
 corrected_homeowner text, version integer NOT NULL DEFAULT 1,
 batch_id uuid NOT NULL REFERENCES public.bfe_import_batches(id),
 CHECK(physical_id=phase::text||'-'||lpad(block::text,2,'0')||'-'||lpad(lot::text,3,'0'))
);
CREATE TABLE public.bfe_lot_evidence (
 lot_id uuid PRIMARY KEY REFERENCES public.bfe_lots(id), source_row integer NOT NULL CHECK(source_row>1),
 fields jsonb NOT NULL CHECK(jsonb_typeof(fields)='object')
);
CREATE TABLE public.bfe_lot_memberships (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lot_id uuid NOT NULL REFERENCES public.bfe_lots(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 relationship text NOT NULL CHECK(relationship IN ('owner','renter','household')),
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected','revoked')),
 starts_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz,
 reference text NOT NULL DEFAULT '', approved_by uuid, updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(expires_at IS NULL OR expires_at>starts_at)
);
CREATE UNIQUE INDEX bfe_lot_open_membership ON public.bfe_lot_memberships(lot_id,user_id,relationship) WHERE state IN ('pending','approved');
CREATE INDEX bfe_lot_member_user ON public.bfe_lot_memberships(user_id,lot_id);
CREATE TABLE public.bfe_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lot_id uuid NOT NULL REFERENCES public.bfe_lots(id),
 or_number text NOT NULL UNIQUE CHECK(char_length(btrim(or_number)) BETWEEN 1 AND 100), receipt_date date NOT NULL,
 amount_centavos bigint NOT NULL CHECK(amount_centavos>0 AND amount_centavos<=9007199254740991),
 account_series text NOT NULL, payer text NOT NULL, source_file text NOT NULL,
 source_row integer NOT NULL CHECK(source_row>1), batch_id uuid NOT NULL REFERENCES public.bfe_import_batches(id)
);
CREATE INDEX bfe_receipt_lot_date ON public.bfe_receipts(lot_id,receipt_date DESC,id);
CREATE TABLE public.bfe_receipt_entitlements (
 membership_id uuid NOT NULL REFERENCES public.bfe_lot_memberships(id),
 receipt_id uuid NOT NULL REFERENCES public.bfe_receipts(id),
 reference text NOT NULL CHECK(char_length(btrim(reference)) BETWEEN 3 AND 200),
 approved_by uuid NOT NULL, approved_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
 PRIMARY KEY(membership_id,receipt_id)
);
CREATE TABLE public.bfe_registry_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, lot_id uuid REFERENCES public.bfe_lots(id),
 batch_id uuid REFERENCES public.bfe_import_batches(id), actor_id uuid,
 at timestamptz NOT NULL DEFAULT now(), database_session text NOT NULL DEFAULT session_user,
 action text NOT NULL, details jsonb NOT NULL DEFAULT '{}'
);

CREATE FUNCTION public.bfe_registry_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND public.bfe_can('property','view','association');
$$;
CREATE FUNCTION public.bfe_lot_link(p_lot uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT cardinality(public.bfe_current_roles())>0 AND EXISTS(
 SELECT 1 FROM public.bfe_lot_memberships m JOIN public.bfe_lots l ON l.id=m.lot_id
 JOIN public.bfe_import_batches b ON b.id=l.batch_id
 WHERE m.user_id=auth.uid() AND m.lot_id=p_lot AND m.state='approved'
 AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now()) AND b.status='active');
$$;
CREATE FUNCTION public.bfe_lot_read(p_lot uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.bfe_lots l
 JOIN public.bfe_import_batches b ON b.id=l.batch_id WHERE l.id=p_lot AND b.status='active'
 AND (public.bfe_registry_staff() OR public.bfe_can('finance','view','association') OR public.bfe_lot_link(l.id)));
$$;
CREATE FUNCTION public.bfe_receipt_read(p_receipt uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.bfe_receipts r
 JOIN public.bfe_import_batches b ON b.id=r.batch_id JOIN public.bfe_lots l ON l.id=r.lot_id
 JOIN public.bfe_import_batches lb ON lb.id=l.batch_id
 WHERE r.id=p_receipt AND b.status='active' AND lb.status='active' AND (
 public.bfe_can('finance','view','association') OR (
 public.bfe_can('finance','view','own') AND EXISTS(SELECT 1 FROM public.bfe_receipt_entitlements e
 JOIN public.bfe_lot_memberships m ON m.id=e.membership_id
 WHERE e.receipt_id=r.id AND e.revoked_at IS NULL AND m.lot_id=r.lot_id AND m.user_id=auth.uid()
 AND m.relationship='owner' AND m.state='approved' AND m.starts_at<=now()
 AND (m.expires_at IS NULL OR m.expires_at>now())))));
$$;

-- Browser writes go through validated operations; private evidence has no browser grants.
ALTER TABLE public.bfe_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_lot_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_lot_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_receipt_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_registry_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_import_batches,public.bfe_lots,public.bfe_lot_evidence,public.bfe_lot_memberships,public.bfe_receipts,public.bfe_receipt_entitlements,public.bfe_registry_audit FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.bfe_registry_audit_id_seq FROM PUBLIC,anon,authenticated;
CREATE POLICY bfe_lot_read ON public.bfe_lots FOR SELECT TO authenticated USING(public.bfe_lot_read(id));
CREATE POLICY bfe_receipt_read ON public.bfe_receipts FOR SELECT TO authenticated USING(public.bfe_receipt_read(id));

CREATE FUNCTION public.bfe_list_lots(p_search text DEFAULT '',p_phase integer DEFAULT 0,p_status text DEFAULT '',p_review text DEFAULT '',p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb; n bigint;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 THEN RAISE EXCEPTION 'Active membership required.' USING ERRCODE='42501';END IF;
 IF p_search IS NULL OR char_length(p_search)>100 OR p_phase IS NULL OR p_phase<0 OR p_status IS NULL OR char_length(p_status)>100 OR p_review IS NULL OR p_review NOT IN ('','LOW','MEDIUM','HIGH') OR p_page IS NULL OR p_page<0 OR p_page>10000 THEN RAISE EXCEPTION 'Invalid registry filters.' USING ERRCODE='22023';END IF;
 SELECT count(*) INTO n FROM public.bfe_lots l WHERE public.bfe_lot_read(l.id)
 AND (p_phase=0 OR l.phase=p_phase) AND (p_status='' OR l.registry_status=p_status)
 AND (p_review='' OR (public.bfe_registry_staff() AND l.review_priority=p_review))
 AND position(lower(p_search) in lower(l.physical_id||' '||l.admin_unit||CASE WHEN public.bfe_registry_staff() THEN ' '||coalesce(l.corrected_homeowner,l.recorded_homeowner) ELSE '' END))>0;
 SELECT coalesce(jsonb_agg(x.row ORDER BY x.physical_id),'[]') INTO v FROM (
 SELECT l.physical_id,jsonb_build_object('id',l.id,'physical_id',l.physical_id,'phase',l.phase,'block',l.block,'lot',l.lot,
 'admin_unit',l.admin_unit,'registry_status',l.registry_status,
 'recorded_homeowner',CASE WHEN public.bfe_registry_staff() THEN coalesce(l.corrected_homeowner,l.recorded_homeowner) END,
 'review_priority',CASE WHEN public.bfe_registry_staff() THEN l.review_priority END,'version',l.version) row
 FROM public.bfe_lots l WHERE public.bfe_lot_read(l.id)
 AND (p_phase=0 OR l.phase=p_phase) AND (p_status='' OR l.registry_status=p_status)
 AND (p_review='' OR (public.bfe_registry_staff() AND l.review_priority=p_review))
 AND position(lower(p_search) in lower(l.physical_id||' '||l.admin_unit||CASE WHEN public.bfe_registry_staff() THEN ' '||coalesce(l.corrected_homeowner,l.recorded_homeowner) ELSE '' END))>0
 ORDER BY l.physical_id OFFSET p_page*20 LIMIT 20) x;
 RETURN jsonb_build_object('rows',v,'total',n);
END;$$;

CREATE FUNCTION public.bfe_lot_detail(p_lot uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb; staff boolean:=public.bfe_registry_staff(); manager boolean:=public.bfe_can('property','manage','association');
BEGIN
 IF NOT public.bfe_lot_read(p_lot) THEN RAISE EXCEPTION 'Lot unavailable.' USING ERRCODE='42501';END IF;
 SELECT jsonb_build_object('id',l.id,'physical_id',l.physical_id,'phase',l.phase,'block',l.block,'lot',l.lot,'admin_unit',l.admin_unit,
 'registry_status',l.registry_status,'version',l.version,
 'recorded_homeowner',CASE WHEN staff THEN coalesce(l.corrected_homeowner,l.recorded_homeowner) END,
 'original_homeowner',CASE WHEN staff THEN l.recorded_homeowner END,
 'evidence',CASE WHEN staff THEN (SELECT e.fields FROM public.bfe_lot_evidence e WHERE e.lot_id=l.id) END,
 'memberships',coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.id,'user_id',m.user_id,'name',a.name,'relationship',m.relationship,'state',m.state,'starts_at',m.starts_at,'expires_at',m.expires_at,'reference',m.reference) ORDER BY m.updated_at DESC)
 FROM public.bfe_lot_memberships m LEFT JOIN public.members a ON a.user_id=m.user_id
 WHERE m.lot_id=l.id AND (staff OR manager OR m.user_id=auth.uid())),'[]'::jsonb),
 'history',CASE WHEN staff AND public.bfe_can('audit','view','association') THEN coalesce((SELECT jsonb_agg(to_jsonb(h)) FROM (SELECT h.at,h.action,h.details,coalesce((SELECT name FROM public.members WHERE user_id=h.actor_id LIMIT 1),CASE WHEN h.actor_id IS NULL THEN 'Database owner' ELSE 'Authorized account' END) AS actor_label FROM public.bfe_registry_audit h WHERE h.lot_id=l.id ORDER BY h.id DESC LIMIT 50) h),'[]'::jsonb) ELSE '[]'::jsonb END,
 'source',jsonb_build_object('batch_id',b.id,'imported_at',b.imported_at,'source_name',CASE WHEN staff THEN b.source_name END)) INTO v
 FROM public.bfe_lots l JOIN public.bfe_import_batches b ON b.id=l.batch_id WHERE l.id=p_lot;
 RETURN v;
END;$$;

CREATE FUNCTION public.bfe_claim_lot(p_physical_id text,p_relationship text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 THEN RAISE EXCEPTION 'Active membership required.' USING ERRCODE='42501';END IF;
 IF p_physical_id IS NULL OR p_physical_id !~ '^[1-9][0-9]*-[0-9]{2}-[0-9]{3}$' OR p_relationship IS NULL OR p_relationship NOT IN ('owner','renter','household') THEN RAISE EXCEPTION 'Check the lot reference and relationship.' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('claim:'||auth.uid()::text,0));
 IF (SELECT count(*) FROM public.bfe_lot_memberships WHERE user_id=auth.uid() AND state='pending')>=5 THEN RAISE EXCEPTION 'Ask the office to review your pending claims.' USING ERRCODE='22023';END IF;
 SELECT l.id INTO target FROM public.bfe_lots l JOIN public.bfe_import_batches b ON b.id=l.batch_id WHERE physical_id=p_physical_id AND b.status='active';
 -- Same response for unknown references. No public owner-name lookup.
 IF target IS NOT NULL THEN
 INSERT INTO public.bfe_lot_memberships(lot_id,user_id,relationship) VALUES(target,auth.uid(),p_relationship) ON CONFLICT DO NOTHING;
 END IF;
END;$$;

CREATE FUNCTION public.bfe_review_lot_membership(p_membership uuid,p_state text,p_reference text,p_expires timestamptz DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.bfe_lot_memberships;
BEGIN
 IF NOT public.bfe_can('property','manage','association') THEN RAISE EXCEPTION 'Property management required.' USING ERRCODE='42501';END IF;
 IF p_state IS NULL OR p_state NOT IN ('approved','rejected','revoked') OR p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 OR (p_expires IS NOT NULL AND p_expires<=now()) THEN RAISE EXCEPTION 'Check decision, expiry and reference.' USING ERRCODE='22023';END IF;
 SELECT * INTO m FROM public.bfe_lot_memberships WHERE id=p_membership FOR UPDATE;
 IF NOT FOUND OR m.user_id=auth.uid() THEN RAISE EXCEPTION 'An independent approver is required.' USING ERRCODE='42501';END IF;
 IF (p_state IN ('approved','rejected') AND m.state<>'pending') OR (p_state='revoked' AND m.state<>'approved') THEN RAISE EXCEPTION 'Claim changed. Refresh before reviewing.' USING ERRCODE='40001';END IF;
 IF p_state='approved' AND cardinality(public.bfe_roles_for(m.user_id))=0 THEN RAISE EXCEPTION 'Target must have active membership.' USING ERRCODE='22023';END IF;
 UPDATE public.bfe_lot_memberships SET state=p_state,reference=btrim(p_reference),expires_at=CASE WHEN p_state='approved' THEN p_expires ELSE expires_at END,starts_at=CASE WHEN p_state='approved' THEN now() ELSE starts_at END,approved_by=auth.uid(),updated_at=now() WHERE id=m.id;
 INSERT INTO public.bfe_registry_audit(lot_id,actor_id,action,details) VALUES(m.lot_id,auth.uid(),'Membership '||p_state,jsonb_build_object('membership',m.id,'previous_state',m.state,'previous_start',m.starts_at,'previous_expiry',m.expires_at,'reference',btrim(p_reference)));
END;$$;

CREATE FUNCTION public.bfe_correct_homeowner(p_lot uuid,p_expected integer,p_name text,p_reference text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l public.bfe_lots;
BEGIN
 IF NOT public.bfe_can('property','manage','association') THEN RAISE EXCEPTION 'Property management required.' USING ERRCODE='42501';END IF;
 IF p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 1 AND 500 OR p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Name and verification reference required.' USING ERRCODE='22023';END IF;
 SELECT * INTO l FROM public.bfe_lots WHERE id=p_lot FOR UPDATE;
 IF NOT FOUND OR p_expected IS NULL OR l.version<>p_expected THEN RAISE EXCEPTION 'Lot changed. Refresh before saving.' USING ERRCODE='40001';END IF;
 UPDATE public.bfe_lots SET corrected_homeowner=btrim(p_name),version=version+1 WHERE id=l.id;
 INSERT INTO public.bfe_registry_audit(lot_id,actor_id,action,details) VALUES(l.id,auth.uid(),'Recorded homeowner corrected',jsonb_build_object('before',coalesce(l.corrected_homeowner,l.recorded_homeowner),'after',btrim(p_name),'reference',btrim(p_reference)));
END;$$;

CREATE FUNCTION public.bfe_entitle_receipt(p_membership uuid,p_receipt uuid,p_reference text,p_revoke boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.bfe_lot_memberships; target uuid;
BEGIN
 IF NOT public.bfe_can('finance','approve','association') THEN RAISE EXCEPTION 'Finance approval required.' USING ERRCODE='42501';END IF;
 IF p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 OR p_revoke IS NULL THEN RAISE EXCEPTION 'Verification reference required.' USING ERRCODE='22023';END IF;
 SELECT * INTO m FROM public.bfe_lot_memberships WHERE id=p_membership FOR UPDATE;
 SELECT lot_id INTO target FROM public.bfe_receipts WHERE id=p_receipt;
 IF m.id IS NULL OR target IS NULL OR m.lot_id<>target OR m.relationship<>'owner' OR m.user_id=auth.uid() THEN RAISE EXCEPTION 'Independent approval for the same lot is required.' USING ERRCODE='42501';END IF;
 IF NOT p_revoke AND (m.state<>'approved' OR m.starts_at>now() OR m.expires_at<=now() OR cardinality(public.bfe_roles_for(m.user_id))=0) THEN RAISE EXCEPTION 'Active owner link required.' USING ERRCODE='22023';END IF;
 INSERT INTO public.bfe_receipt_entitlements(membership_id,receipt_id,reference,approved_by,revoked_at) VALUES(m.id,p_receipt,btrim(p_reference),auth.uid(),CASE WHEN p_revoke THEN now() END)
 ON CONFLICT(membership_id,receipt_id) DO UPDATE SET reference=excluded.reference,approved_by=excluded.approved_by,approved_at=now(),revoked_at=excluded.revoked_at;
 INSERT INTO public.bfe_registry_audit(lot_id,actor_id,action,details) VALUES(target,auth.uid(),CASE WHEN p_revoke THEN 'Receipt entitlement revoked' ELSE 'Receipt entitlement approved' END,jsonb_build_object('membership',m.id,'receipt',p_receipt,'reference',btrim(p_reference)));
END;$$;

CREATE FUNCTION public.bfe_lot_receipts(p_lot uuid DEFAULT NULL,p_from date DEFAULT NULL,p_to date DEFAULT NULL,p_page integer DEFAULT 0,p_export boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;n bigint;total bigint;monthly jsonb;phases jsonb; lots jsonb;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 THEN RAISE EXCEPTION 'Active membership required.' USING ERRCODE='42501';END IF;
 IF p_page IS NULL OR p_page<0 OR p_page>10000 OR p_export IS NULL OR (p_from IS NOT NULL AND p_to IS NOT NULL AND p_from>p_to) THEN RAISE EXCEPTION 'Invalid receipt filters.' USING ERRCODE='22023';END IF;
 IF p_export AND NOT public.bfe_can('finance','export','association') THEN RAISE EXCEPTION 'Finance export required.' USING ERRCODE='42501';END IF;
 IF p_lot IS NOT NULL AND NOT public.bfe_lot_read(p_lot) THEN RAISE EXCEPTION 'Lot unavailable.' USING ERRCODE='42501';END IF;
 SELECT count(*),coalesce(sum(amount_centavos),0) INTO n,total FROM public.bfe_receipts r WHERE public.bfe_receipt_read(r.id) AND (p_lot IS NULL OR lot_id=p_lot) AND (p_from IS NULL OR receipt_date>=p_from) AND (p_to IS NULL OR receipt_date<=p_to);
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY receipt_date DESC,or_number),'[]') INTO v FROM (
 SELECT r.id,r.lot_id,l.physical_id,r.or_number,r.receipt_date,r.amount_centavos,r.account_series,r.payer,r.source_file,r.batch_id
 FROM public.bfe_receipts r JOIN public.bfe_lots l ON l.id=r.lot_id WHERE public.bfe_receipt_read(r.id) AND (p_lot IS NULL OR lot_id=p_lot) AND (p_from IS NULL OR receipt_date>=p_from) AND (p_to IS NULL OR receipt_date<=p_to)
 ORDER BY receipt_date DESC,or_number OFFSET p_page*(CASE WHEN p_export THEN 500 ELSE 20 END) LIMIT (CASE WHEN p_export THEN 500 ELSE 20 END)) x;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."month"),'[]') INTO monthly FROM (SELECT to_char(receipt_date,'YYYY-MM') AS "month",count(*) count,sum(amount_centavos) amount_centavos FROM public.bfe_receipts r WHERE public.bfe_receipt_read(r.id) AND (p_lot IS NULL OR lot_id=p_lot) AND (p_from IS NULL OR receipt_date>=p_from) AND (p_to IS NULL OR receipt_date<=p_to) GROUP BY 1) x;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY phase),'[]') INTO phases FROM (SELECT l.phase,count(*) count,sum(r.amount_centavos) amount_centavos FROM public.bfe_receipts r JOIN public.bfe_lots l ON l.id=r.lot_id WHERE public.bfe_receipt_read(r.id) AND (p_lot IS NULL OR lot_id=p_lot) AND (p_from IS NULL OR receipt_date>=p_from) AND (p_to IS NULL OR receipt_date<=p_to) GROUP BY 1) x;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY physical_id),'[]') INTO lots FROM (SELECT l.physical_id,count(*) count,sum(r.amount_centavos) amount_centavos FROM public.bfe_receipts r JOIN public.bfe_lots l ON l.id=r.lot_id WHERE public.bfe_receipt_read(r.id) AND (p_lot IS NULL OR lot_id=p_lot) AND (p_from IS NULL OR receipt_date>=p_from) AND (p_to IS NULL OR receipt_date<=p_to) GROUP BY 1) x;
 RETURN jsonb_build_object('rows',v,'total',n,'total_centavos',total,'monthly',monthly,'phases',phases,'lots',lots);
END;$$;

-- Owner-only atomic staging/finalization. Never granted to authenticated or anon.
CREATE TABLE public.bfe_import_stage (
 batch_id uuid NOT NULL REFERENCES public.bfe_import_batches(id), sheet text NOT NULL CHECK(sheet IN ('lot','receipt')),
 source_row integer NOT NULL, payload jsonb NOT NULL, PRIMARY KEY(batch_id,sheet,source_row)
);
ALTER TABLE public.bfe_import_stage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_import_stage FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bfe_import_registry(p_checksum text,p_source text,p_lots jsonb,p_receipts jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE bid uuid; x jsonb; lid uuid; existing public.bfe_lots; r public.bfe_receipts; total bigint; cnt integer;
BEGIN
 IF auth.uid() IS NOT NULL OR coalesce(current_setting('role',true),'none') IN ('anon','authenticated') THEN RAISE EXCEPTION 'Trusted database owner import only.' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p_lots) IS DISTINCT FROM 'array' OR jsonb_typeof(p_receipts) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lots)=0 OR jsonb_array_length(p_lots)>10000 OR jsonb_array_length(p_receipts)>100000 THEN RAISE EXCEPTION 'Invalid import envelope.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('bfe-registry-import',0));
 SELECT id INTO bid FROM public.bfe_import_batches WHERE checksum=p_checksum;
 IF FOUND THEN RETURN bid;END IF;
 SELECT sum((value->>'amount_centavos')::bigint) INTO total FROM jsonb_array_elements(p_receipts);
 INSERT INTO public.bfe_import_batches(checksum,source_name,lot_count,receipt_count,total_centavos) VALUES(p_checksum,p_source,jsonb_array_length(p_lots),jsonb_array_length(p_receipts),coalesce(total,0)) RETURNING id INTO bid;
 FOR x IN SELECT value FROM jsonb_array_elements(p_lots) LOOP
 IF x->>'physical_id' IS NULL OR x->>'admin_unit' IS NULL OR x->>'registry_status' IS NULL OR jsonb_typeof(x->'fields') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid lot staging row.';END IF;
 INSERT INTO public.bfe_import_stage VALUES(bid,'lot',(x->>'source_row')::integer,x);
 SELECT * INTO existing FROM public.bfe_lots WHERE physical_id=x->>'physical_id';
 IF FOUND THEN
 IF existing.phase IS DISTINCT FROM (x->>'phase')::integer OR existing.block IS DISTINCT FROM (x->>'block')::integer OR existing.lot IS DISTINCT FROM (x->>'lot')::integer OR existing.admin_unit IS DISTINCT FROM x->>'admin_unit' OR existing.registry_status IS DISTINCT FROM x->>'registry_status' OR existing.recorded_homeowner IS DISTINCT FROM coalesce(x->>'recorded_homeowner','') OR existing.review_priority IS DISTINCT FROM x->>'review_priority' OR (SELECT fields FROM public.bfe_lot_evidence WHERE lot_id=existing.id) IS DISTINCT FROM x->'fields' THEN RAISE EXCEPTION 'Existing lot evidence conflicts; review import privately.';END IF;
 ELSE
 INSERT INTO public.bfe_lots(physical_id,phase,block,lot,admin_unit,registry_status,review_priority,recorded_homeowner,batch_id) VALUES(x->>'physical_id',(x->>'phase')::integer,(x->>'block')::integer,(x->>'lot')::integer,x->>'admin_unit',x->>'registry_status',x->>'review_priority',coalesce(x->>'recorded_homeowner',''),bid) RETURNING id INTO lid;
 INSERT INTO public.bfe_lot_evidence VALUES(lid,(x->>'source_row')::integer,x->'fields');
 END IF;
 END LOOP;
 IF (SELECT count(DISTINCT payload->>'physical_id') FROM public.bfe_import_stage WHERE batch_id=bid AND sheet='lot')<>jsonb_array_length(p_lots) THEN RAISE EXCEPTION 'Duplicate lot in import.';END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_receipts) LOOP
 INSERT INTO public.bfe_import_stage VALUES(bid,'receipt',(x->>'source_row')::integer,x);
 SELECT id INTO lid FROM public.bfe_lots WHERE physical_id=x->>'physical_id';
 IF lid IS NULL OR NOT EXISTS(SELECT 1 FROM public.bfe_import_stage WHERE batch_id=bid AND sheet='lot' AND payload->>'physical_id'=x->>'physical_id') THEN RAISE EXCEPTION 'Receipt lot missing from import.';END IF;
 SELECT * INTO r FROM public.bfe_receipts WHERE or_number=x->>'or_number';
 IF FOUND THEN
 IF r.lot_id IS DISTINCT FROM lid OR r.receipt_date IS DISTINCT FROM (x->>'receipt_date')::date OR r.amount_centavos IS DISTINCT FROM (x->>'amount_centavos')::bigint OR r.account_series IS DISTINCT FROM x->>'account_series' OR r.payer IS DISTINCT FROM x->>'payer' OR r.source_file IS DISTINCT FROM x->>'source_file' THEN RAISE EXCEPTION 'Existing receipt conflicts; no overwrite performed.';END IF;
 ELSE
 INSERT INTO public.bfe_receipts(lot_id,or_number,receipt_date,amount_centavos,account_series,payer,source_file,source_row,batch_id) VALUES(lid,x->>'or_number',(x->>'receipt_date')::date,(x->>'amount_centavos')::bigint,x->>'account_series',x->>'payer',x->>'source_file',(x->>'source_row')::integer,bid);
 END IF;
 END LOOP;
 SELECT count(DISTINCT payload->>'or_number') INTO cnt FROM public.bfe_import_stage WHERE batch_id=bid AND sheet='receipt';
 IF cnt<>jsonb_array_length(p_receipts) THEN RAISE EXCEPTION 'Duplicate receipt in import.';END IF;
 INSERT INTO public.bfe_registry_audit(batch_id,action,details) VALUES(bid,'Workbook imported',jsonb_build_object('lots',jsonb_array_length(p_lots),'receipts',cnt,'total_centavos',coalesce(total,0)));
 RETURN bid;
END;$$;

CREATE FUNCTION public.bfe_withdraw_registry_import(p_batch uuid,p_reference text,p_restore boolean DEFAULT false) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL OR coalesce(current_setting('role',true),'none') IN ('anon','authenticated') THEN RAISE EXCEPTION 'Trusted database owner recovery only.' USING ERRCODE='42501';END IF;
 IF p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 OR p_restore IS NULL THEN RAISE EXCEPTION 'Recovery reference required.';END IF;
 UPDATE public.bfe_import_batches SET status=CASE WHEN p_restore THEN 'active' ELSE 'withdrawn' END WHERE id=p_batch;
 IF NOT FOUND THEN RAISE EXCEPTION 'Import batch unavailable.';END IF;
 INSERT INTO public.bfe_registry_audit(batch_id,action,details) VALUES(p_batch,CASE WHEN p_restore THEN 'Import restored' ELSE 'Import withdrawn' END,jsonb_build_object('reference',btrim(p_reference)));
END;$$;
REVOKE ALL ON FUNCTION public.bfe_withdraw_registry_import(uuid,text,boolean) FROM PUBLIC,anon,authenticated;

-- Default function EXECUTE includes PUBLIC: explicitly close every new operation.
REVOKE ALL ON FUNCTION public.bfe_registry_staff(),public.bfe_lot_link(uuid),public.bfe_lot_read(uuid),public.bfe_receipt_read(uuid),public.bfe_list_lots(text,integer,text,text,integer),public.bfe_lot_detail(uuid),public.bfe_claim_lot(text,text),public.bfe_review_lot_membership(uuid,text,text,timestamptz),public.bfe_correct_homeowner(uuid,integer,text,text),public.bfe_entitle_receipt(uuid,uuid,text,boolean),public.bfe_lot_receipts(uuid,date,date,integer,boolean),public.bfe_import_registry(text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_lot_read(uuid),public.bfe_receipt_read(uuid),public.bfe_list_lots(text,integer,text,text,integer),public.bfe_lot_detail(uuid),public.bfe_claim_lot(text,text),public.bfe_review_lot_membership(uuid,text,text,timestamptz),public.bfe_correct_homeowner(uuid,integer,text,text),public.bfe_entitle_receipt(uuid,uuid,text,boolean),public.bfe_lot_receipts(uuid,date,date,integer,boolean) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
