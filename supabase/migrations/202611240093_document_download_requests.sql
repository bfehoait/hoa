-- Owner-run after 092. Owner request, 24 November 2026: Community documents are
-- view-only. To download a Mandatory Document or a Right to Inspect record, a
-- member requests it; an admin approves or declines; an approval unlocks the
-- download for that member for 7 days. "Member's Right to Inspect" is renamed
-- "Right to Inspect" (definition options and saved documents).
-- Document names must match packages/shared/src/mandatory-documents.json and
-- inspection-records.json.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';

-- One reference list of downloadable community documents.
CREATE TABLE IF NOT EXISTS public.bfe_community_documents (
 name text PRIMARY KEY,
 category text NOT NULL CHECK(category IN ('Mandatory Documents','Right to Inspect')),
 file text NOT NULL UNIQUE
);
ALTER TABLE public.bfe_community_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_community_documents FROM PUBLIC,anon,authenticated;
INSERT INTO public.bfe_community_documents(name,category,file) VALUES
 ('Annual Financial Statements (AFS)','Mandatory Documents','annual-financial-statements.pdf'),
 ('Notice of Elections & Election Guidelines','Mandatory Documents','notice-of-elections-and-guidelines.pdf'),
 ('Master List of Qualified Voters','Mandatory Documents','master-list-of-qualified-voters.pdf'),
 ('Official Election Results / Tally','Mandatory Documents','official-election-results.pdf'),
 ('Notice of General Assembly / Special Meetings','Mandatory Documents','notice-of-general-assembly.pdf'),
 ('Proposed Amendments to Articles or By-Laws','Mandatory Documents','proposed-amendments-articles-by-laws.pdf'),
 ('New House Rules, Traffic/Parking Rules & Fee/Fine Schedules','Mandatory Documents','house-rules-traffic-parking-fees.pdf'),
 ('Articles of Incorporation and By-Laws (including all approved amendments)','Right to Inspect','articles-of-incorporation-and-by-laws.pdf'),
 ('DHSUD Certificate of Registration and General Information Sheets (GIS)','Right to Inspect','dhsud-registration-and-gis.pdf'),
 ('Minutes Book: Complete minutes of all General Assembly meetings and Board of Directors / Executive Officer meetings','Right to Inspect','minutes-book.pdf'),
 ('Compilation of Board Resolutions (including policies, authorizations, and administrative issuances)','Right to Inspect','board-resolutions.pdf'),
 ('Deed of Restrictions, subdivision plans, and turnover documents from the developer','Right to Inspect','deed-of-restrictions-and-turnover.pdf'),
 ('Membership Book / Updated Master List of Members (indicating owners and authorized lessees/occupants)','Right to Inspect','membership-book.pdf'),
 ('Election Reports: Attendance sheets, notarized minutes of elections, and certified election returns/tally sheets','Right to Inspect','election-reports.pdf'),
 ('Audited Annual Financial Statements (AFS) and Annual Reports (which must also be provided upon request)','Right to Inspect','audited-financial-statements-and-annual-reports.pdf'),
 ('Books of Accounts: Cash Receipts Book, Cash Disbursements Book, General Journal, and General Ledger','Right to Inspect','books-of-accounts.pdf'),
 ('Supporting Financial Vouchers: Official receipts, disbursement vouchers, supplier invoices, bank statements, check stubs, and approved contracts with service providers (e.g., security, maintenance, construction)','Right to Inspect','supporting-financial-vouchers.pdf')
ON CONFLICT(name) DO UPDATE SET category=EXCLUDED.category,file=EXCLUDED.file;

-- Downloads now reference the list instead of a fixed CHECK of seven names.
DO $$
DECLARE c record;
BEGIN
 FOR c IN SELECT conname FROM pg_constraint
  WHERE conrelid='public.bfe_document_downloads'::regclass AND contype='c'
   AND pg_get_constraintdef(oid) ILIKE '%Annual Financial Statements%'
 LOOP
  EXECUTE format('ALTER TABLE public.bfe_document_downloads DROP CONSTRAINT %I',c.conname);
 END LOOP;
END $$;
ALTER TABLE public.bfe_document_downloads DROP CONSTRAINT IF EXISTS bfe_document_downloads_document_ref;
ALTER TABLE public.bfe_document_downloads ADD CONSTRAINT bfe_document_downloads_document_ref
 FOREIGN KEY(document) REFERENCES public.bfe_community_documents(name);

