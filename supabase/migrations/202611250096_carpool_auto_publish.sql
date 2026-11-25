-- Owner-run after 095. Owner request, 25 November 2026: a carpool a homeowner
-- submits is published straight away (no office review) and every other
-- homeowner is notified that it is available.
--  * Applies to new carpool submissions that give publication consent and have
--    a departure date from today up to one year ahead. Anything else stays
--    Submitted for the office, as before.
--  * Published to homeowners, using the submitted title and description as the
--    public text. Private fields (pickup, destination, contact email, etc.)
--    stay restricted, as with office-published carpools.
--  * Expires at the end of the departure date (Asia/Manila).
--  * Other active homeowners get a bell notification that opens Carpool. The
--    office can still withdraw a published carpool.
-- bfe_submit_feature is unchanged; two triggers do the work.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';

-- Members' carpool notifications open the Carpool page.
ALTER TABLE public.bfe_notifications DROP CONSTRAINT IF EXISTS bfe_notifications_path_check;
ALTER TABLE public.bfe_notifications ADD CONSTRAINT bfe_notifications_path_check
 CHECK(path IN ('/services/requests','/office/requests','/more/profile',
 '/developer/access','/more/notifications','/more/transport','/driver/dispatch','/account',
 '/office/documents','/more/documents','/directory/transport'));

CREATE OR REPLACE FUNCTION public.bfe_carpool_auto_publish() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_until timestamptz;
BEGIN
 IF NEW.module='carpools' AND NEW.status='Submitted' AND NEW.publication_consent
  AND coalesce(NEW.fields->>'date','') ~ '^\d{4}-\d{2}-\d{2}$' THEN
  v_until:=((NEW.fields->>'date')::date+1)::timestamp AT TIME ZONE 'Asia/Manila';
  IF v_until>now() AND v_until<=now()+interval '366 days' THEN
   NEW.status:='Published';
   NEW.public_title:=NEW.title;
   NEW.public_body:=NEW.detail;
   NEW.audience:='homeowner';
   NEW.audiences:=ARRAY['homeowner'];
   NEW.expires_at:=v_until;
  END IF;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_carpool_auto_publish() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS bfe_carpool_auto_publish ON public.bfe_feature_records;
CREATE TRIGGER bfe_carpool_auto_publish BEFORE INSERT ON public.bfe_feature_records
 FOR EACH ROW WHEN (NEW.module='carpools') EXECUTE FUNCTION public.bfe_carpool_auto_publish();

CREATE OR REPLACE FUNCTION public.bfe_carpool_notify_homeowners() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note)
 VALUES(NEW.id,NEW.owner_id,'Published','Published automatically to homeowners on submission');
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 SELECT DISTINCT m.user_id,'community',
  CASE WHEN NEW.fields->>'kind'='Looking for a ride' THEN 'Someone is looking for a ride' ELSE 'New carpool available' END,
  left(NEW.title||'. Open Carpool to see the details.',1000),
  '/directory/transport','carpool:'||NEW.id::text
 FROM public.members m
 WHERE m.user_id IS NOT NULL AND m.user_id<>NEW.owner_id AND m.status='Active'
  AND 'homeowner'=ANY(public.bfe_roles_for(m.user_id))
 ON CONFLICT(recipient_id,event_key) DO NOTHING;
 RETURN NULL;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_carpool_notify_homeowners() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS bfe_carpool_notify_homeowners ON public.bfe_feature_records;
CREATE TRIGGER bfe_carpool_notify_homeowners AFTER INSERT ON public.bfe_feature_records
 FOR EACH ROW WHEN (NEW.module='carpools' AND NEW.status='Published')
 EXECUTE FUNCTION public.bfe_carpool_notify_homeowners();

NOTIFY pgrst,'reload schema';
COMMIT;
