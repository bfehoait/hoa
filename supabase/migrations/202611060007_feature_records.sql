-- Apply once after 006. New records only; no source or legacy data is imported.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_feature_definitions (
 code text PRIMARY KEY, capability text NOT NULL, resident_create boolean NOT NULL,
 publishable boolean NOT NULL, fields jsonb NOT NULL
);
CREATE TABLE public.bfe_feature_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), module text NOT NULL REFERENCES public.bfe_feature_definitions(code),
 owner_id uuid NOT NULL REFERENCES auth.users(id), client_id uuid NOT NULL,
 title text NOT NULL CHECK(char_length(btrim(title)) BETWEEN 3 AND 120),
 detail text NOT NULL CHECK(char_length(btrim(detail)) BETWEEN 10 AND 5000),
 fields jsonb NOT NULL CHECK(jsonb_typeof(fields)='object'),
 publication_consent boolean NOT NULL DEFAULT false,
 status text NOT NULL DEFAULT 'Submitted' CHECK(status IN ('Submitted','In review','Reviewed','Rejected','Withdrawn','Published')),
 public_title text, public_body text, audience text CHECK(audience IN ('members','homeowner','renter','board','security','driver')),
 expires_at timestamptz, version integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,client_id)
);
CREATE INDEX bfe_feature_records_queue ON public.bfe_feature_records(module,status,created_at DESC,id);
CREATE TABLE public.bfe_feature_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, record_id uuid NOT NULL REFERENCES public.bfe_feature_records(id),
 actor_id uuid NOT NULL, action text NOT NULL, note text NOT NULL, at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bfe_feature_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_feature_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_feature_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_feature_definitions,public.bfe_feature_records,public.bfe_feature_audit FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.bfe_feature_audit_id_seq FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_validate_feature_fields(p_module text,p_fields jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE defs jsonb; f jsonb; v text; k text;
BEGIN
 SELECT fields INTO defs FROM public.bfe_feature_definitions WHERE code=p_module;
 IF defs IS NULL OR p_fields IS NULL OR jsonb_typeof(p_fields)<>'object' OR octet_length(p_fields::text)>20000 THEN RAISE EXCEPTION 'Invalid feature fields.' USING ERRCODE='22023'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_fields) LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(defs) x WHERE x->>'key'=k) THEN RAISE EXCEPTION 'Unexpected feature field.' USING ERRCODE='22023'; END IF;
 END LOOP;
 FOR f IN SELECT value FROM jsonb_array_elements(defs) LOOP
  v:=btrim(coalesce(p_fields->>(f->>'key'),''));
  IF (p_fields ? (f->>'key') AND jsonb_typeof(p_fields->(f->>'key'))<>'string') OR char_length(v)>2000
   OR (coalesce((f->>'required')::boolean,false) AND (v='' OR v !~ '[^[:space:]]')) THEN RAISE EXCEPTION 'Check field: %',f->>'key' USING ERRCODE='22023'; END IF;
  IF v='' THEN CONTINUE; END IF;
  IF f ? 'options' AND NOT (f->'options' ? v) THEN RAISE EXCEPTION 'Invalid selection: %',f->>'key' USING ERRCODE='22023'; END IF;
  IF f->>'type'='number' THEN
   IF v !~ '^[0-9]+([.][0-9]{1,2})?$' OR length(v)>15 THEN RAISE EXCEPTION 'Invalid number.' USING ERRCODE='22023'; END IF;
   IF v::numeric<coalesce((f->>'min')::numeric,0) OR v::numeric>coalesce((f->>'max')::numeric,1000000) THEN RAISE EXCEPTION 'Number outside allowed range.' USING ERRCODE='22023'; END IF;
   IF f->>'key' IN ('capacity','seats','places','passengers') AND v::numeric<>trunc(v::numeric) THEN RAISE EXCEPTION 'Capacity and passenger counts must be whole numbers.' USING ERRCODE='22023'; END IF;
  ELSIF f->>'type'='date' THEN
   IF v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Invalid date.' USING ERRCODE='22023'; END IF;
   PERFORM v::date;
  ELSIF f->>'type'='time' AND v !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'Invalid time.' USING ERRCODE='22023';
  ELSIF f->>'type'='email' AND v !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN RAISE EXCEPTION 'Invalid email.' USING ERRCODE='22023';
  ELSIF f->>'type'='url' AND v !~ '^https://[^[:space:]@/]+[.][^[:space:]@/]+' THEN RAISE EXCEPTION 'Use a full HTTPS link without embedded credentials.' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF coalesce(p_fields->>'start','')<>'' AND coalesce(p_fields->>'end','')<>'' AND p_fields->>'end'<=p_fields->>'start' THEN RAISE EXCEPTION 'End time must be after start time.' USING ERRCODE='22023'; END IF;
 IF coalesce(p_fields->>'setup','')<>'' AND coalesce(p_fields->>'start','')<>'' AND p_fields->>'setup'>p_fields->>'start' THEN RAISE EXCEPTION 'Setup must be before the start.' USING ERRCODE='22023'; END IF;
 IF p_module='garage-sales' AND (SELECT count(*) FROM regexp_split_to_table(p_fields->>'items',E'\n') x WHERE btrim(x)<>'')>20 THEN RAISE EXCEPTION 'List at most 20 garage sale items.' USING ERRCODE='22023'; END IF;