CREATE TABLE IF NOT EXISTS public.bfe_document_download_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 document text NOT NULL REFERENCES public.bfe_community_documents(name),
 status text NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Declined')),
 requested_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,
 decided_by uuid REFERENCES auth.users(id),
 note text NOT NULL DEFAULT '' CHECK(char_length(note)<=500),
 expires_at timestamptz,
 CHECK((status='Pending')=(decided_at IS NULL)),
 CHECK((status='Approved')=(expires_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS bfe_document_download_requests_one_pending
 ON public.bfe_document_download_requests(user_id,document) WHERE status='Pending';
CREATE INDEX IF NOT EXISTS bfe_document_download_requests_queue
 ON public.bfe_document_download_requests(status,requested_at DESC,id);
ALTER TABLE public.bfe_document_download_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_document_download_requests FROM PUBLIC,anon,authenticated;

-- Members' decision notifications open Community documents.
ALTER TABLE public.bfe_notifications DROP CONSTRAINT IF EXISTS bfe_notifications_path_check;
ALTER TABLE public.bfe_notifications ADD CONSTRAINT bfe_notifications_path_check
 CHECK(path IN ('/services/requests','/office/requests','/more/profile',
 '/developer/access','/more/notifications','/more/transport','/driver/dispatch','/account',
 '/office/documents','/more/documents'));

-- Rename the category in the definition and in saved documents.
UPDATE public.bfe_feature_definitions d
SET fields=(
  SELECT jsonb_agg(
    CASE WHEN f->>'key'='category'
      THEN jsonb_set(f,'{options}','["Mandatory Documents","Right to Inspect"]'::jsonb)
      ELSE f END
    ORDER BY i)
  FROM jsonb_array_elements(d.fields) WITH ORDINALITY AS t(f,i))
WHERE d.code='board-records';
UPDATE public.bfe_feature_records
SET fields=jsonb_set(fields,'{category}','"Right to Inspect"'::jsonb)
WHERE module='board-records' AND fields->>'category'='Member''s Right to Inspect';

-- "Name (unit)" for notification text.
CREATE OR REPLACE FUNCTION public.bfe_member_label(p_user uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT coalesce(nullif(btrim(m.name),''),'A member')||coalesce(' ('||nullif(btrim(m.unit),'')||')','')
  FROM public.members m WHERE m.user_id=p_user LIMIT 1),'A member');
$$;
REVOKE ALL ON FUNCTION public.bfe_member_label(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.bfe_notify_admins(p_title text,p_body text,p_event text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 SELECT DISTINCT a.user_id,'community',p_title,left(p_body,1000),'/office/documents',p_event
 FROM public.members a
 WHERE a.user_id IS NOT NULL AND a.user_id IS DISTINCT FROM auth.uid() AND a.status='Active'
  AND ('admin'=a.role OR 'admin'=ANY(coalesce(a.extra_roles,ARRAY[]::text[])))
  AND (SELECT count(*) FROM public.members d WHERE d.user_id=a.user_id)=1
 ON CONFLICT(recipient_id,event_key) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.bfe_notify_admins(text,text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.bfe_request_document_download(p_document text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_document_download_requests;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 THEN
  RAISE EXCEPTION 'Sign in as an active member to request documents.' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bfe_community_documents WHERE name=p_document) THEN
  RAISE EXCEPTION 'Choose a listed community document.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('document-request:'||auth.uid()::text,0));
 SELECT * INTO r FROM public.bfe_document_download_requests
 WHERE user_id=auth.uid() AND document=p_document
  AND (status='Pending' OR (status='Approved' AND expires_at>now()))
 ORDER BY requested_at DESC LIMIT 1;
 IF FOUND THEN
  RETURN jsonb_build_object('id',r.id,'status',r.status,'expires_at',r.expires_at);
 END IF;
 IF (SELECT count(*) FROM public.bfe_document_download_requests WHERE user_id=auth.uid() AND requested_at>now()-interval '1 hour')>=20 THEN
  RAISE EXCEPTION 'Please wait before requesting more documents.'; END IF;
 INSERT INTO public.bfe_document_download_requests(user_id,document) VALUES(auth.uid(),p_document) RETURNING * INTO r;
 PERFORM public.bfe_notify_admins('Download request',
  public.bfe_member_label(auth.uid())||' asked to download '||p_document||'. Review it on the office documents page.',
  'document-request:'||r.id::text);
 RETURN jsonb_build_object('id',r.id,'status',r.status,'expires_at',r.expires_at);
END;$$;

-- The caller's latest request per document, for status and Download buttons.
CREATE OR REPLACE FUNCTION public.bfe_my_document_access() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 THEN
  RAISE EXCEPTION 'Sign in as an active member.' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('document',x.document,'status',
   CASE WHEN x.status='Approved' AND x.expires_at<=now() THEN 'Expired' ELSE x.status END,
   'expires_at',x.expires_at,'requested_at',x.requested_at,'note',x.note))
  FROM (SELECT DISTINCT ON (document) * FROM public.bfe_document_download_requests
   WHERE user_id=auth.uid() ORDER BY document,requested_at DESC) x),'[]'::jsonb);
END;$$;

CREATE OR REPLACE FUNCTION public.bfe_decide_document_download(p_id uuid,p_decision text,p_note text DEFAULT '') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_document_download_requests; v_until timestamptz;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.bfe_current_roles() && ARRAY['admin','developer']::text[]) THEN
  RAISE EXCEPTION 'Only admins can decide download requests.' USING ERRCODE='42501'; END IF;
 IF p_decision IS NULL OR p_decision NOT IN ('Approved','Declined') OR p_note IS NULL OR char_length(btrim(p_note))>500 THEN
  RAISE EXCEPTION 'Choose Approved or Declined, with an optional short note.' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM public.bfe_document_download_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request not found.' USING ERRCODE='22023'; END IF;
 IF r.status<>'Pending' THEN RAISE EXCEPTION 'This request was already decided.' USING ERRCODE='40001'; END IF;
 v_until:=CASE WHEN p_decision='Approved' THEN now()+interval '7 days' END;
 UPDATE public.bfe_document_download_requests
 SET status=p_decision,decided_at=now(),decided_by=auth.uid(),note=btrim(p_note),expires_at=v_until
 WHERE id=p_id;
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 VALUES(r.user_id,'community',
  CASE WHEN p_decision='Approved' THEN 'Download request approved' ELSE 'Download request declined' END,
  left(CASE WHEN p_decision='Approved'
   THEN 'You can download '||r.document||' until '||to_char(v_until AT TIME ZONE 'Asia/Manila','FMDD Mon YYYY')||'.'
   ELSE 'The HOA office declined your request to download '||r.document||'.' END
   ||coalesce(' Note: '||nullif(btrim(p_note),''),''),1000),
  '/more/documents','document-decision:'||r.id::text)
 ON CONFLICT(recipient_id,event_key) DO NOTHING;
