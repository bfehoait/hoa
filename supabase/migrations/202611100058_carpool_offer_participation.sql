-- Apply after 057. Ride requests remain publishable information, not seat offers.
-- Only the existing active-offer predicate is narrowed. No map becomes dispatch.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $guard$
DECLARE body text; definition text; changed text;
BEGIN
 SELECT prosrc,pg_get_functiondef(oid) INTO body,definition FROM pg_proc WHERE oid=to_regprocedure('public.bfe_activity_open(uuid)') AND prosecdef AND provolatile='s';
 IF body IS NULL OR position('r.module IN (''booth-events'',''workshops'',''carpools'')' IN body)=0 OR position('r.status=''Published''' IN body)=0 OR position('r.expires_at>now()' IN body)=0 THEN RAISE EXCEPTION 'Review the installed activity availability rule before changing carpool applications.'; END IF;
 IF position('Looking for a ride' IN body)>0 THEN RETURN; END IF;
 changed:=replace(body,'r.status=''Published''','r.status=''Published'' AND NOT (r.module=''carpools'' AND coalesce(r.fields->>''kind'',''Offering a ride'')=''Looking for a ride'')');
 IF changed=body OR position(body IN definition)=0 THEN RAISE EXCEPTION 'Activity availability rule could not be patched safely.'; END IF;
 EXECUTE replace(definition,body,changed);
END;$guard$;
NOTIFY pgrst,'reload schema'; COMMIT;
