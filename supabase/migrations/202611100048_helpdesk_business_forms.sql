-- Apply after 047. Structured Helpdesk questions and Office handling.
-- Existing request ownership, creation/status permissions and reply service remain.
-- No requests, assignments, permission grants or sample records are seeded.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_request_business_details (
 request_id uuid PRIMARY KEY REFERENCES public.bfe_requests(id),
 details jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(details)='object'),
 priority text NOT NULL DEFAULT 'Untriaged' CHECK(priority IN ('Untriaged','Low','Normal','High','Urgent')),
 assignee_id uuid REFERENCES auth.users(id),
 resolution text NOT NULL DEFAULT '' CHECK(char_length(resolution)<=5000),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.bfe_request_handling_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 request_id uuid NOT NULL REFERENCES public.bfe_requests(id),
 actor_id uuid NOT NULL, reference text NOT NULL,
 before_values jsonb NOT NULL, after_values jsonb NOT NULL, at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bfe_request_handling_history ON public.bfe_request_handling_audit(request_id,at DESC);
ALTER TABLE public.bfe_request_business_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_request_handling_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_request_business_details,public.bfe_request_handling_audit FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_request_business_context(p_request uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_request_business_details; handle boolean; assignable boolean;
BEGIN
 IF NOT public.bfe_request_access(p_request) THEN RAISE EXCEPTION 'Request unavailable.' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.bfe_request_business_details WHERE request_id=p_request;
 handle:='admin'=ANY(public.bfe_current_roles()) AND public.bfe_can('requests','view','association') AND public.bfe_can('requests','status','association');
 assignable:=handle AND public.bfe_can('requests','assign','association');
 RETURN jsonb_build_object('details',coalesce(r.details,'{}'), 'priority',coalesce(r.priority,'Untriaged'),
  'assignee_id',r.assignee_id,'assignee_name',(SELECT m.name FROM public.members m WHERE m.user_id=r.assignee_id AND m.status='Active' LIMIT 1),
  'resolution',coalesce(r.resolution,''),'version',coalesce(r.version,0),'can_handle',handle,'can_assign',assignable,
  'handlers',CASE WHEN assignable THEN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(m.name,'Account holder')) ORDER BY m.name,m.user_id),'[]') FROM public.members m
   WHERE m.user_id IS NOT NULL AND m.status='Active' AND (SELECT count(*) FROM public.members d WHERE d.user_id=m.user_id)=1
   AND 'admin'=ANY(public.bfe_roles_for(m.user_id)) AND public.bfe_can_for(m.user_id,'requests','view','association') AND public.bfe_can_for(m.user_id,'requests','reply','association')) ELSE '[]'::jsonb END);
END;$$;

CREATE FUNCTION public.bfe_create_business_request(p_client_id uuid,p_title text,p_description text,p_category text,p_details jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; rid uuid; k text; v text; normalized jsonb:='{}'; existing jsonb;
BEGIN
 IF p_details IS NULL OR jsonb_typeof(p_details)<>'object' OR octet_length(p_details::text)>5000 THEN RAISE EXCEPTION 'Check the request questions.' USING ERRCODE='22023'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_details) LOOP
  IF k NOT IN ('topic','location','party','service','evidence_reference') OR jsonb_typeof(p_details->k)<>'string' THEN RAISE EXCEPTION 'Unsupported request question.' USING ERRCODE='22023'; END IF;
  v:=btrim(p_details->>k);
  IF char_length(v)>(CASE k WHEN 'topic' THEN 120 WHEN 'service' THEN 120 WHEN 'evidence_reference' THEN 500 ELSE 200 END) THEN RAISE EXCEPTION 'Request answer is too long.' USING ERRCODE='22023'; END IF;
  IF v<>'' AND ((k='party' AND p_category<>'Complaint') OR (k='service' AND p_category NOT IN ('Support','Document')) OR (k='location' AND p_category NOT IN ('Maintenance','Concern','Complaint','Idea')) OR (k='evidence_reference' AND p_category='Idea')) THEN RAISE EXCEPTION 'This question does not apply to the selected category.' USING ERRCODE='22023'; END IF;
  IF v<>'' THEN normalized:=normalized||jsonb_build_object(k,v); END IF;
 END LOOP;
 -- Reuse the installed creation guard, rate limit, idempotency and audit.
 result:=public.bfe_create_request(p_client_id,p_title,p_description,p_category); rid:=(result->>'id')::uuid;
 SELECT details INTO existing FROM public.bfe_request_business_details WHERE request_id=rid FOR UPDATE;
 IF FOUND AND existing IS DISTINCT FROM normalized THEN RAISE EXCEPTION 'Submission reference already used for different answers.' USING ERRCODE='22023'; END IF;
 INSERT INTO public.bfe_request_business_details(request_id,details) VALUES(rid,normalized) ON CONFLICT DO NOTHING;
 RETURN result;