END;$$;

CREATE OR REPLACE FUNCTION public.bfe_document_download_requests_queue(p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE rows jsonb; n bigint; pending bigint;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.bfe_current_roles() && ARRAY['admin','developer']::text[]) THEN
  RAISE EXCEPTION 'Download requests are available to admins.' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Invalid page.' USING ERRCODE='22023'; END IF;
 SELECT count(*),count(*) FILTER(WHERE status='Pending') INTO n,pending FROM public.bfe_document_download_requests;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'document',x.document,'status',x.status,'requested_at',x.requested_at,
   'decided_at',x.decided_at,'expires_at',x.expires_at,'note',x.note,'name',x.name,'unit',x.unit)
   ORDER BY (x.status='Pending') DESC,x.requested_at DESC,x.id),'[]'::jsonb) INTO rows
 FROM (
  SELECT q.*,
   coalesce((SELECT nullif(btrim(m.name),'') FROM public.members m WHERE m.user_id=q.user_id LIMIT 1),'Unknown member') AS name,
   (SELECT nullif(btrim(m.unit),'') FROM public.members m WHERE m.user_id=q.user_id LIMIT 1) AS unit
  FROM public.bfe_document_download_requests q
  ORDER BY (q.status='Pending') DESC,q.requested_at DESC,q.id OFFSET p_page*20 LIMIT 20
 ) x;
 RETURN jsonb_build_object('rows',rows,'total',n,'pending',pending);
END;$$;

-- Downloads now need an approved, unexpired request (admins and developers exempt).
CREATE OR REPLACE FUNCTION public.bfe_record_document_download(p_document text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rid uuid;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 THEN
  RAISE EXCEPTION 'Sign in as an active member to download documents.' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.bfe_community_documents WHERE name=p_document) THEN
  RAISE EXCEPTION 'Choose a listed community document.' USING ERRCODE='22023'; END IF;
 IF NOT (public.bfe_current_roles() && ARRAY['admin','developer']::text[])
  AND NOT EXISTS(SELECT 1 FROM public.bfe_document_download_requests
   WHERE user_id=auth.uid() AND document=p_document AND status='Approved' AND expires_at>now()) THEN
  RAISE EXCEPTION 'Request this document from the HOA office before downloading it.' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM public.bfe_document_downloads WHERE user_id=auth.uid() AND downloaded_at>now()-interval '1 minute')>=10 THEN
  RAISE EXCEPTION 'Please wait a moment before downloading more documents.'; END IF;
 INSERT INTO public.bfe_document_downloads(user_id,document) VALUES(auth.uid(),p_document) RETURNING id INTO rid;
 PERFORM public.bfe_notify_admins('Document downloaded',
  public.bfe_member_label(auth.uid())||' downloaded '||p_document||'.',
  'document-download:'||rid::text);
 RETURN rid;
END;$$;

REVOKE ALL ON FUNCTION public.bfe_request_document_download(text),public.bfe_my_document_access(),
 public.bfe_decide_document_download(uuid,text,text),public.bfe_document_download_requests_queue(integer),
 public.bfe_record_document_download(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_request_document_download(text),public.bfe_my_document_access(),
 public.bfe_decide_document_download(uuid,text,text),public.bfe_document_download_requests_queue(integer),
 public.bfe_record_document_download(text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
