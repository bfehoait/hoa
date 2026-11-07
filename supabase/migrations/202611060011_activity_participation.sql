-- Apply once after 010. Capacity-controlled booth, workshop and private-carpool participation.
BEGIN;
CREATE TABLE public.bfe_activity_participation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),activity_id uuid NOT NULL REFERENCES public.bfe_feature_records(id),
 owner_id uuid NOT NULL REFERENCES auth.users(id),client_id uuid NOT NULL,
 places integer NOT NULL CHECK(places BETWEEN 1 AND 50),details text NOT NULL CHECK(char_length(btrim(details)) BETWEEN 5 AND 1000),
 status text NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Confirmed','Rejected','Withdrawn')),
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(owner_id,client_id)
);
CREATE UNIQUE INDEX bfe_one_current_participation ON public.bfe_activity_participation(activity_id,owner_id) WHERE status IN ('Pending','Confirmed');
CREATE TABLE public.bfe_participation_audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,participation_id uuid NOT NULL REFERENCES public.bfe_activity_participation(id),actor_id uuid NOT NULL,action text NOT NULL,note text NOT NULL,at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.bfe_activity_participation ENABLE ROW LEVEL SECURITY;ALTER TABLE public.bfe_participation_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_activity_participation,public.bfe_participation_audit FROM PUBLIC,anon,authenticated;REVOKE ALL ON SEQUENCE public.bfe_participation_audit_id_seq FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_activity_open(p_activity uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.bfe_feature_records r WHERE r.id=p_activity AND r.module IN ('booth-events','workshops','carpools') AND r.status='Published' AND r.expires_at>now()
 AND r.fields->>'date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 AND ((r.fields->>'date')||' '||coalesce(r.fields->>'start',r.fields->>'time'))::timestamp AT TIME ZONE 'Asia/Manila'>now());
$$;
CREATE FUNCTION public.bfe_request_participation(p_client uuid,p_activity uuid,p_places integer,p_details text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records; e public.bfe_activity_participation; cap integer; module_cap text;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('activity:'||auth.uid()::text,0));
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_activity FOR UPDATE;
 module_cap:=CASE WHEN r.module='carpools' THEN 'transport' ELSE 'livelihood' END;
 IF NOT (public.bfe_current_roles() && ARRAY['homeowner','renter']::text[]) OR NOT public.bfe_can(module_cap,'create','own') OR r.id IS NULL OR NOT (r.audience='members' OR r.audience=ANY(public.bfe_current_roles())) THEN RAISE EXCEPTION 'Participation permission and a visible activity required.' USING ERRCODE='42501'; END IF;
 IF p_client IS NULL OR p_places IS NULL OR p_places NOT BETWEEN 1 AND 50 OR p_details IS NULL OR char_length(btrim(p_details)) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Check participation details.' USING ERRCODE='22023'; END IF;
 SELECT * INTO e FROM public.bfe_activity_participation WHERE owner_id=auth.uid() AND client_id=p_client;
 IF FOUND THEN
  IF e.activity_id<>p_activity OR e.places<>p_places OR e.details<>btrim(p_details) THEN RAISE EXCEPTION 'Submission reference already used.' USING ERRCODE='22023'; END IF;
  RETURN e.id;
 END IF;
 IF NOT public.bfe_activity_open(p_activity) THEN RAISE EXCEPTION 'Activity applications are closed.'; END IF;
 cap:=coalesce(r.fields->>'capacity',r.fields->>'seats')::integer;
 IF p_places>cap OR (r.module='booth-events' AND p_places<>1) THEN RAISE EXCEPTION 'Choose a permitted number of places; a booth application reserves one booth.' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.bfe_activity_participation WHERE owner_id=auth.uid() AND activity_id=p_activity AND status IN ('Pending','Confirmed')) THEN RAISE EXCEPTION 'You already have a current application for this activity.'; END IF;
 IF (SELECT count(*) FROM public.bfe_activity_participation WHERE owner_id=auth.uid() AND created_at>now()-interval '1 minute')>=5 THEN RAISE EXCEPTION 'Please wait before applying again.'; END IF;
 INSERT INTO public.bfe_activity_participation(activity_id,owner_id,client_id,places,details) VALUES(p_activity,auth.uid(),p_client,p_places,btrim(p_details)) RETURNING * INTO e;
 INSERT INTO public.bfe_participation_audit(participation_id,actor_id,action,note) VALUES(e.id,auth.uid(),'Pending','Application submitted; capacity is committed only on confirmation');RETURN e.id;
