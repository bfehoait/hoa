-- Apply once after 012. Read-only reuse of existing portal endpoints in an audited support session.
-- The real JWT/login is unchanged. Only explicitly allowed STABLE reads run with a transaction-local
-- member database context; the original context is restored on success AND every error.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.bfe_preview_requests(p_office boolean DEFAULT false,p_page integer DEFAULT 0,p_status text DEFAULT '',p_category text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb;n bigint;
BEGIN
 IF p_office IS NULL OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 OR p_status IS NULL OR length(p_status)>50 OR p_category IS NULL OR length(p_category)>50 THEN RAISE EXCEPTION 'Invalid request filters.' USING ERRCODE='22023'; END IF;
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 THEN RAISE EXCEPTION 'Active member required.' USING ERRCODE='42501'; END IF;
 WITH visible AS (SELECT r.* FROM public.bfe_requests r WHERE public.bfe_request_access(r.id) AND (p_office OR r.owner_id=auth.uid()) AND (p_status='' OR r.status=p_status) AND (p_category='' OR r.category=p_category)),page AS (SELECT * FROM visible ORDER BY updated_at DESC,id DESC OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(to_jsonb(page) ORDER BY updated_at DESC,id DESC),'[]') INTO n,rows FROM page;
 RETURN jsonb_build_object('records',rows,'total',n,'sample',false);
END;$$;
CREATE FUNCTION public.bfe_preview_request_thread(p_id uuid,p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb;n bigint;
BEGIN
 IF NOT public.bfe_request_access(p_id) THEN RAISE EXCEPTION 'Thread unavailable.' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Invalid thread page.' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO n FROM public.bfe_request_messages WHERE request_id=p_id;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY created_at DESC,id DESC),'[]') INTO rows FROM (SELECT * FROM public.bfe_request_messages WHERE request_id=p_id ORDER BY created_at DESC,id DESC OFFSET p_page*20 LIMIT 20) x;
 RETURN jsonb_build_object('records',rows,'total',n);
END;$$;
CREATE FUNCTION public.bfe_account_preview_read(p_session uuid,p_name text,p_args jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.bfe_member_inspections;actor uuid:=auth.uid();original_sub text:=current_setting('request.jwt.claim.sub',true);proc record;k text;arg_sql text:='';idx integer;result jsonb;
BEGIN
 IF NOT ('developer'=ANY(public.bfe_current_roles())) THEN RAISE EXCEPTION 'Active developer required.' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.bfe_member_inspections WHERE id=p_session AND developer_id=actor FOR UPDATE;
 IF s.id IS NULL OR s.ended_at IS NOT NULL OR s.expires_at<=now() OR cardinality(public.bfe_roles_for(s.target_id))=0 THEN RAISE EXCEPTION 'Account preview expired or member access unavailable.' USING ERRCODE='42501'; END IF;
 IF p_name IS NULL OR p_name NOT IN ('bfe_get_member','bfe_get_profile','bfe_my_access','bfe_my_notifications','bfe_list_lots','bfe_lot_detail','bfe_lot_receipts','bfe_staff_directory','bfe_access_members','bfe_member_assignments','bfe_monitor_module','bfe_feature_dashboard','bfe_booking_dashboard','bfe_booking_availability','bfe_visitor_dashboard','bfe_workflow_history','bfe_participation_dashboard','bfe_shuttle_dashboard','bfe_preview_requests','bfe_preview_request_thread') THEN RAISE EXCEPTION 'Changes and unsupported endpoints are disabled in account preview.' USING ERRCODE='42501'; END IF;
 IF p_args IS NULL OR jsonb_typeof(p_args)<>'object' OR octet_length(p_args::text)>10000 THEN RAISE EXCEPTION 'Invalid read arguments.' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=p_name)<>1 OR NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=p_name AND p.provolatile='s' AND p.prosecdef) THEN RAISE EXCEPTION 'Read endpoint unavailable.' USING ERRCODE='42501'; END IF;
 SELECT p.* INTO proc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=p_name AND p.provolatile='s' AND p.prosecdef;
 FOR k IN SELECT jsonb_object_keys(p_args) LOOP
  idx:=array_position(proc.proargnames,k);
  IF idx IS NULL THEN RAISE EXCEPTION 'Unexpected read argument.' USING ERRCODE='22023'; END IF;
  arg_sql:=arg_sql||CASE WHEN arg_sql='' THEN '' ELSE ',' END||format('%I => ($1 ->> %L)::%s',k,k,pg_catalog.format_type(proc.proargtypes[idx-1],NULL));
 END LOOP;
 -- No request-supplied SQL, function identifier or cast type is executed.
 -- Names are an explicit allowlist; casts/argument names come from the system catalog.
 BEGIN
  PERFORM set_config('request.jwt.claim.sub',s.target_id::text,true);
  EXECUTE format('SELECT public.%I(%s)',p_name,arg_sql) INTO result USING p_args;
  PERFORM set_config('request.jwt.claim.sub',coalesce(original_sub,''),true);
 EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('request.jwt.claim.sub',coalesce(original_sub,''),true);RAISE;
 END;
 INSERT INTO public.bfe_member_inspection_audit(inspection_id,actor_id,action,section) VALUES(s.id,actor,'Viewed','interface:'||p_name);
 IF p_name='bfe_get_member' THEN result:=result||jsonb_build_object('_preview_expires_at',s.expires_at,'_preview_server_now',now()); END IF;
 RETURN result;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_preview_requests(boolean,integer,text,text),public.bfe_preview_request_thread(uuid,integer),public.bfe_account_preview_read(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_account_preview_read(uuid,text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';COMMIT;
