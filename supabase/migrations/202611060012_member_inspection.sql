-- Apply once after 011. Developer-only, audited, read-only member inspection.
-- Never issues a user token, changes auth.uid(), or grants a member's mutation authority.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_member_inspections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),developer_id uuid NOT NULL REFERENCES auth.users(id),
 target_id uuid NOT NULL REFERENCES auth.users(id),client_id uuid NOT NULL,
 reason text NOT NULL CHECK(char_length(btrim(reason)) BETWEEN 10 AND 500),
 created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',ended_at timestamptz,
 UNIQUE(developer_id,client_id),CHECK(expires_at=created_at+interval '10 minutes')
);
CREATE TABLE public.bfe_member_inspection_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,inspection_id uuid NOT NULL REFERENCES public.bfe_member_inspections(id),
 actor_id uuid NOT NULL,action text NOT NULL CHECK(action IN ('Started','Viewed','Ended')),
 section text,at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bfe_member_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_member_inspection_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_member_inspections,public.bfe_member_inspection_audit FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.bfe_member_inspection_audit_id_seq FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_start_member_inspection(p_client uuid,p_target uuid,p_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.bfe_member_inspections;
BEGIN
 IF NOT ('developer'=ANY(public.bfe_current_roles())) THEN RAISE EXCEPTION 'Active developer membership required.' USING ERRCODE='42501'; END IF;
 IF p_client IS NULL OR p_target IS NULL OR p_reason IS NULL OR char_length(btrim(p_reason)) NOT BETWEEN 10 AND 500 OR p_reason !~ '[^[:space:]]' THEN RAISE EXCEPTION 'Select a member and provide a support reason of 10 to 500 characters.' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM public.members WHERE user_id=p_target)<>1 THEN RAISE EXCEPTION 'Member unavailable or ambiguous.' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('member-inspection:'||auth.uid()::text,0));
 SELECT * INTO s FROM public.bfe_member_inspections WHERE developer_id=auth.uid() AND client_id=p_client;
 IF FOUND THEN
  IF s.target_id<>p_target OR s.reason<>btrim(p_reason) THEN RAISE EXCEPTION 'Support reference already used for different details.' USING ERRCODE='22023'; END IF;
  IF s.ended_at IS NOT NULL OR s.expires_at<=now() THEN RAISE EXCEPTION 'Inspection expired. Start a new inspection.'; END IF;
  RETURN jsonb_build_object('id',s.id,'expires_at',s.expires_at);
 END IF;
 IF (SELECT count(*) FROM public.bfe_member_inspections WHERE developer_id=auth.uid() AND created_at>now()-interval '1 hour')>=30 THEN RAISE EXCEPTION 'Too many inspections. Retry later.'; END IF;
 WITH ended AS (UPDATE public.bfe_member_inspections SET ended_at=now() WHERE developer_id=auth.uid() AND ended_at IS NULL RETURNING id)
 INSERT INTO public.bfe_member_inspection_audit(inspection_id,actor_id,action) SELECT id,auth.uid(),'Ended' FROM ended;
 INSERT INTO public.bfe_member_inspections(developer_id,target_id,client_id,reason) VALUES(auth.uid(),p_target,p_client,btrim(p_reason)) RETURNING * INTO s;
 INSERT INTO public.bfe_member_inspection_audit(inspection_id,actor_id,action) VALUES(s.id,auth.uid(),'Started');
 RETURN jsonb_build_object('id',s.id,'expires_at',s.expires_at);
END;$$;

