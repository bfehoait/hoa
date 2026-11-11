-- Published resident document library and private reviewed PDF attachments.
-- Reuses feature records, publication/expiry rules and existing review actions.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
-- Published library access follows the association's existing role grants.
-- Add the missing published-document baseline only where no role rule exists;
-- explicit user/role restrictions and explicit action denials remain in force.
INSERT INTO public.bfe_tab_rules(subject_kind,subject_id,module,scope,mode)
VALUES('role','homeowner','documents','approved','view'),('role','renter','documents','approved','view') ON CONFLICT DO NOTHING;

CREATE TABLE public.bfe_document_files(record_id uuid PRIMARY KEY REFERENCES public.bfe_feature_records(id),path text NOT NULL UNIQUE,file_name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.bfe_document_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_document_files FROM PUBLIC,anon,authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('bfe-documents','bfe-documents',false,10485760,ARRAY['application/pdf']) ON CONFLICT(id) DO NOTHING;

CREATE FUNCTION public.bfe_document_access(p_record uuid,p_write boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(cardinality(public.bfe_current_roles())>0 AND EXISTS(
 SELECT 1 FROM public.bfe_feature_records r WHERE r.id=p_record AND r.module='board-records' AND
 CASE WHEN p_write THEN r.owner_id=auth.uid() AND r.status='Submitted' AND r.publication_consent
   AND public.bfe_current_roles() && ARRAY['admin','developer']::text[] AND public.bfe_can('documents','create','association')
 ELSE (r.owner_id=auth.uid() AND public.bfe_can('documents','view','own')) OR public.bfe_can('documents','view','association')
  OR (r.status='Published' AND r.expires_at>now() AND (r.audience='members' OR r.audience=ANY(public.bfe_current_roles())) AND public.bfe_can('documents','view','approved')) END
 ),false);
$$;
CREATE FUNCTION public.bfe_document_object_access(p_name text,p_write boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT public.bfe_document_access(record_id,p_write) FROM public.bfe_document_files WHERE path=p_name),false);
$$;
REVOKE ALL ON FUNCTION public.bfe_document_access(uuid,boolean),public.bfe_document_object_access(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_document_access(uuid,boolean),public.bfe_document_object_access(text,boolean) TO authenticated;
CREATE POLICY bfe_document_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='bfe-documents' AND public.bfe_document_object_access(name,true));
CREATE POLICY bfe_document_select ON storage.objects FOR SELECT TO authenticated USING(bucket_id='bfe-documents' AND public.bfe_document_object_access(name,false));
CREATE POLICY bfe_document_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'bfe-documents' OR public.bfe_document_object_access(name,true));
CREATE POLICY bfe_document_select_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'bfe-documents' OR public.bfe_document_object_access(name,false));
CREATE POLICY bfe_document_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'bfe-documents') WITH CHECK(bucket_id<>'bfe-documents');
CREATE POLICY bfe_document_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'bfe-documents');
CREATE POLICY bfe_document_anon_guard ON storage.objects AS RESTRICTIVE FOR ALL TO anon USING(bucket_id<>'bfe-documents') WITH CHECK(bucket_id<>'bfe-documents');

CREATE FUNCTION public.bfe_prepare_document(p_record uuid,p_name text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result text; r public.bfe_feature_records;
BEGIN
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_record FOR UPDATE;
 IF NOT public.bfe_document_access(p_record,true) THEN RAISE EXCEPTION 'Document upload not allowed.' USING ERRCODE='42501'; END IF;
 IF p_name IS NULL OR char_length(p_name) NOT BETWEEN 5 AND 120 OR lower(right(p_name,4))<>'.pdf' OR p_name ~ '[[:cntrl:]/\\]' THEN RAISE EXCEPTION 'Choose a PDF with a simple filename.' USING ERRCODE='22023'; END IF;
 SELECT path INTO result FROM public.bfe_document_files WHERE record_id=p_record;
 IF FOUND THEN RETURN result; END IF;
 result:=p_record::text||'/'||gen_random_uuid()::text||'.pdf';
 INSERT INTO public.bfe_document_files(record_id,path,file_name) VALUES(p_record,result,p_name);
 RETURN result;
END;$$;
CREATE FUNCTION public.bfe_document_attachment(p_record uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.bfe_document_access(p_record,false) THEN RAISE EXCEPTION 'Document access required.' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_build_object('path',f.path,'name',f.file_name,'ready',EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='bfe-documents' AND o.name=f.path),'can_upload',public.bfe_document_access(p_record,true)) FROM public.bfe_document_files f WHERE record_id=p_record),jsonb_build_object('path',NULL,'name',NULL,'ready',false,'can_upload',public.bfe_document_access(p_record,true)));
END;$$;
CREATE FUNCTION public.bfe_document_uploaded() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rid uuid;
BEGIN
 IF NEW.bucket_id<>'bfe-documents' THEN RETURN NEW; END IF;
 SELECT record_id INTO rid FROM public.bfe_document_files WHERE path=NEW.name;
 PERFORM 1 FROM public.bfe_feature_records WHERE id=rid FOR UPDATE;
 IF NOT public.bfe_document_access(rid,true) THEN RAISE EXCEPTION 'Document upload no longer allowed.' USING ERRCODE='42501'; END IF;
 UPDATE public.bfe_feature_records SET version=version+1,updated_at=now() WHERE id=rid;
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note) VALUES(rid,auth.uid(),'Document attached','Review the PDF before publication');
 RETURN NEW;