END;$$;

CREATE FUNCTION public.bfe_submit_feature(p_client uuid,p_module text,p_title text,p_detail text,p_fields jsonb,p_consent boolean DEFAULT false) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.bfe_feature_definitions; r public.bfe_feature_records; uid uuid:=auth.uid();
BEGIN
 SELECT * INTO d FROM public.bfe_feature_definitions WHERE code=p_module;
 IF uid IS NULL OR cardinality(public.bfe_current_roles())=0 OR d.code IS NULL OR NOT (
  (d.resident_create AND public.bfe_current_roles() && ARRAY['homeowner','renter']::text[] AND public.bfe_can(d.capability,'create','own'))
  OR public.bfe_can(d.capability,'create','association')) THEN RAISE EXCEPTION 'Feature submission permission required.' USING ERRCODE='42501'; END IF;
 IF p_client IS NULL OR p_title IS NULL OR p_detail IS NULL OR p_consent IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 3 AND 120 OR char_length(btrim(p_detail)) NOT BETWEEN 10 AND 5000 OR p_title !~ '[^[:space:]]' OR p_detail !~ '[^[:space:]]' THEN RAISE EXCEPTION 'Check title and details.' USING ERRCODE='22023'; END IF;
 PERFORM public.bfe_validate_feature_fields(p_module,p_fields);
 PERFORM pg_advisory_xact_lock(hashtextextended('feature:'||uid::text,0));
 SELECT * INTO r FROM public.bfe_feature_records WHERE owner_id=uid AND client_id=p_client;
 IF FOUND THEN
  IF r.module<>p_module OR r.title<>btrim(p_title) OR r.detail<>btrim(p_detail) OR r.fields<>p_fields OR r.publication_consent<>p_consent THEN RAISE EXCEPTION 'Submission reference already used for different details.' USING ERRCODE='22023'; END IF;
  RETURN r.id;
 END IF;
 IF (SELECT count(*) FROM public.bfe_feature_records WHERE owner_id=uid AND created_at>now()-interval '1 minute')>=5 THEN RAISE EXCEPTION 'Please wait before submitting again.'; END IF;
 INSERT INTO public.bfe_feature_records(module,owner_id,client_id,title,detail,fields,publication_consent) VALUES(p_module,uid,p_client,btrim(p_title),btrim(p_detail),p_fields,p_consent) RETURNING * INTO r;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note) VALUES(r.id,uid,'Submitted','Submitted for review; no operational authority granted');
 RETURN r.id;
END;$$;