END;$$;
CREATE FUNCTION public.bfe_decide_participation(p_id uuid,p_version integer,p_status text,p_note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.bfe_activity_participation;r public.bfe_feature_records;cap integer;module_cap text;
BEGIN
 -- Every decision locks the activity before the application, serializing capacity changes.
 SELECT r1.* INTO r FROM public.bfe_feature_records r1 JOIN public.bfe_activity_participation e1 ON e1.activity_id=r1.id WHERE e1.id=p_id FOR UPDATE OF r1;
 SELECT * INTO e FROM public.bfe_activity_participation WHERE id=p_id FOR UPDATE;
 module_cap:=CASE WHEN r.module='carpools' THEN 'transport' ELSE 'livelihood' END;
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR e.id IS NULL THEN RAISE EXCEPTION 'Application unavailable.' USING ERRCODE='42501'; END IF;
 IF p_status='Withdrawn' AND e.owner_id=auth.uid() AND public.bfe_can(module_cap,'view','own') THEN
  IF e.status NOT IN ('Pending','Confirmed') THEN RAISE EXCEPTION 'Application already closed.'; END IF;
 ELSE
  IF NOT public.bfe_can(module_cap,'view','association') OR NOT public.bfe_can(module_cap,'approve','association') THEN RAISE EXCEPTION 'Activity approval permission required.' USING ERRCODE='42501'; END IF;
  IF e.status<>'Pending' OR p_status IS NULL OR p_status NOT IN ('Confirmed','Rejected') THEN RAISE EXCEPTION 'Application decision not permitted.'; END IF;
  IF p_status='Confirmed' THEN
   IF NOT public.bfe_activity_open(e.activity_id) OR NOT (public.bfe_roles_for(e.owner_id) && ARRAY['homeowner','renter']::text[]) THEN RAISE EXCEPTION 'Activity or resident membership is no longer available.'; END IF;
   cap:=coalesce(r.fields->>'capacity',r.fields->>'seats')::integer;
   IF e.places+coalesce((SELECT sum(places) FROM public.bfe_activity_participation WHERE activity_id=e.activity_id AND status='Confirmed'),0)>cap THEN RAISE EXCEPTION 'Not enough capacity remains. Keep pending or reject with a reason.'; END IF;
  END IF;
 END IF;
 IF p_version IS NULL OR e.version<>p_version THEN RAISE EXCEPTION 'Application changed. Refresh before retrying.' USING ERRCODE='40001'; END IF;
 IF p_note IS NULL OR char_length(btrim(p_note)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Provide a decision reason.' USING ERRCODE='22023'; END IF;
 UPDATE public.bfe_activity_participation SET status=p_status,version=version+1 WHERE id=p_id;
 INSERT INTO public.bfe_participation_audit(participation_id,actor_id,action,note) VALUES(p_id,auth.uid(),p_status,btrim(p_note));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(e.owner_id,'community','Activity: '||p_status,'Open activity participation to check your application.','/more/notifications','participation:'||e.id::text||':'||(e.version+1)::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
END;$$;
CREATE FUNCTION public.bfe_participation_dashboard(p_module text,p_office boolean DEFAULT false,p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE module_cap text;rows jsonb;n bigint;
BEGIN
 module_cap:=CASE WHEN p_module='carpools' THEN 'transport' ELSE 'livelihood' END;
 IF p_module IS NULL OR p_module NOT IN ('carpools','booth-events','workshops') OR p_office IS NULL OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Invalid participation filters.' USING ERRCODE='22023'; END IF;
 IF NOT public.bfe_can(module_cap,'view',CASE WHEN p_office THEN 'association' ELSE 'own' END) THEN RAISE EXCEPTION 'Participation access required.' USING ERRCODE='42501'; END IF;
 WITH visible AS (SELECT e.*,r.public_title AS activity_title FROM public.bfe_activity_participation e JOIN public.bfe_feature_records r ON r.id=e.activity_id WHERE r.module=p_module AND (p_office OR e.owner_id=auth.uid())),page AS (SELECT * FROM visible ORDER BY created_at DESC,id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(to_jsonb(page)||jsonb_build_object('history',coalesce((SELECT jsonb_agg(jsonb_build_object('action',a.action,'note',a.note,'at',a.at) ORDER BY a.id DESC) FROM (SELECT * FROM public.bfe_participation_audit WHERE participation_id=page.id ORDER BY id DESC LIMIT 100) a),'[]'::jsonb)) ORDER BY created_at DESC,id),'[]') INTO n,rows FROM page;
 RETURN jsonb_build_object('rows',rows,'total',n,'can_create',public.bfe_can(module_cap,'create','own') AND public.bfe_current_roles() && ARRAY['homeowner','renter']::text[],'can_approve',p_office AND public.bfe_can(module_cap,'approve','association'),
 'activities',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'title',r.public_title,'capacity',coalesce(r.fields->>'capacity',r.fields->>'seats')::integer,'confirmed',coalesce((SELECT sum(places) FROM public.bfe_activity_participation WHERE activity_id=r.id AND status='Confirmed'),0))) FROM public.bfe_feature_records r WHERE r.module=p_module AND public.bfe_activity_open(r.id) AND (r.audience='members' OR r.audience=ANY(public.bfe_current_roles()))),'[]'));
END;$$;
CREATE FUNCTION public.bfe_activity_withdrawn() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.bfe_activity_participation;
BEGIN
 IF NEW.status='Withdrawn' AND OLD.status='Published' THEN
  FOR e IN UPDATE public.bfe_activity_participation SET status='Rejected',version=version+1 WHERE activity_id=NEW.id AND status IN ('Pending','Confirmed') RETURNING * LOOP
   INSERT INTO public.bfe_participation_audit(participation_id,actor_id,action,note) VALUES(e.id,auth.uid(),'Rejected','Activity was withdrawn by its publisher; contact the office about any separate arrangements');
   INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(e.owner_id,'community','Activity withdrawn','An activity you applied to was withdrawn. Open participation to check the record.','/more/notifications','participation:'||e.id::text||':'||e.version::text) ON CONFLICT(recipient_id,event_key) DO NOTHING;
  END LOOP;
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER bfe_activity_withdrawn AFTER UPDATE OF status ON public.bfe_feature_records FOR EACH ROW EXECUTE FUNCTION public.bfe_activity_withdrawn();
REVOKE ALL ON FUNCTION public.bfe_activity_withdrawn() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bfe_activity_open(uuid),public.bfe_request_participation(uuid,uuid,integer,text),public.bfe_decide_participation(uuid,integer,text,text),public.bfe_participation_dashboard(text,boolean,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_request_participation(uuid,uuid,integer,text),public.bfe_decide_participation(uuid,integer,text,text),public.bfe_participation_dashboard(text,boolean,integer) TO authenticated;
NOTIFY pgrst,'reload schema';COMMIT;
