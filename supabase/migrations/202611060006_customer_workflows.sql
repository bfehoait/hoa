-- Apply once after 001-005 in the owner-approved target. No legacy data import.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

ALTER TABLE public.bfe_requests DROP CONSTRAINT bfe_requests_category_check;
ALTER TABLE public.bfe_requests ADD CONSTRAINT bfe_requests_category_check
 CHECK(category IN ('Maintenance','Concern','Complaint','Idea','Document','Support'));

CREATE OR REPLACE FUNCTION public.bfe_create_request(p_client_id uuid,p_title text,p_description text,p_category text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.bfe_requests; uid uuid:=auth.uid();
BEGIN
 IF uid IS NULL OR NOT (public.bfe_current_roles() && ARRAY['homeowner','renter']::text[]) OR NOT public.bfe_can('requests','create','own') THEN RAISE EXCEPTION 'An active resident membership is required.' USING ERRCODE='42501'; END IF;
 IF p_client_id IS NULL OR p_title IS NULL OR p_description IS NULL OR p_category IS NULL
 OR char_length(btrim(p_title)) NOT BETWEEN 3 AND 120 OR char_length(btrim(p_description)) NOT BETWEEN 10 AND 5000
 OR p_title !~ '[^[:space:]]' OR p_description !~ '[^[:space:]]'
 OR p_category NOT IN ('Maintenance','Concern','Complaint','Idea','Document','Support') THEN RAISE EXCEPTION 'Check the request title, details and category.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
 SELECT * INTO v FROM public.bfe_requests WHERE owner_id=uid AND client_id=p_client_id;
 IF FOUND THEN
  IF v.title<>btrim(p_title) OR v.description<>btrim(p_description) OR v.category<>p_category THEN RAISE EXCEPTION 'This submission reference was already used for different details.' USING ERRCODE='22023'; END IF;
  RETURN to_jsonb(v);
 END IF;
 IF (SELECT count(*) FROM public.bfe_requests WHERE owner_id=uid AND created_at>now()-interval '1 minute')>=5 THEN RAISE EXCEPTION 'Please wait before submitting another request.'; END IF;
 INSERT INTO public.bfe_requests(owner_id,client_id,title,description,category,unit_snapshot)
 VALUES(uid,p_client_id,btrim(p_title),btrim(p_description),p_category,(SELECT unit FROM public.members WHERE user_id=uid)) RETURNING * INTO v;
 INSERT INTO public.bfe_request_audit(request_id,actor_id,action,new_status) VALUES(v.id,uid,'Created',v.status);
 RETURN to_jsonb(v);
END;$$;

CREATE TABLE public.bfe_shuttles (
 code text PRIMARY KEY CHECK(code IN ('Shuttle 1','Shuttle 2','Alternate Shuttle')),
 driver_id uuid NOT NULL REFERENCES auth.users(id),
 driver_name text NOT NULL CHECK(char_length(btrim(driver_name)) BETWEEN 2 AND 100),
 capacity integer NOT NULL CHECK(capacity BETWEEN 1 AND 50),
 contact text NOT NULL DEFAULT '' CHECK(contact='' OR contact ~ '^\+[0-9]{8,15}$'),
 active boolean NOT NULL DEFAULT false,
 on_duty boolean NOT NULL DEFAULT false, last_seen timestamptz, ready boolean NOT NULL DEFAULT true,
 approval_reference text NOT NULL CHECK(char_length(btrim(approval_reference)) BETWEEN 3 AND 200),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX bfe_one_active_shuttle_per_driver ON public.bfe_shuttles(driver_id) WHERE active;
CREATE TABLE public.bfe_shuttle_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id),
 client_id uuid NOT NULL, pickup text NOT NULL CHECK(char_length(btrim(pickup)) BETWEEN 3 AND 200),
 destination text NOT NULL CHECK(char_length(btrim(destination)) BETWEEN 3 AND 200),
 passengers integer NOT NULL CHECK(passengers BETWEEN 1 AND 20),
 status text NOT NULL DEFAULT 'Waiting for Shuttle' CHECK(status IN ('Waiting for Shuttle','Accepted','On the way','Arrived','Picked up','Lapsed / Unserved','Cancelled','Passenger absent')),
 shuttle_code text REFERENCES public.bfe_shuttles(code), driver_id uuid REFERENCES auth.users(id), driver_name text,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '1 hour',
 accepted_at timestamptz, arrived_at timestamptz, closed_at timestamptz,
 version integer NOT NULL DEFAULT 1, reason text,
 UNIQUE(owner_id,client_id), CHECK(expires_at=created_at+interval '1 hour')
);
CREATE INDEX bfe_shuttle_queue ON public.bfe_shuttle_requests(status,created_at);
CREATE TABLE public.bfe_shuttle_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 request_id uuid REFERENCES public.bfe_shuttle_requests(id), actor_id uuid,
 action text NOT NULL, at timestamptz NOT NULL DEFAULT now(), details jsonb NOT NULL DEFAULT '{}'
);
ALTER TABLE public.bfe_notifications DROP CONSTRAINT bfe_notifications_kind_check;
ALTER TABLE public.bfe_notifications ADD CONSTRAINT bfe_notifications_kind_check CHECK(kind IN ('request','account','access','community','shuttle'));
ALTER TABLE public.bfe_notifications DROP CONSTRAINT bfe_notifications_path_check;
ALTER TABLE public.bfe_notifications ADD CONSTRAINT bfe_notifications_path_check CHECK(path IN ('/services/requests','/office/requests','/more/profile','/developer/access','/more/notifications','/more/transport','/driver/dispatch'));
CREATE FUNCTION public.bfe_shuttle_notification() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 VALUES(NEW.owner_id,'shuttle','Shuttle: '||NEW.status,
  CASE WHEN NEW.status='Lapsed / Unserved' THEN 'The shuttle did not arrive within 60 minutes. You may request again or contact the office.' ELSE 'Open Shuttle to check your request and assigned vehicle. Pickup is confirmed separately from arrival.' END,
  '/more/transport','shuttle:'||NEW.id::text||':'||NEW.version::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
 IF NEW.status='Waiting for Shuttle' THEN
  INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
  SELECT s.driver_id,'shuttle','New shuttle request','A resident is waiting for an authorized shuttle. Open the current queue.','/driver/dispatch','shuttle:'||NEW.id::text||':'||NEW.version::text
  FROM public.bfe_shuttles s WHERE public.bfe_shuttle_available(s.driver_id) ON CONFLICT(recipient_id,event_key) DO NOTHING;
 ELSIF NEW.driver_id IS NOT NULL AND NEW.status IN ('Lapsed / Unserved','Cancelled') THEN
  INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(NEW.driver_id,'shuttle','Assignment: '||NEW.status,'This request is no longer active. Check the queue before accepting another.','/driver/dispatch','shuttle:'||NEW.id::text||':'||NEW.version::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER bfe_shuttle_notification AFTER INSERT OR UPDATE OF status ON public.bfe_shuttle_requests FOR EACH ROW EXECUTE FUNCTION public.bfe_shuttle_notification();
REVOKE ALL ON FUNCTION public.bfe_shuttle_notification() FROM PUBLIC,anon,authenticated;
ALTER TABLE public.bfe_shuttles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_shuttle_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_shuttle_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_shuttles,public.bfe_shuttle_requests,public.bfe_shuttle_audit FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.bfe_shuttle_audit_id_seq FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_shuttle_driver() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT 'driver'=ANY(public.bfe_current_roles()) AND EXISTS(SELECT 1 FROM public.bfe_shuttles WHERE driver_id=auth.uid() AND active);
$$;
CREATE FUNCTION public.bfe_shuttle_reviewer() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.bfe_can('transport','view','association');
$$;
CREATE FUNCTION public.bfe_shuttle_available(p_driver uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT 'driver'=ANY(public.bfe_roles_for(p_driver)) AND EXISTS(SELECT 1 FROM public.bfe_shuttles s WHERE s.driver_id=p_driver AND s.active AND s.on_duty AND s.last_seen>now()-interval '2 minutes');
$$;
CREATE FUNCTION public.bfe_shuttle_presence(p_on_duty boolean DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.bfe_shuttle_driver() THEN RAISE EXCEPTION 'Authorized shuttle driver required.' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('bfe-shuttle-roster',0));
 IF p_on_duty=false AND EXISTS(SELECT 1 FROM public.bfe_shuttle_requests WHERE driver_id=auth.uid() AND (status='Arrived' OR (status IN ('Accepted','On the way') AND expires_at>now()))) THEN RAISE EXCEPTION 'Resolve your current assignment before going off duty.'; END IF;
 UPDATE public.bfe_shuttles SET on_duty=coalesce(p_on_duty,on_duty),last_seen=now() WHERE driver_id=auth.uid() AND active;
 IF p_on_duty IS NOT NULL THEN INSERT INTO public.bfe_shuttle_audit(actor_id,action) VALUES(auth.uid(),CASE WHEN p_on_duty THEN 'Driver on duty' ELSE 'Driver off duty' END); END IF;
END;$$;
CREATE FUNCTION public.bfe_shuttle_ready() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.bfe_shuttle_driver() THEN RAISE EXCEPTION 'Authorized shuttle driver required.' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('bfe-shuttle-roster',0));
 IF EXISTS(SELECT 1 FROM public.bfe_shuttle_requests WHERE driver_id=auth.uid() AND (status='Arrived' OR (status IN ('Accepted','On the way') AND expires_at>now()))) THEN RAISE EXCEPTION 'Resolve your current assignment first.'; END IF;
 UPDATE public.bfe_shuttles SET ready=true,last_seen=now() WHERE driver_id=auth.uid() AND active;
 INSERT INTO public.bfe_shuttle_audit(actor_id,action) VALUES(auth.uid(),'Driver ready for next pickup');
END;$$;
-- Due requests are hidden by deadline predicates even before the scheduled sweep.
CREATE FUNCTION public.bfe_expire_shuttle_requests() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 WITH expired AS (
  UPDATE public.bfe_shuttle_requests SET status='Lapsed / Unserved',closed_at=expires_at,version=version+1,reason='Shuttle did not arrive within 60 minutes'
  WHERE status IN ('Waiting for Shuttle','Accepted','On the way') AND expires_at<=now() RETURNING id,expires_at
 ) INSERT INTO public.bfe_shuttle_audit(request_id,action,at) SELECT id,'Lapsed / Unserved',expires_at FROM expired;
 GET DIAGNOSTICS n=ROW_COUNT;
 RETURN n;
END;$$;

CREATE FUNCTION public.bfe_configure_shuttle(p_code text,p_driver uuid,p_name text,p_contact text,p_active boolean,p_reference text,p_capacity integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT ('developer'=ANY(public.bfe_current_roles())) THEN RAISE EXCEPTION 'Developer roster management required.' USING ERRCODE='42501'; END IF;
 IF p_code IS NULL OR p_driver IS NULL OR p_name IS NULL OR p_contact IS NULL OR p_active IS NULL OR p_reference IS NULL OR p_capacity IS NULL OR p_capacity NOT BETWEEN 1 AND 50
 OR p_code NOT IN ('Shuttle 1','Shuttle 2','Alternate Shuttle') OR char_length(btrim(p_name)) NOT BETWEEN 2 AND 100 OR p_name !~ '[^[:space:]]' OR p_reference !~ '[^[:space:]]'
 OR (p_contact<>'' AND p_contact !~ '^\+[0-9]{8,15}$') OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200
 OR NOT ('driver'=ANY(public.bfe_roles_for(p_driver))) THEN RAISE EXCEPTION 'Choose an active driver and provide approved display/contact details and reference.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('bfe-shuttle-roster',0));
 IF EXISTS(SELECT 1 FROM public.bfe_shuttle_requests WHERE shuttle_code=p_code AND status IN ('Accepted','On the way','Arrived') AND (status='Arrived' OR expires_at>now())) THEN RAISE EXCEPTION 'Resolve active assignments before changing this shuttle roster.'; END IF;
 INSERT INTO public.bfe_shuttles(code,driver_id,driver_name,contact,active,approval_reference,capacity) VALUES(p_code,p_driver,btrim(p_name),p_contact,p_active,btrim(p_reference),p_capacity)
 ON CONFLICT(code) DO UPDATE SET driver_id=excluded.driver_id,driver_name=excluded.driver_name,contact=excluded.contact,active=excluded.active,approval_reference=excluded.approval_reference,capacity=excluded.capacity,on_duty=false,last_seen=NULL,updated_at=now();
 INSERT INTO public.bfe_shuttle_audit(actor_id,action,details) VALUES(auth.uid(),'Roster configured',jsonb_build_object('code',p_code,'active',p_active,'reference',btrim(p_reference)));
END;$$;

CREATE FUNCTION public.bfe_create_shuttle_request(p_client uuid,p_pickup text,p_destination text,p_passengers integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_shuttle_requests; uid uuid:=auth.uid();
BEGIN
 IF NOT (public.bfe_current_roles() && ARRAY['homeowner','renter']::text[]) THEN RAISE EXCEPTION 'Active resident membership required.' USING ERRCODE='42501'; END IF;
 IF p_client IS NULL OR p_pickup IS NULL OR p_destination IS NULL OR p_passengers IS NULL OR p_pickup !~ '[^[:space:]]' OR p_destination !~ '[^[:space:]]' OR char_length(btrim(p_pickup)) NOT BETWEEN 3 AND 200 OR char_length(btrim(p_destination)) NOT BETWEEN 3 AND 200 OR p_passengers NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'Check pickup, destination and passenger count.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('shuttle:'||uid::text,0));
 SELECT * INTO r FROM public.bfe_shuttle_requests WHERE owner_id=uid AND client_id=p_client;
 IF FOUND THEN
  IF r.pickup<>btrim(p_pickup) OR r.destination<>btrim(p_destination) OR r.passengers<>p_passengers THEN RAISE EXCEPTION 'Submission reference already used.' USING ERRCODE='22023'; END IF;
  RETURN r.id;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bfe_shuttles s WHERE public.bfe_shuttle_available(s.driver_id)) THEN RAISE EXCEPTION 'No authorized shuttle is currently available. Contact the office.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bfe_shuttles s WHERE capacity>=p_passengers AND public.bfe_shuttle_available(s.driver_id)) THEN RAISE EXCEPTION 'No authorized shuttle can accommodate this group. Contact the office.'; END IF;
 IF EXISTS(SELECT 1 FROM public.bfe_shuttle_requests WHERE owner_id=uid AND (status='Arrived' OR (status IN ('Waiting for Shuttle','Accepted','On the way') AND expires_at>now()))) THEN RAISE EXCEPTION 'You already have an active request.'; END IF;
 IF (SELECT count(*) FROM public.bfe_shuttle_requests WHERE owner_id=uid AND created_at>now()-interval '1 hour')>=5 THEN RAISE EXCEPTION 'Too many requests. Contact the office for assistance.'; END IF;
 INSERT INTO public.bfe_shuttle_requests(owner_id,client_id,pickup,destination,passengers) VALUES(uid,p_client,btrim(p_pickup),btrim(p_destination),p_passengers) RETURNING * INTO r;
 INSERT INTO public.bfe_shuttle_audit(request_id,actor_id,action) VALUES(r.id,uid,'Waiting for Shuttle');
 RETURN r.id;
END;$$;

CREATE FUNCTION public.bfe_update_shuttle_request(p_id uuid,p_version integer,p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_shuttle_requests; s public.bfe_shuttles; uid uuid:=auth.uid();
BEGIN
 IF cardinality(public.bfe_current_roles())=0 THEN RAISE EXCEPTION 'Active membership required.' USING ERRCODE='42501'; END IF;
 -- Serialize roster changes and acceptance; a driver cannot claim two requests.
 PERFORM pg_advisory_xact_lock(hashtextextended('bfe-shuttle-roster',0));
 SELECT * INTO r FROM public.bfe_shuttle_requests WHERE id=p_id FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Request unavailable.' USING ERRCODE='42501'; END IF;
 IF p_status='Cancelled' AND r.owner_id=uid THEN
  IF r.status NOT IN ('Waiting for Shuttle','Accepted','On the way','Arrived') THEN RAISE EXCEPTION 'Request already closed.'; END IF;
 ELSE
  IF NOT public.bfe_shuttle_driver() THEN RAISE EXCEPTION 'Authorized shuttle driver required.' USING ERRCODE='42501'; END IF;
  SELECT * INTO s FROM public.bfe_shuttles WHERE active AND driver_id=uid;
  IF p_status='Accepted' THEN
   IF NOT public.bfe_shuttle_available(uid) THEN RAISE EXCEPTION 'Go on duty with a current connection before accepting requests.'; END IF;
   IF r.passengers>s.capacity THEN RAISE EXCEPTION 'This group exceeds your approved vehicle capacity.'; END IF;
   IF r.status<>'Waiting for Shuttle' OR r.driver_id IS NOT NULL THEN RAISE EXCEPTION 'Request already assigned.'; END IF;
   IF EXISTS(SELECT 1 FROM public.bfe_shuttle_requests WHERE driver_id=uid AND (status='Arrived' OR (status IN ('Accepted','On the way') AND expires_at>now()))) THEN RAISE EXCEPTION 'Resolve your current assignment first.'; END IF;
   IF NOT s.ready THEN RAISE EXCEPTION 'Confirm vehicle readiness before accepting another request.'; END IF;
  ELSIF r.driver_id IS DISTINCT FROM uid OR r.shuttle_code IS DISTINCT FROM s.code OR NOT (
   (r.status='Accepted' AND p_status='On the way') OR (r.status='On the way' AND p_status='Arrived')
   OR (r.status='Arrived' AND p_status='Picked up')
   OR (r.status='Arrived' AND p_status='Passenger absent' AND r.arrived_at<=now()-interval '5 minutes')
  ) THEN RAISE EXCEPTION 'This status change is not permitted.' USING ERRCODE='42501'; END IF;
 END IF;
 IF p_version IS NULL OR r.version<>p_version THEN RAISE EXCEPTION 'Request changed. Refresh before retrying.' USING ERRCODE='40001'; END IF;
 IF r.status<>'Arrived' AND r.expires_at<=now() THEN RAISE EXCEPTION 'Request has lapsed. Refresh the queue.'; END IF;
 IF p_status IS NULL THEN RAISE EXCEPTION 'Choose a permitted action.' USING ERRCODE='22023'; END IF;
 UPDATE public.bfe_shuttle_requests SET status=p_status,version=version+1,
 shuttle_code=CASE WHEN p_status='Accepted' THEN s.code ELSE shuttle_code END,
 driver_id=CASE WHEN p_status='Accepted' THEN uid ELSE driver_id END,
 driver_name=CASE WHEN p_status='Accepted' THEN s.driver_name ELSE driver_name END,
 accepted_at=CASE WHEN p_status='Accepted' THEN now() ELSE accepted_at END,
 arrived_at=CASE WHEN p_status='Arrived' THEN now() ELSE arrived_at END,
 closed_at=CASE WHEN p_status IN ('Picked up','Cancelled','Passenger absent') THEN now() ELSE closed_at END,
 reason=CASE WHEN p_status='Passenger absent' THEN 'Passenger not present after five-minute pickup wait' ELSE reason END WHERE id=p_id;
 IF p_status='Accepted' THEN UPDATE public.bfe_shuttles SET ready=false WHERE driver_id=uid AND active; END IF;
 INSERT INTO public.bfe_shuttle_audit(request_id,actor_id,action) VALUES(p_id,uid,p_status);
END;$$;

CREATE FUNCTION public.bfe_shuttle_dashboard(p_history boolean DEFAULT false,p_page integer DEFAULT 0,p_outcome text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE uid uuid:=auth.uid(); driver boolean:=public.bfe_shuttle_driver(); reviewer boolean:=public.bfe_shuttle_reviewer(); manager boolean:='developer'=ANY(public.bfe_current_roles()); rows jsonb; n bigint;
BEGIN
 IF uid IS NULL OR cardinality(public.bfe_current_roles())=0 THEN RAISE EXCEPTION 'Active membership required.' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page<0 OR p_page>10000 OR p_history IS NULL OR p_outcome IS NULL OR p_outcome NOT IN ('','Picked up','Lapsed / Unserved','Cancelled','Passenger absent') OR (NOT p_history AND p_outcome<>'') THEN RAISE EXCEPTION 'Invalid queue filters.' USING ERRCODE='22023'; END IF;
 IF p_history AND NOT (driver OR reviewer) THEN RAISE EXCEPTION 'Service history access required.' USING ERRCODE='42501'; END IF;
 WITH visible AS (
  SELECT r.*,CASE WHEN status IN ('Waiting for Shuttle','Accepted','On the way') AND expires_at<=now() THEN 'Lapsed / Unserved' ELSE status END AS effective_status
  FROM public.bfe_shuttle_requests r
  WHERE (r.owner_id=uid OR reviewer OR (driver AND (r.driver_id=uid OR (r.status='Waiting for Shuttle' AND r.expires_at>now() AND (r.created_at AT TIME ZONE 'Asia/Manila')::date=(now() AT TIME ZONE 'Asia/Manila')::date))))
 ), selected AS (
  SELECT * FROM visible WHERE (p_outcome='' OR effective_status=p_outcome) AND CASE WHEN p_history THEN effective_status IN ('Picked up','Cancelled','Passenger absent','Lapsed / Unserved')
  ELSE effective_status IN ('Waiting for Shuttle','Accepted','On the way','Arrived') AND ((created_at AT TIME ZONE 'Asia/Manila')::date=(now() AT TIME ZONE 'Asia/Manila')::date OR (driver AND driver_id=uid)) END
 ) SELECT count(*),coalesce(jsonb_agg(to_jsonb(x) ORDER BY CASE WHEN NOT p_history AND x.driver_id=uid THEN 0 ELSE 1 END,CASE WHEN p_history THEN x.created_at END DESC,CASE WHEN NOT p_history THEN x.created_at END ASC,x.id) FILTER(WHERE x.id IS NOT NULL),'[]') INTO n,rows
 FROM (SELECT (SELECT count(*) FROM selected) AS total) totals
 LEFT JOIN LATERAL (SELECT id,owner_id,pickup,destination,passengers,effective_status AS status,shuttle_code,driver_id,driver_name,created_at,expires_at,arrived_at,version,reason,
 (created_at AT TIME ZONE 'Asia/Manila')::date<>(now() AT TIME ZONE 'Asia/Manila')::date AS prior_day
 FROM selected ORDER BY CASE WHEN NOT p_history AND driver_id=uid THEN 0 ELSE 1 END,CASE WHEN p_history THEN created_at END DESC,CASE WHEN NOT p_history THEN created_at END ASC,id OFFSET p_page*20 LIMIT 20) x ON true;
 -- Count separately: JSON rows are paginated, total must not be page length.
 SELECT count(*) INTO n FROM public.bfe_shuttle_requests r WHERE (p_outcome='' OR CASE WHEN r.status IN ('Waiting for Shuttle','Accepted','On the way') AND r.expires_at<=now() THEN 'Lapsed / Unserved' ELSE r.status END=p_outcome) AND
 (r.owner_id=uid OR reviewer OR (driver AND (r.driver_id=uid OR (r.status='Waiting for Shuttle' AND r.expires_at>now() AND (r.created_at AT TIME ZONE 'Asia/Manila')::date=(now() AT TIME ZONE 'Asia/Manila')::date))))
 AND CASE WHEN p_history THEN (r.status IN ('Picked up','Cancelled','Passenger absent','Lapsed / Unserved') OR (r.status IN ('Waiting for Shuttle','Accepted','On the way') AND r.expires_at<=now()))
 ELSE (r.status='Arrived' OR (r.status IN ('Waiting for Shuttle','Accepted','On the way') AND r.expires_at>now())) AND ((r.created_at AT TIME ZONE 'Asia/Manila')::date=(now() AT TIME ZONE 'Asia/Manila')::date OR (driver AND r.driver_id=uid)) END;
 RETURN jsonb_build_object('server_now',now(),'driver',driver,'reviewer',reviewer,'manager',manager,'total',n,'rows',rows,
 'waiting_count',(SELECT count(*) FROM public.bfe_shuttle_requests WHERE status='Waiting for Shuttle' AND expires_at>now() AND (created_at AT TIME ZONE 'Asia/Manila')::date=(now() AT TIME ZONE 'Asia/Manila')::date),
 'prior_day_request',(SELECT jsonb_build_object('id',id,'version',version,'status',status,'expires_at',expires_at) FROM public.bfe_shuttle_requests WHERE owner_id=uid AND (created_at AT TIME ZONE 'Asia/Manila')::date<(now() AT TIME ZONE 'Asia/Manila')::date AND (status='Arrived' OR (status IN ('Waiting for Shuttle','Accepted','On the way') AND expires_at>now())) ORDER BY created_at DESC LIMIT 1),
 'latest_outcome',(SELECT jsonb_build_object('status',CASE WHEN status IN ('Waiting for Shuttle','Accepted','On the way') AND expires_at<=now() THEN 'Lapsed / Unserved' ELSE status END,'at',coalesce(closed_at,expires_at)) FROM public.bfe_shuttle_requests WHERE owner_id=uid AND (coalesce(closed_at,expires_at) AT TIME ZONE 'Asia/Manila')::date=(now() AT TIME ZONE 'Asia/Manila')::date AND (status IN ('Picked up','Cancelled','Passenger absent','Lapsed / Unserved') OR (status IN ('Waiting for Shuttle','Accepted','On the way') AND expires_at<=now())) ORDER BY created_at DESC LIMIT 1),
 'shuttles',coalesce((SELECT jsonb_agg(jsonb_build_object('code',s.code,'driver_name',s.driver_name,'capacity',s.capacity,'contact',s.contact,'active',s.active,'on_duty',s.on_duty,'ready',s.ready,'available',public.bfe_shuttle_available(s.driver_id),'driver_id',CASE WHEN manager OR s.driver_id=uid THEN s.driver_id END,'busy',NOT s.ready OR EXISTS(SELECT 1 FROM public.bfe_shuttle_requests r WHERE r.driver_id=s.driver_id AND (r.status='Arrived' OR (r.status IN ('Accepted','On the way') AND r.expires_at>now()))))) FROM public.bfe_shuttles s WHERE (s.active AND 'driver'=ANY(public.bfe_roles_for(s.driver_id))) OR manager),'[]'),
 'eligible_drivers',CASE WHEN manager THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',m.user_id,'name',m.name)) FROM public.members m WHERE 'driver'=ANY(public.bfe_roles_for(m.user_id))),'[]') ELSE '[]'::jsonb END);
END;$$;

REVOKE ALL ON FUNCTION public.bfe_shuttle_driver(),public.bfe_shuttle_reviewer(),public.bfe_expire_shuttle_requests(),public.bfe_configure_shuttle(text,uuid,text,text,boolean,text,integer),public.bfe_create_shuttle_request(uuid,text,text,integer),public.bfe_update_shuttle_request(uuid,integer,text),public.bfe_shuttle_dashboard(boolean,integer,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bfe_shuttle_available(uuid),public.bfe_shuttle_presence(boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bfe_shuttle_ready() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_shuttle_ready() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_shuttle_presence(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_configure_shuttle(text,uuid,text,text,boolean,text,integer),public.bfe_create_shuttle_request(uuid,text,text,integer),public.bfe_update_shuttle_request(uuid,integer,text),public.bfe_shuttle_dashboard(boolean,integer,text) TO authenticated;
-- Owner can schedule SELECT public.bfe_expire_shuttle_requests() once a minute.
-- Read/mutation deadline checks work independently of that archival sweep.
NOTIFY pgrst,'reload schema';
COMMIT;
