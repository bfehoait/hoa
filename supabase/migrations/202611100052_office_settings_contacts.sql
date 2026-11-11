-- Apply after 051. Authoritative Office association details and contact records.
-- No official names, hours, addresses or phone numbers are invented or seeded.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_association_details (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),name text NOT NULL,address text NOT NULL,
 office_hours text NOT NULL,quiet_hours text NOT NULL,version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.bfe_office_contacts (
 id uuid PRIMARY KEY,group_name text NOT NULL CHECK(group_name IN ('Emergency','HOA & security','Utilities')),
 name text NOT NULL,phone text NOT NULL,label text NOT NULL DEFAULT '',active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.bfe_office_configuration_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,kind text NOT NULL,record_id text NOT NULL,
 actor_id uuid NOT NULL,reference text NOT NULL,before_values jsonb,after_values jsonb NOT NULL,at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bfe_association_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_office_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_office_configuration_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_association_details,public.bfe_office_contacts,public.bfe_office_configuration_audit FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bfe_office_configuration(p_kind text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE cap text; rows jsonb;
BEGIN
 cap:=CASE p_kind WHEN 'association' THEN 'operations' WHEN 'contacts' THEN 'hotlines' END;
 IF cap IS NULL OR auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT public.bfe_can(cap,'view','association') THEN RAISE EXCEPTION 'Office configuration access required.' USING ERRCODE='42501'; END IF;
 IF p_kind='association' THEN SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]') INTO rows FROM public.bfe_association_details r;
 ELSE SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.group_name,r.name,r.label,r.id),'[]') INTO rows FROM public.bfe_office_contacts r; END IF;
 RETURN jsonb_build_object('rows',rows,'can_manage','admin'=ANY(public.bfe_current_roles()) AND public.bfe_can(cap,'manage','association'));
END;$$;
CREATE FUNCTION public.bfe_save_association_details(p_version integer,p_name text,p_address text,p_hours text,p_quiet text,p_reference text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_association_details; result public.bfe_association_details;
BEGIN
 IF auth.uid() IS NULL OR NOT ('admin'=ANY(public.bfe_current_roles())) OR NOT public.bfe_can('operations','view','association') OR NOT public.bfe_can('operations','manage','association') THEN RAISE EXCEPTION 'Office settings management required.' USING ERRCODE='42501'; END IF;
 IF p_version IS NULL OR p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 3 AND 120 OR p_address IS NULL OR char_length(btrim(p_address))>500 OR p_hours IS NULL OR char_length(btrim(p_hours))>500 OR p_quiet IS NULL OR char_length(btrim(p_quiet))>500 OR p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Check association details and approval reference.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('association-details',0));
 SELECT * INTO r FROM public.bfe_association_details WHERE singleton FOR UPDATE;
 IF r.name=btrim(p_name) AND r.address=btrim(p_address) AND r.office_hours=btrim(p_hours) AND r.quiet_hours=btrim(p_quiet) THEN RETURN; END IF;
 IF coalesce(r.version,0)<>p_version THEN RAISE EXCEPTION 'Settings changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
 INSERT INTO public.bfe_association_details(singleton,name,address,office_hours,quiet_hours) VALUES(true,btrim(p_name),btrim(p_address),btrim(p_hours),btrim(p_quiet))
 ON CONFLICT(singleton) DO UPDATE SET name=EXCLUDED.name,address=EXCLUDED.address,office_hours=EXCLUDED.office_hours,quiet_hours=EXCLUDED.quiet_hours,version=bfe_association_details.version+1,updated_at=now() RETURNING * INTO result;
 INSERT INTO public.bfe_office_configuration_audit(kind,record_id,actor_id,reference,before_values,after_values)
 VALUES('association','association',auth.uid(),btrim(p_reference),CASE WHEN r.singleton IS NULL THEN NULL ELSE to_jsonb(r) END,to_jsonb(result));
END;$$;
CREATE FUNCTION public.bfe_save_office_contact(p_id uuid,p_version integer,p_group text,p_name text,p_phone text,p_label text,p_active boolean,p_reference text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_office_contacts; result public.bfe_office_contacts;
BEGIN
 IF auth.uid() IS NULL OR NOT ('admin'=ANY(public.bfe_current_roles())) OR NOT public.bfe_can('hotlines','view','association') OR NOT public.bfe_can('hotlines','manage','association') THEN RAISE EXCEPTION 'Office contact management required.' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_version IS NULL OR p_group IS NULL OR p_group NOT IN ('Emergency','HOA & security','Utilities') OR p_name IS NULL OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 120 OR p_phone IS NULL OR char_length(btrim(p_phone)) NOT BETWEEN 3 AND 40 OR p_phone !~ '^\+?[0-9() .-]+$' OR length(regexp_replace(p_phone,'[^0-9]','','g')) NOT BETWEEN 3 AND 15 OR p_label IS NULL OR char_length(btrim(p_label))>120 OR p_active IS NULL OR p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Check the contact number, name and approval reference.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('office-contact:'||p_id::text,0));
 SELECT * INTO r FROM public.bfe_office_contacts WHERE id=p_id FOR UPDATE;
 IF r.group_name=p_group AND r.name=btrim(p_name) AND r.phone=btrim(p_phone) AND r.label=btrim(p_label) AND r.active=p_active THEN RETURN; END IF;
 IF coalesce(r.version,0)<>p_version THEN RAISE EXCEPTION 'Contact changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
 INSERT INTO public.bfe_office_contacts(id,group_name,name,phone,label,active) VALUES(p_id,p_group,btrim(p_name),btrim(p_phone),btrim(p_label),p_active)
 ON CONFLICT(id) DO UPDATE SET group_name=EXCLUDED.group_name,name=EXCLUDED.name,phone=EXCLUDED.phone,label=EXCLUDED.label,active=EXCLUDED.active,version=bfe_office_contacts.version+1,updated_at=now() RETURNING * INTO result;
 INSERT INTO public.bfe_office_configuration_audit(kind,record_id,actor_id,reference,before_values,after_values)
 VALUES('contact',p_id::text,auth.uid(),btrim(p_reference),CASE WHEN r.id IS NULL THEN NULL ELSE to_jsonb(r) END,to_jsonb(result));
END;$$;
CREATE FUNCTION public.bfe_published_office_contacts() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT (public.bfe_can('hotlines','view','approved') OR public.bfe_can('hotlines','view','association')) THEN RAISE EXCEPTION 'Community contacts access required.' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'group',group_name,'name',name,'phone',CASE WHEN active THEN phone ELSE '' END,'label',label,'active',active) ORDER BY group_name,name,label,id),'[]') FROM public.bfe_office_contacts);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_office_configuration(text),public.bfe_save_association_details(integer,text,text,text,text,text),public.bfe_save_office_contact(uuid,integer,text,text,text,text,boolean,text),public.bfe_published_office_contacts() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_office_configuration(text),public.bfe_save_association_details(integer,text,text,text,text,text),public.bfe_save_office_contact(uuid,integer,text,text,text,text,boolean,text),public.bfe_published_office_contacts() TO authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