END;$$;
CREATE TRIGGER bfe_document_uploaded AFTER INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION public.bfe_document_uploaded();
REVOKE ALL ON FUNCTION public.bfe_document_uploaded() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_document_library(p_search text DEFAULT '',p_category text DEFAULT '',p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; total bigint;
BEGIN
 IF NOT (public.bfe_can('documents','view','approved') OR public.bfe_can('documents','view','association')) THEN RAISE EXCEPTION 'Document access required.' USING ERRCODE='42501'; END IF;
 IF p_search IS NULL OR length(p_search)>100 OR p_category IS NULL OR length(p_category)>60 OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Check document filters.' USING ERRCODE='22023'; END IF;
 WITH visible AS(SELECT r.id,r.public_title AS title,r.public_body AS summary,
 coalesce((SELECT max(a.at) FROM public.bfe_feature_audit a WHERE a.record_id=r.id AND a.action='Published'),r.updated_at,r.created_at) AS created_at,
 r.fields->>'category' AS category,r.fields->>'version' AS version
 FROM public.bfe_feature_records r WHERE r.module='board-records' AND r.status='Published' AND r.expires_at>now() AND (r.audience='members' OR r.audience=ANY(public.bfe_current_roles()))
 AND (p_category='' OR r.fields->>'category'=p_category) AND position(lower(p_search) IN lower(coalesce(r.public_title,'')||' '||coalesce(r.public_body,'')))>0),
 page AS(SELECT * FROM visible ORDER BY created_at DESC,id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(to_jsonb(page) ORDER BY created_at DESC,id),'[]') INTO total,result FROM page;
 RETURN jsonb_build_object('rows',result,'total',total);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_prepare_document(uuid,text),public.bfe_document_attachment(uuid),public.bfe_document_library(text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_prepare_document(uuid,text),public.bfe_document_attachment(uuid),public.bfe_document_library(text,text,integer) TO authenticated;
-- Keep the existing published projection untouched. A dedicated read wraps
-- its authorization before exposing only reviewed listing category/price data.
CREATE FUNCTION public.bfe_livelihood_dashboard(p_module text,p_view text DEFAULT 'published',p_page integer DEFAULT 0,p_search text DEFAULT '',p_category text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; rows jsonb; total bigint;
BEGIN
 IF p_module IS NULL OR p_module NOT IN ('businesses','buy-sell','jobs','garage-sales') OR p_view IS DISTINCT FROM 'published'
 OR p_category IS NULL OR length(p_category)>80 THEN RAISE EXCEPTION 'Check livelihood filters.' USING ERRCODE='22023'; END IF;
 result:=public.bfe_feature_dashboard(p_module,p_view,p_page,p_search);
 WITH visible AS(SELECT r.* FROM public.bfe_feature_records r WHERE r.module=p_module AND r.status='Published' AND r.expires_at>now()
 AND (r.audience='members' OR r.audience=ANY(public.bfe_current_roles()))
 AND position(lower(p_search) IN lower(coalesce(r.public_title,'')||' '||coalesce(r.public_body,'')))>0
 AND (p_category='' OR r.fields->>'category'=p_category)),
 page AS(SELECT * FROM visible ORDER BY created_at DESC,id OFFSET p_page*20 LIMIT 20)
 SELECT (SELECT count(*) FROM visible),coalesce(jsonb_agg(jsonb_build_object('id',id,'module',module,'title',public_title,'detail',public_body,'status',status,'expires_at',expires_at,'created_at',created_at,'fields',jsonb_strip_nulls(jsonb_build_object('category',fields->>'category','condition',fields->>'condition','price',CASE WHEN module='buy-sell' THEN fields->>'price' ELSE NULL END))) ORDER BY created_at DESC,id),'[]') INTO total,rows FROM page;
 RETURN result||jsonb_build_object('rows',rows,'total',total);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_livelihood_dashboard(text,text,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_livelihood_dashboard(text,text,integer,text,text) TO authenticated;

NOTIFY pgrst,'reload schema'; COMMIT;