CREATE FUNCTION public.bfe_end_member_inspection(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT ('developer'=ANY(public.bfe_current_roles())) THEN RAISE EXCEPTION 'Active developer membership required.' USING ERRCODE='42501'; END IF;
 UPDATE public.bfe_member_inspections SET ended_at=coalesce(ended_at,now()) WHERE id=p_id AND developer_id=auth.uid() AND ended_at IS NULL;
 IF FOUND THEN INSERT INTO public.bfe_member_inspection_audit(inspection_id,actor_id,action) VALUES(p_id,auth.uid(),'Ended'); END IF;
END;$$;

CREATE FUNCTION public.bfe_inspect_member(p_id uuid,p_section text DEFAULT 'requests',p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.bfe_member_inspections; m public.members; rows jsonb:='[]';n bigint:=0;caps jsonb;active_roles text[];
BEGIN
 IF NOT ('developer'=ANY(public.bfe_current_roles())) THEN RAISE EXCEPTION 'Active developer membership required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.bfe_member_inspections WHERE id=p_id AND developer_id=auth.uid() FOR UPDATE;
 IF s.id IS NULL OR s.ended_at IS NOT NULL OR s.expires_at<=now() THEN RAISE EXCEPTION 'Inspection ended or expired. Start a new inspection.' USING ERRCODE='42501'; END IF;
 IF p_section IS NULL OR p_section NOT IN ('requests','submissions','bookings','visitor-passes','shuttle','participation') OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Invalid inspection section or page.' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM public.members WHERE user_id=s.target_id)<>1 THEN RAISE EXCEPTION 'Member unavailable or ambiguous.' USING ERRCODE='42501'; END IF;
 SELECT * INTO m FROM public.members WHERE user_id=s.target_id;
 active_roles:=public.bfe_roles_for(s.target_id);
 WITH candidates AS (
 SELECT mm AS module,a AS action,ss AS scope FROM unnest(ARRAY['overview','people','registrations','profiles','property','requests','messages','operations','finance','calendar','security','community','hotlines','livelihood','transport','documents','elections','reports','audit','access','profile','support','technical']) mm CROSS JOIN unnest(ARRAY['view','summary','create','reply','status','assign','publish','approve','export','manage','monitor']) a CROSS JOIN unnest(ARRAY['own','approved','assigned','association']) ss
 UNION SELECT g.module,g.action,g.scope FROM public.bfe_access_grants g JOIN public.bfe_access_assignments a ON a.id=g.assignment_id WHERE a.user_id=s.target_id
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('module',module,'action',action,'scope',scope) ORDER BY module,action,scope),'[]') INTO caps FROM candidates WHERE public.bfe_can_for(s.target_id,module,action,scope);
 IF p_section='requests' AND public.bfe_can_for(s.target_id,'requests','view','own') THEN
  SELECT count(*) INTO n FROM public.bfe_requests WHERE owner_id=s.target_id;
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY created_at DESC,id),'[]') INTO rows FROM (SELECT id,title,description AS detail,status,created_at FROM public.bfe_requests WHERE owner_id=s.target_id ORDER BY created_at DESC,id OFFSET p_page*20 LIMIT 20) x;
 ELSIF p_section='submissions' THEN
  SELECT count(*) INTO n FROM public.bfe_feature_records r JOIN public.bfe_feature_definitions d ON d.code=r.module WHERE r.owner_id=s.target_id AND public.bfe_can_for(s.target_id,d.capability,'view','own');
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY created_at DESC,id),'[]') INTO rows FROM (SELECT r.id,r.module,r.title,r.detail,r.status,r.created_at FROM public.bfe_feature_records r JOIN public.bfe_feature_definitions d ON d.code=r.module WHERE r.owner_id=s.target_id AND public.bfe_can_for(s.target_id,d.capability,'view','own') ORDER BY r.created_at DESC,r.id OFFSET p_page*20 LIMIT 20) x;
 ELSIF p_section='bookings' AND public.bfe_can_for(s.target_id,'calendar','view','own') THEN
  SELECT count(*) INTO n FROM public.bfe_bookings WHERE owner_id=s.target_id;
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY created_at DESC,id),'[]') INTO rows FROM (SELECT r.id,f.name AS title,r.purpose AS detail,r.status,r.created_at,r.starts_at,r.ends_at FROM public.bfe_bookings r JOIN public.bfe_facilities f ON f.id=r.facility_id WHERE r.owner_id=s.target_id ORDER BY r.created_at DESC,r.id OFFSET p_page*20 LIMIT 20) x;
 ELSIF p_section='visitor-passes' AND public.bfe_can_for(s.target_id,'security','view','own') THEN
  SELECT count(*) INTO n FROM public.bfe_visitor_passes WHERE owner_id=s.target_id;
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY created_at DESC,id),'[]') INTO rows FROM (SELECT id,visitor AS title,purpose AS detail,CASE WHEN status IN ('Pending','Approved') AND valid_until<=now() THEN 'Expired' ELSE status END AS status,created_at,valid_from,valid_until FROM public.bfe_visitor_passes WHERE owner_id=s.target_id ORDER BY created_at DESC,id OFFSET p_page*20 LIMIT 20) x;
 ELSIF p_section='shuttle' AND active_roles && ARRAY['homeowner','renter']::text[] THEN
  SELECT count(*) INTO n FROM public.bfe_shuttle_requests WHERE owner_id=s.target_id;
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY created_at DESC,id),'[]') INTO rows FROM (SELECT id,pickup||' → '||destination AS title,'Passengers: '||passengers::text AS detail,CASE WHEN status IN ('Waiting for Shuttle','Accepted','On the way') AND expires_at<=now() THEN 'Lapsed / Unserved' ELSE status END AS status,created_at FROM public.bfe_shuttle_requests WHERE owner_id=s.target_id ORDER BY created_at DESC,id OFFSET p_page*20 LIMIT 20) x;
 ELSIF p_section='participation' THEN
  SELECT count(*) INTO n FROM public.bfe_activity_participation e JOIN public.bfe_feature_records r ON r.id=e.activity_id WHERE e.owner_id=s.target_id AND public.bfe_can_for(s.target_id,CASE WHEN r.module='carpools' THEN 'transport' ELSE 'livelihood' END,'view','own');
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY created_at DESC,id),'[]') INTO rows FROM (SELECT e.id,coalesce(r.public_title,r.title) AS title,e.details AS detail,e.status,e.created_at FROM public.bfe_activity_participation e JOIN public.bfe_feature_records r ON r.id=e.activity_id WHERE e.owner_id=s.target_id AND public.bfe_can_for(s.target_id,CASE WHEN r.module='carpools' THEN 'transport' ELSE 'livelihood' END,'view','own') ORDER BY e.created_at DESC,e.id OFFSET p_page*20 LIMIT 20) x;
 END IF;
 INSERT INTO public.bfe_member_inspection_audit(inspection_id,actor_id,action,section) VALUES(s.id,auth.uid(),'Viewed',p_section);
 RETURN jsonb_build_object('read_only',true,'server_now',now(),'expires_at',s.expires_at,'member',jsonb_build_object('user_id',m.user_id,'name',m.name,'unit',m.unit,'role',m.role,'extra_roles',m.extra_roles,'status',m.status),'active_roles',active_roles,'capabilities',caps,'rows',rows,'total',n);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_start_member_inspection(uuid,uuid,text),public.bfe_end_member_inspection(uuid),public.bfe_inspect_member(uuid,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_start_member_inspection(uuid,uuid,text),public.bfe_end_member_inspection(uuid),public.bfe_inspect_member(uuid,text,integer) TO authenticated;
NOTIFY pgrst,'reload schema';COMMIT;