END;$$;

CREATE FUNCTION public.bfe_save_request_handling(p_request uuid,p_request_version integer,p_context_version integer,p_priority text,p_assignee uuid,p_resolution text,p_reference text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_requests; c public.bfe_request_business_details; before_value jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT ('admin'=ANY(public.bfe_current_roles())) OR NOT public.bfe_can('requests','view','association') OR NOT public.bfe_can('requests','status','association') THEN RAISE EXCEPTION 'Office request handling permission required.' USING ERRCODE='42501'; END IF;
 IF p_priority IS NULL OR p_priority NOT IN ('Untriaged','Low','Normal','High','Urgent') OR p_resolution IS NULL OR char_length(btrim(p_resolution))>5000 OR p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Check priority, resolution and handling reference.' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM public.bfe_requests WHERE id=p_request FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Request unavailable.' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM public.bfe_request_business_details WHERE request_id=p_request FOR UPDATE;
 IF p_request_version IS NULL OR p_request_version<>r.version OR p_context_version IS NULL OR p_context_version<>coalesce(c.version,0) THEN RAISE EXCEPTION 'Request changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
 IF r.status='Resolved' THEN RAISE EXCEPTION 'Reopen the request before changing its handling.' USING ERRCODE='22023'; END IF;
 IF p_assignee IS DISTINCT FROM c.assignee_id THEN
  IF NOT public.bfe_can('requests','assign','association') THEN RAISE EXCEPTION 'Request assignment permission required.' USING ERRCODE='42501'; END IF;
  IF p_assignee IS NOT NULL AND (NOT ('admin'=ANY(public.bfe_roles_for(p_assignee))) OR NOT public.bfe_can_for(p_assignee,'requests','view','association') OR NOT public.bfe_can_for(p_assignee,'requests','reply','association')) THEN RAISE EXCEPTION 'Choose an active authorized request handler.' USING ERRCODE='22023'; END IF;
 END IF;
 before_value:=jsonb_build_object('priority',coalesce(c.priority,'Untriaged'),'assignee_id',c.assignee_id,'resolution',coalesce(c.resolution,''));
 IF before_value=jsonb_build_object('priority',p_priority,'assignee_id',p_assignee,'resolution',btrim(p_resolution)) THEN RETURN public.bfe_request_business_context(p_request); END IF;
 INSERT INTO public.bfe_request_business_details(request_id,priority,assignee_id,resolution)
 VALUES(p_request,p_priority,p_assignee,btrim(p_resolution)) ON CONFLICT(request_id) DO UPDATE
 SET priority=EXCLUDED.priority,assignee_id=EXCLUDED.assignee_id,resolution=EXCLUDED.resolution,version=bfe_request_business_details.version+1,updated_at=now();
 UPDATE public.bfe_requests SET version=version+1,updated_at=now() WHERE id=p_request;
 INSERT INTO public.bfe_request_handling_audit(request_id,actor_id,reference,before_values,after_values)
 VALUES(p_request,auth.uid(),btrim(p_reference),before_value,jsonb_build_object('priority',p_priority,'assignee_id',p_assignee,'resolution',btrim(p_resolution)));
 IF p_assignee IS NOT NULL AND p_assignee IS DISTINCT FROM c.assignee_id THEN
  INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
  VALUES(p_assignee,'request','Request assigned','Open Helpdesk to review your assigned request.','/office/requests','handling:'||p_request||':'||(r.version+1));
 END IF;
 RETURN public.bfe_request_business_context(p_request);
END;$$;

CREATE FUNCTION public.bfe_require_request_resolution() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='Resolved' AND OLD.status IS DISTINCT FROM 'Resolved' AND NOT EXISTS(SELECT 1 FROM public.bfe_request_business_details WHERE request_id=NEW.id AND char_length(btrim(resolution))>=5) THEN
  RAISE EXCEPTION 'Record the resolution in Office handling before resolving this request.' USING ERRCODE='22023';
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER bfe_request_resolution_required BEFORE UPDATE OF status ON public.bfe_requests FOR EACH ROW EXECUTE FUNCTION public.bfe_require_request_resolution();
REVOKE ALL ON FUNCTION public.bfe_require_request_resolution() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.bfe_request_business_context(uuid),public.bfe_create_business_request(uuid,text,text,text,jsonb),public.bfe_save_request_handling(uuid,integer,integer,text,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_request_business_context(uuid),public.bfe_create_business_request(uuid,text,text,text,jsonb),public.bfe_save_request_handling(uuid,integer,integer,text,uuid,text,text) TO authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
