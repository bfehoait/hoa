-- Owner-run after 091. Owner request, 23 November 2026: in Community documents,
-- Mandatory Documents download straight away (no Help desk request). Each
-- download is recorded, and every active admin is notified who downloaded what.
-- Admins and developers can read the download history (office documents page).
-- The document names must match packages/shared/src/mandatory-documents.json.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';

CREATE TABLE IF NOT EXISTS public.bfe_document_downloads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 document text NOT NULL CHECK(document IN (
  'Annual Financial Statements (AFS)',
  'Notice of Elections & Election Guidelines',
  'Master List of Qualified Voters',
  'Official Election Results / Tally',
  'Notice of General Assembly / Special Meetings',
  'Proposed Amendments to Articles or By-Laws',
  'New House Rules, Traffic/Parking Rules & Fee/Fine Schedules')),
 downloaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bfe_document_downloads_recent ON public.bfe_document_downloads(downloaded_at DESC,id);
CREATE INDEX IF NOT EXISTS bfe_document_downloads_user ON public.bfe_document_downloads(user_id,downloaded_at);
ALTER TABLE public.bfe_document_downloads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_document_downloads FROM PUBLIC,anon,authenticated;

-- Admin notifications open the office documents page, where the history is shown.
ALTER TABLE public.bfe_notifications DROP CONSTRAINT IF EXISTS bfe_notifications_path_check;
ALTER TABLE public.bfe_notifications ADD CONSTRAINT bfe_notifications_path_check
 CHECK(path IN ('/services/requests','/office/requests','/more/profile',
 '/developer/access','/more/notifications','/more/transport','/driver/dispatch','/account',
 '/office/documents'));

CREATE OR REPLACE FUNCTION public.bfe_record_document_download(p_document text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rid uuid; v_who text; v_unit text;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 THEN
  RAISE EXCEPTION 'Sign in as an active member to download documents.' USING ERRCODE='42501'; END IF;
 IF p_document IS NULL OR p_document NOT IN (
  'Annual Financial Statements (AFS)',
  'Notice of Elections & Election Guidelines',
  'Master List of Qualified Voters',
  'Official Election Results / Tally',
  'Notice of General Assembly / Special Meetings',
  'Proposed Amendments to Articles or By-Laws',
  'New House Rules, Traffic/Parking Rules & Fee/Fine Schedules') THEN
  RAISE EXCEPTION 'Choose a listed mandatory document.' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM public.bfe_document_downloads WHERE user_id=auth.uid() AND downloaded_at>now()-interval '1 minute')>=10 THEN
  RAISE EXCEPTION 'Please wait a moment before downloading more documents.'; END IF;
 INSERT INTO public.bfe_document_downloads(user_id,document) VALUES(auth.uid(),p_document) RETURNING id INTO rid;
 SELECT coalesce(nullif(btrim(m.name),''),'A member'),nullif(btrim(m.unit),'') INTO v_who,v_unit
 FROM public.members m WHERE m.user_id=auth.uid() LIMIT 1;
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 SELECT DISTINCT a.user_id,'community','Document downloaded',
  left(coalesce(v_who,'A member')||coalesce(' ('||v_unit||')','')||' downloaded '||p_document||'.',1000),
  '/office/documents','document-download:'||rid::text
 FROM public.members a
 WHERE a.user_id IS NOT NULL AND a.user_id<>auth.uid() AND a.status='Active'
  AND ('admin'=a.role OR 'admin'=ANY(coalesce(a.extra_roles,ARRAY[]::text[])))
  AND (SELECT count(*) FROM public.members d WHERE d.user_id=a.user_id)=1
 ON CONFLICT(recipient_id,event_key) DO NOTHING;
 RETURN rid;
END;$$;

CREATE OR REPLACE FUNCTION public.bfe_document_download_history(p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb; n bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.bfe_current_roles() && ARRAY['admin','developer']::text[]) THEN
  RAISE EXCEPTION 'Download history is available to admins.' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Invalid page.' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO n FROM public.bfe_document_downloads;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'document',x.document,'downloaded_at',x.downloaded_at,'name',x.name,'unit',x.unit) ORDER BY x.downloaded_at DESC,x.id),'[]'::jsonb) INTO rows
 FROM (
  SELECT d.id,d.document,d.downloaded_at,
   coalesce((SELECT nullif(btrim(m.name),'') FROM public.members m WHERE m.user_id=d.user_id LIMIT 1),'Unknown member') AS name,
   (SELECT nullif(btrim(m.unit),'') FROM public.members m WHERE m.user_id=d.user_id LIMIT 1) AS unit
  FROM public.bfe_document_downloads d ORDER BY d.downloaded_at DESC,d.id OFFSET p_page*20 LIMIT 20
 ) x;
 RETURN jsonb_build_object('rows',rows,'total',n);
END;$$;

REVOKE ALL ON FUNCTION public.bfe_record_document_download(text),public.bfe_document_download_history(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_record_document_download(text),public.bfe_document_download_history(integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
