-- Owner-run after 097. Owner request, 25 November 2026: renters should see
-- carpools too, not only homeowners.
--  * New carpools published on submission (096) go to homeowners and renters.
--  * Other active homeowners and renters are notified of a new carpool.
--  * Carpools already published by 096 on submission or by the one-time 097
--    update, still current and still homeowner-only, are widened to homeowners
--    and renters. Carpools the office published with its own audience choice
--    are left unchanged. No notifications are sent for these.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';

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
   NEW.audiences:=ARRAY['homeowner','renter'];
   NEW.expires_at:=v_until;
  END IF;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_carpool_auto_publish() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.bfe_carpool_notify_homeowners() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note)
 VALUES(NEW.id,NEW.owner_id,'Published','Published automatically to homeowners and renters on submission');
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key)
 SELECT DISTINCT m.user_id,'community',
  CASE WHEN NEW.fields->>'kind'='Looking for a ride' THEN 'Someone is looking for a ride' ELSE 'New carpool available' END,
  left(NEW.title||'. Open Carpool to see the details.',1000),
  '/directory/transport','carpool:'||NEW.id::text
 FROM public.members m
 WHERE m.user_id IS NOT NULL AND m.user_id<>NEW.owner_id AND m.status='Active'
  AND public.bfe_roles_for(m.user_id) && ARRAY['homeowner','renter']::text[]
 ON CONFLICT(recipient_id,event_key) DO NOTHING;
 RETURN NULL;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_carpool_notify_homeowners() FROM PUBLIC,anon,authenticated;

-- Widen current carpools published by 096 or 097 (identified by their audit notes).
WITH widened AS (
 UPDATE public.bfe_feature_records r
 SET audiences=ARRAY['homeowner','renter'],version=r.version+1,updated_at=now()
 WHERE r.module='carpools' AND r.status='Published' AND r.expires_at>now()
  AND r.audience='homeowner' AND coalesce(r.audiences,ARRAY['homeowner'])=ARRAY['homeowner']
  AND EXISTS(SELECT 1 FROM public.bfe_feature_audit a WHERE a.record_id=r.id AND a.action='Published'
   AND a.note IN ('Published automatically to homeowners on submission',
    'Published to homeowners by the one-time carpool update (owner request)'))
 RETURNING r.id,r.owner_id
)
INSERT INTO public.bfe_feature_audit(record_id,actor_id,action,note)
SELECT id,owner_id,'Audience selected','Published audiences: homeowner, renter (owner request: renters see carpools)'
FROM widened;

NOTIFY pgrst,'reload schema';
COMMIT;