CREATE FUNCTION public.bfe_review_feature(p_id uuid,p_version integer,p_status text,p_note text,p_public_title text DEFAULT NULL,p_public_body text DEFAULT NULL,p_audience text DEFAULT NULL,p_expires timestamptz DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records; d public.bfe_feature_definitions;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 THEN RAISE EXCEPTION 'Active membership required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_id FOR UPDATE;
 SELECT * INTO d FROM public.bfe_feature_definitions WHERE code=r.module;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Record unavailable.' USING ERRCODE='42501'; END IF;
 IF p_status='Withdrawn' AND r.owner_id=auth.uid() THEN
  IF r.status IN ('Withdrawn','Rejected') THEN RAISE EXCEPTION 'Record already closed.'; END IF;
 ELSE
  IF NOT public.bfe_can(d.capability,'view','association') OR NOT public.bfe_can(d.capability,CASE WHEN p_status='Published' THEN 'publish' ELSE 'status' END,'association') THEN RAISE EXCEPTION 'Feature review permission required.' USING ERRCODE='42501'; END IF;
  IF NOT ((r.status='Submitted' AND p_status IN ('In review','Rejected')) OR (r.status='In review' AND p_status IN ('Reviewed','Rejected','Published')) OR (r.status='Published' AND p_status='Withdrawn')) THEN RAISE EXCEPTION 'Status transition not permitted.' USING ERRCODE='22023'; END IF;
  IF p_status='Published' AND (NOT d.publishable OR NOT r.publication_consent OR p_public_title IS NULL OR p_public_body IS NULL OR char_length(btrim(p_public_title)) NOT BETWEEN 3 AND 120 OR char_length(btrim(p_public_body)) NOT BETWEEN 10 AND 5000 OR p_audience IS NULL OR p_audience NOT IN ('members','homeowner','renter','board','security','driver') OR p_expires IS NULL OR p_expires<=now() OR p_expires>now()+interval '366 days') THEN RAISE EXCEPTION 'Publication needs consent, reviewed public text, audience and future expiry within one year.' USING ERRCODE='22023'; END IF;
 END IF;
 IF p_version IS NULL OR r.version<>p_version THEN RAISE EXCEPTION 'Record changed. Refresh before retrying.' USING ERRCODE='40001'; END IF;
 IF p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 5 AND 1000 OR p_note !~ '[^[:space:]]' THEN RAISE EXCEPTION 'Provide a review reason.' USING ERRCODE='22023'; END IF;
 UPDATE public.bfe_feature_records SET status=p_status,version=version+1,updated_at=now(),public_title=CASE WHEN p_status='Published' THEN btrim(p_public_title) ELSE public_title END,public_body=CASE WHEN p_status='Published' THEN btrim(p_public_body) ELSE public_body END,audience=CASE WHEN p_status='Published' THEN p_audience ELSE audience END,expires_at=CASE WHEN p_status='Published' THEN p_expires ELSE expires_at END WHERE id=p_id;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note) VALUES(p_id,auth.uid(),p_status,btrim(p_note));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(r.owner_id,'community','Submission: '||p_status,'Open your submission to check its review history.','/more/notifications','feature:'||r.id::text||':'||(r.version+1)::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
END;$$;

CREATE FUNCTION public.bfe_feature_dashboard(p_module text,p_view text DEFAULT 'mine',p_page integer DEFAULT 0,p_search text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE d public.bfe_feature_definitions; rows jsonb; n bigint; manager boolean; creator boolean;
BEGIN
 SELECT * INTO d FROM public.bfe_feature_definitions WHERE code=p_module;
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR d.code IS NULL THEN RAISE EXCEPTION 'Active membership required.' USING ERRCODE='42501'; END IF;
 IF p_view IS NULL OR p_view NOT IN ('mine','review','published') OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 OR p_search IS NULL OR length(p_search)>100 THEN RAISE EXCEPTION 'Invalid feature filters.' USING ERRCODE='22023'; END IF;
 manager:=public.bfe_can(d.capability,'view','association');
 creator:=(d.resident_create AND public.bfe_current_roles() && ARRAY['homeowner','renter']::text[] AND public.bfe_can(d.capability,'create','own')) OR public.bfe_can(d.capability,'create','association');
 IF p_view='review' AND NOT manager THEN RAISE EXCEPTION 'Review access required.' USING ERRCODE='42501'; END IF;
 IF p_view='mine' AND NOT (public.bfe_can(d.capability,'view','own') OR manager) THEN RAISE EXCEPTION 'Own record access required.' USING ERRCODE='42501'; END IF;
 IF p_view='published' AND NOT (public.bfe_can(d.capability,'view','approved') OR public.bfe_can(d.capability,'view','own') OR manager) THEN RAISE EXCEPTION 'Published content access required.' USING ERRCODE='42501'; END IF;
 WITH visible AS (
  SELECT r.* FROM public.bfe_feature_records r WHERE r.module=p_module AND
   CASE p_view WHEN 'mine' THEN r.owner_id=auth.uid() WHEN 'review' THEN true ELSE r.status='Published' AND r.expires_at>now() AND (r.audience='members' OR r.audience=ANY(public.bfe_current_roles())) END
   AND position(lower(p_search) IN lower(CASE WHEN p_view='published' THEN coalesce(r.public_title,'')||' '||coalesce(r.public_body,'') ELSE r.title||' '||r.detail END))>0
 ), page AS (SELECT * FROM visible ORDER BY created_at DESC,id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(CASE WHEN p_view='published' THEN jsonb_build_object('id',id,'module',module,'title',public_title,'detail',public_body,'status',status,'expires_at',expires_at,'created_at',created_at) ELSE to_jsonb(page) END ORDER BY created_at DESC,id),'[]') INTO n,rows FROM page;
 RETURN jsonb_build_object('rows',rows,'total',n,'can_create',creator,'can_review',manager AND public.bfe_can(d.capability,'status','association'),'can_publish',manager AND public.bfe_can(d.capability,'publish','association') AND d.publishable,'publishable',d.publishable);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_validate_feature_fields(text,jsonb),public.bfe_submit_feature(uuid,text,text,text,jsonb,boolean),public.bfe_review_feature(uuid,integer,text,text,text,text,text,timestamptz),public.bfe_feature_dashboard(text,text,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_submit_feature(uuid,text,text,text,jsonb,boolean),public.bfe_review_feature(uuid,integer,text,text,text,text,text,timestamptz),public.bfe_feature_dashboard(text,text,integer,text) TO authenticated;
-- DEFINITIONS
INSERT INTO public.bfe_feature_definitions(code,capability,resident_create,publishable,fields) VALUES
('unit-register','property',false,false,'[{"key":"unit","label":"Sample unit","type":"text","required":true},{"key":"owner","label":"Synthetic owner label","type":"text","required":true},{"key":"area","label":"Sample lot area (square metres)","type":"number","min":1,"max":100000,"required":true},{"key":"occupancy","label":"Proposed occupancy","options":["Owner occupied","Tenanted","Vacant","Unknown"],"required":true}]'::jsonb),
('expense-evidence','finance',false,false,'[{"key":"date","label":"Sample expense date","type":"date","required":true},{"key":"category","label":"Sample expense category","type":"text","required":true},{"key":"amount","label":"Sample amount (PHP)","type":"number","min":0,"max":1000000,"required":true},{"key":"reference","label":"Synthetic evidence reference","type":"text","required":true}]'::jsonb),
('businesses','livelihood',true,true,'[{"key":"category","label":"Business category","options":["Food","Home services","Retail","Other"],"required":true},{"key":"hours","label":"Sample opening hours","type":"text","required":true},{"key":"owner","label":"Sample owner label","type":"text","required":true},{"key":"contact","label":"Sample contact email","type":"email","required":true},{"key":"website","label":"Sample website","type":"url","required":false}]'::jsonb),
('buy-sell','livelihood',true,true,'[{"key":"category","label":"Item category","options":["Home","Garden","Electronics","Other"],"required":true},{"key":"condition","label":"Condition","options":["New","Used","For parts"],"required":true},{"key":"price","label":"Sample asking price (PHP)","type":"number","min":0,"max":1000000,"required":true},{"key":"contact","label":"Sample contact email","type":"email","required":true},{"key":"photoNote","label":"Photo description (no upload)","type":"text","required":false}]'::jsonb),
('jobs','livelihood',true,true,'[{"key":"kind","label":"Listing purpose","options":["Hiring","Seeking work"],"required":true},{"key":"company","label":"Sample company or worker","type":"text","required":true},{"key":"jobType","label":"Job type","options":["Full-time","Part-time","Contract","One-off"],"required":true},{"key":"setup","label":"Work setup","options":["On-site","Remote","Hybrid"],"required":true},{"key":"location","label":"Sample work location","type":"text","required":true},{"key":"pay","label":"Sample pay description","type":"text","required":true},{"key":"deadline","label":"Application deadline","type":"date","required":true},{"key":"applyLink","label":"Sample application link","type":"url","required":false}]'::jsonb),
('garage-sales','livelihood',true,true,'[{"key":"date","label":"Sale date","type":"date","required":true},{"key":"start","label":"Start time","type":"time","required":true},{"key":"end","label":"End time","type":"time","required":true},{"key":"location","label":"Sample sale location","type":"text","required":true},{"key":"items","label":"Sample items, one per line","type":"textarea","required":true},{"key":"visibility","label":"Proposed audience","options":["Households","Community members"],"required":true},{"key":"contact","label":"Sample contact email","type":"email","required":true}]'::jsonb),
('booth-events','livelihood',false,true,'[{"key":"venue","label":"Sample venue","type":"text","required":true},{"key":"date","label":"Event date","type":"date","required":true},{"key":"setup","label":"Setup time","type":"time","required":true},{"key":"start","label":"Start time","type":"time","required":true},{"key":"end","label":"End time","type":"time","required":true},{"key":"capacity","label":"Sample booth capacity","type":"number","min":1,"max":200,"required":true}]'::jsonb),
('booth-applications','livelihood',true,false,'[{"key":"eventId","label":"Local booth event reference","type":"text","required":true},{"key":"business","label":"Sample business name","type":"text","required":true},{"key":"products","label":"Products or services","type":"text","required":true},{"key":"contact","label":"Sample contact email","type":"email","required":true}]'::jsonb),
('workshops','livelihood',true,true,'[{"key":"date","label":"Session date","type":"date","required":true},{"key":"start","label":"Start time","type":"time","required":true},{"key":"end","label":"End time","type":"time","required":true},{"key":"venue","label":"Sample venue","type":"text","required":true},{"key":"facilitator","label":"Sample facilitator","type":"text","required":true},{"key":"capacity","label":"Sample participant capacity","type":"number","min":1,"max":500,"required":true},{"key":"fee","label":"Sample fee (PHP)","type":"number","min":0,"max":1000000,"required":true}]'::jsonb),
('participation','livelihood',true,false,'[{"key":"sessionId","label":"Local training session reference","type":"text","required":true},{"key":"participant","label":"Sample participant label","type":"text","required":true},{"key":"places","label":"Requested places","type":"number","min":1,"max":10,"required":true}]'::jsonb),
('ride-requests','transport',false,false,'[{"key":"pickup","label":"Sample pickup","type":"text","required":true},{"key":"destination","label":"Sample destination","type":"text","required":true},{"key":"date","label":"Trip date","type":"date","required":true},{"key":"time","label":"Pickup time","type":"time","required":true},{"key":"passengers","label":"Passengers","type":"number","min":1,"max":20,"required":true}]'::jsonb),
('carpools','transport',true,true,'[{"key":"pickup","label":"Sample pickup","type":"text","required":true},{"key":"destination","label":"Sample destination","type":"text","required":true},{"key":"date","label":"Departure date","type":"date","required":true},{"key":"time","label":"Departure time","type":"time","required":true},{"key":"seats","label":"Sample seats","type":"number","min":1,"max":10,"required":true},{"key":"contact","label":"Sample contact email","type":"email","required":true}]'::jsonb),
('carpool-interests','transport',true,false,'[{"key":"carpoolId","label":"Local carpool reference","type":"text","required":true},{"key":"participant","label":"Sample passenger label","type":"text","required":true},{"key":"places","label":"Requested seats","type":"number","min":1,"max":10,"required":true}]'::jsonb),
('stations','transport',false,false,'[{"key":"location","label":"Sample station location","type":"text","required":true},{"key":"dispatcher","label":"Sample dispatcher label","type":"text","required":true},{"key":"drivers","label":"Sample driver labels","type":"textarea","required":true},{"key":"hours","label":"Sample operating hours","type":"text","required":true}]'::jsonb),
('complaints','requests',false,false,'[{"key":"category","label":"Complaint category","options":["Noise","Shared spaces","Conduct","Other"],"required":true},{"key":"party","label":"Synthetic party label","type":"text","required":true},{"key":"location","label":"Sample location","type":"text","required":true},{"key":"resolution","label":"Requested resolution","type":"textarea","required":true}]'::jsonb),
('concerns','requests',false,false,'[{"key":"category","label":"Concern category","options":["Maintenance","Safety","Environment","Other"],"required":true},{"key":"location","label":"Sample location","type":"text","required":true},{"key":"priority","label":"Proposed priority","options":["Routine","Time-sensitive"],"required":true}]'::jsonb),
('tickets','requests',false,false,'[{"key":"channel","label":"Requested channel","options":["Portal","Email","Office"],"required":true},{"key":"priority","label":"Proposed priority","options":["Low","Normal","High"],"required":true},{"key":"assignedTo","label":"Sample assignee","options":["Unassigned","Demo staff A","Demo staff B"],"required":true}]'::jsonb),
('messages','requests',false,false,'[{"key":"recipient","label":"Proposed recipient","options":["Office","Finance","Security","Board"],"required":true},{"key":"topic","label":"Conversation topic","options":["General enquiry","Billing enquiry","Request follow-up","Other"],"required":true}]'::jsonb),
('gate-passes','security',false,false,'[{"key":"purpose","label":"Pass purpose","options":["Delivery","Move-in","Move-out","Service work","Other"],"required":true},{"key":"date","label":"Requested date","type":"date","required":true},{"key":"items","label":"Sample items, one per line","type":"textarea","required":true},{"key":"vehicle","label":"Synthetic vehicle label","type":"text","required":true},{"key":"party","label":"Synthetic visitor label","type":"text","required":true}]'::jsonb),
('walk-ins','security',false,false,'[{"key":"visitor","label":"Synthetic visitor label","type":"text","required":true},{"key":"unit","label":"Sample destination unit","type":"text","required":true},{"key":"purpose","label":"Visit purpose","options":["Social visit","Delivery","Service work","Other"],"required":true},{"key":"date","label":"Visit date","type":"date","required":true}]'::jsonb),
('guard-roster','security',false,false,'[{"key":"post","label":"Sample guard post","type":"text","required":true},{"key":"guard","label":"Synthetic guard label","type":"text","required":true},{"key":"date","label":"Shift date","type":"date","required":true},{"key":"start","label":"Shift start","type":"time","required":true},{"key":"end","label":"Shift end","type":"time","required":true}]'::jsonb),
('household-changes','property',true,false,'[{"key":"unit","label":"Sample unit","type":"text","required":true},{"key":"change","label":"Change type","options":["Owner change","Tenant change","Household member","Occupancy update"],"required":true},{"key":"effective","label":"Proposed effective date","type":"date","required":true},{"key":"member","label":"Synthetic member label","type":"text","required":true},{"key":"evidence","label":"Evidence description (no upload)","type":"text","required":true}]'::jsonb),
('publishing','community',false,true,'[{"key":"audience","label":"Proposed audience","options":["All members","Homeowners","Renters","Board","Security"],"required":true},{"key":"pinned","label":"Pin preference","options":["Unpinned","Pinned"],"required":true},{"key":"date","label":"Proposed publication date","type":"date","required":true},{"key":"attachments","label":"Attachment / image / QR description","type":"textarea","required":false}]'::jsonb),
('events','community',false,true,'[{"key":"date","label":"Event date","type":"date","required":true},{"key":"start","label":"Start time","type":"time","required":true},{"key":"end","label":"End time","type":"time","required":true},{"key":"venue","label":"Sample venue","type":"text","required":true}]'::jsonb),
('board-records','documents',false,true,'[{"key":"category","label":"Record category","options":["Minutes","Policy","Financial disclosure","Resolution"],"required":true},{"key":"version","label":"Sample version","type":"text","required":true},{"key":"owner","label":"Sample record owner","type":"text","required":true},{"key":"audience","label":"Proposed audience","options":["Board","Members","Homeowners"],"required":true},{"key":"source","label":"Source / attachment description","type":"text","required":true}]'::jsonb),
('election-setup','documents',false,false,'[{"key":"date","label":"Proposed election date","type":"date","required":true},{"key":"start","label":"Proposed opening time","type":"time","required":true},{"key":"end","label":"Proposed closing time","type":"time","required":true},{"key":"positions","label":"Proposed positions","type":"textarea","required":true},{"key":"eligibility","label":"Eligibility questions","type":"textarea","required":true},{"key":"proxy","label":"Proxy and tally publication questions","type":"textarea","required":true}]'::jsonb),
('billing-proposals','finance',false,false,'[{"key":"period","label":"Sample billing period","type":"text","required":true},{"key":"mode","label":"Proposed billing mode","options":["Flat amount","Per square metre"],"required":true},{"key":"rate","label":"Sample rate (PHP)","type":"number","min":0,"max":1000000,"required":true},{"key":"due","label":"Proposed due date","type":"date","required":true},{"key":"scope","label":"Sample unit scope","type":"text","required":true}]'::jsonb),
('payment-evidence','finance',true,false,'[{"key":"unit","label":"Sample unit","type":"text","required":true},{"key":"date","label":"Sample payment date","type":"date","required":true},{"key":"amount","label":"Sample amount (PHP)","type":"number","min":0,"max":1000000,"required":true},{"key":"reference","label":"Synthetic evidence reference","type":"text","required":true},{"key":"method","label":"Proposed payment method","options":["Bank transfer","Cash","Other"],"required":true},{"key":"allocation","label":"Proposed invoice allocation","type":"text","required":true}]'::jsonb),
('budgets','finance',false,false,'[{"key":"period","label":"Sample reporting period","type":"text","required":true},{"key":"category","label":"Sample expense category","type":"text","required":true},{"key":"planned","label":"Sample planned amount (PHP)","type":"number","min":0,"max":1000000,"required":true},{"key":"actual","label":"Sample actual amount (PHP)","type":"number","min":0,"max":1000000,"required":true},{"key":"source","label":"Sample report source","type":"text","required":true}]'::jsonb),
('access-proposals','operations',false,false,'[{"key":"account","label":"Synthetic account label","type":"text","required":true},{"key":"change","label":"Proposed action","options":["Invitation","Manual account setup","Suspend account","Main role","Extra role","Page visibility","Individual override","Access manager","View-only restriction"],"required":true},{"key":"scope","label":"Proposed scope","type":"text","required":true},{"key":"evidence","label":"Supporting reference","type":"text","required":true}]'::jsonb),
('facility-rules','operations',false,false,'[{"key":"setting","label":"Setting area","options":["Facility rules","Renter access","Office hours","Quiet hours","Request categories","Booth venues","Association details","Notification preferences"],"required":true},{"key":"scope","label":"Sample setting scope","type":"text","required":true},{"key":"proposed","label":"Proposed value","type":"textarea","required":true}]'::jsonb),
('election-candidates','documents',false,true,'[{"key":"electionId","label":"Local election proposal reference","type":"text","required":true},{"key":"position","label":"Proposed position","type":"text","required":true},{"key":"nominee","label":"Synthetic nominee label","type":"text","required":true},{"key":"biography","label":"Sample candidate introduction","type":"textarea","required":true},{"key":"photoDescription","label":"Synthetic photo description (no upload)","type":"text","required":true}]'::jsonb);
NOTIFY pgrst,'reload schema';
COMMIT;
