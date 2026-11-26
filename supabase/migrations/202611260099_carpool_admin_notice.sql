-- Owner-run after 098. Owner request, 26 November 2026: carpools never need
-- admin approval. A carpool appears for other homeowners (and renters) as soon
-- as it is posted. Admins are notified of every carpool so the office keeps a
-- history of who offered or asked for a ride; the notice is informational
-- only and asks for no decision.
--  * Every active admin (other than the poster) gets a bell notification
--    naming the poster, whether they are offering or looking for a ride, the
--    title and departure date. It opens the office carpool history.
--  * Admins get this notice instead of the resident notice, so an admin who
--    is also a homeowner is not notified twice.
--  * Other homeowners (and renters) are told plainly whether a neighbour is
--    offering or needs a carpool, with the title and departure date.
--  * A carpool can no longer wait for office approval: posting one without
--    publication consent, or with a departure date outside today up to one
--    year ahead, is refused with a message the poster can act on. (Before,
--    such carpools were left Submitted for office review.)
--  * The audit history keeps the 098 "Published automatically ..." entry.
--  * Works with or without 073, like 098.
--  * Carpools already Submitted before this migration are not changed; the
--    office can still review or withdraw them.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';

-- Admin carpool notices open the office carpool history.
ALTER TABLE public.bfe_notifications DROP CONSTRAINT IF EXISTS bfe_notifications_path_check;
ALTER TABLE public.bfe_notifications ADD CONSTRAINT bfe_notifications_path_check
 CHECK(path IN ('/services/requests','/office/requests','/more/profile',
 '/developer/access','/more/notifications','/more/transport','/driver/dispatch','/account',
 '/office/documents','/more/documents','/directory/transport','/office/review/carpools'));

CREATE OR REPLACE FUNCTION public.bfe_carpool_auto_publish() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_until timestamptz;
BEGIN
 IF NEW.module='carpools' AND NEW.status='Submitted' THEN
  IF NOT coalesce(NEW.publication_consent,false) THEN
   RAISE EXCEPTION 'Carpools are shown to your neighbours as soon as you post them. Tick the consent box to post.'
    USING ERRCODE='22023';
  END IF;
  IF coalesce(NEW.fields->>'date','') ~ '^\d{4}-\d{2}-\d{2}$' THEN
   v_until:=((NEW.fields->>'date')::date+1)::timestamp AT TIME ZONE 'Asia/Manila';
  END IF;
  IF v_until IS NULL OR v_until<=now() OR v_until>now()+interval '366 days' THEN
   RAISE EXCEPTION 'Choose a departure date from today up to one year ahead.'
    USING ERRCODE='22023';
  END IF;
  NEW.status:='Published';
  NEW.public_title:=NEW.title;
  NEW.public_body:=NEW.detail;
  NEW.audience:='homeowner';
  NEW.expires_at:=v_until;
  -- Keys that are not columns are ignored, so this is safe without 073.
  NEW:=jsonb_populate_record(NEW,jsonb_build_object('audiences',ARRAY['homeowner','renter']));
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_carpool_auto_publish() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.bfe_carpool_notify_homeowners() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_roles text[]; v_poster text; v_looking boolean; v_when text;
BEGIN
 -- Renters are notified only where they can see the carpool (073 applied).
 v_roles:=CASE WHEN to_jsonb(NEW) ? 'audiences' THEN ARRAY['homeowner','renter'] ELSE ARRAY['homeowner'] END;
 v_looking:=coalesce(NEW.fields->>'kind','')='Looking for a ride';
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note)
 VALUES(NEW.id,NEW.owner_id,'Published',CASE WHEN cardinality(v_roles)=2
  THEN 'Published automatically to homeowners and renters on submission'
  ELSE 'Published automatically to homeowners on submission' END);

 -- Admins: informational notice for the office history. No decision needed.
 SELECT coalesce(nullif(btrim(m.name),''),'A member')||coalesce(' ('||nullif(btrim(m.unit),'')||')','')
 INTO v_poster FROM public.members m WHERE m.user_id=NEW.owner_id ORDER BY m.id LIMIT 1;
 v_when:=CASE WHEN coalesce(NEW.fields->>'date','') ~ '^\d{4}-\d{2}-\d{2}$'
  THEN ' Departs '||to_char((NEW.fields->>'date')::date,'FMDD Mon YYYY')
   ||coalesce(' at '||nullif(btrim(NEW.fields->>'time'),''),'')||'.' ELSE '' END;
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 SELECT DISTINCT a.user_id,'community',
  CASE WHEN v_looking THEN 'Carpool posted: looking for a ride' ELSE 'Carpool posted: offering a ride' END,
  left(coalesce(v_poster,'A member')||CASE WHEN v_looking THEN ' is looking for a ride: ' ELSE ' is offering a ride: ' END
   ||NEW.title||'.'||v_when||' It is already visible to residents; no approval is needed.',1000),
  '/office/review/carpools','carpool-admin:'||NEW.id::text
 FROM public.members a
 WHERE a.user_id IS NOT NULL AND a.user_id<>NEW.owner_id AND a.status='Active'
  AND 'admin'=ANY(public.bfe_roles_for(a.user_id))
 ON CONFLICT(recipient_id,event_key) DO NOTHING;

 -- Residents (homeowners, and renters where 073 is applied), excluding admins
 -- who already received the office notice above.
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 SELECT DISTINCT m.user_id,'community',
  CASE WHEN v_looking THEN 'A neighbour needs a carpool' ELSE 'A neighbour is offering a carpool' END,
  left(NEW.title||'.'||v_when||' Open Carpool to see the details.',1000),
  '/directory/transport','carpool:'||NEW.id::text
 FROM public.members m
 WHERE m.user_id IS NOT NULL AND m.user_id<>NEW.owner_id AND m.status='Active'
  AND public.bfe_roles_for(m.user_id) && v_roles
  AND NOT ('admin'=ANY(public.bfe_roles_for(m.user_id)))
 ON CONFLICT(recipient_id,event_key) DO NOTHING;
 RETURN NULL;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_carpool_notify_homeowners() FROM PUBLIC,anon,authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
