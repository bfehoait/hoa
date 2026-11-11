-- Apply after 046. Repair the notification destinations introduced by 042/044.
-- Retains the existing notification allowlist and every approval/access rule.
-- Patches only known route expressions; no notifications or decisions are seeded.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $repair$
DECLARE signature text; function_id oid; body text; definition text; changed text; pattern text; event_marker text;
BEGIN
 FOREACH signature IN ARRAY ARRAY[
  'public.bfe_issue_request(uuid,integer,text,date,date,text)',
  'public.bfe_apply_household_request(uuid,integer,uuid,uuid,jsonb,integer,text,text)'
 ] LOOP
  function_id:=to_regprocedure(signature);
  IF function_id IS NULL THEN RAISE EXCEPTION 'Install issuance and household application migrations 042 and 044 first.'; END IF;
  SELECT p.prosrc,pg_get_functiondef(p.oid) INTO body,definition FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=function_id AND p.prosecdef AND l.lanname='plpgsql';
  IF body IS NULL THEN RAISE EXCEPTION 'Fulfillment function metadata differs. Review it before repairing notification routes.'; END IF;
  IF signature LIKE 'public.bfe_issue_request(%' THEN
   pattern:='CASE[[:space:]]+WHEN[[:space:]]+r.module[[:space:]]*=[[:space:]]*''vehicles''[[:space:]]+THEN[[:space:]]+''/more/vehicles''[[:space:]]+ELSE[[:space:]]+''/more/permits''[[:space:]]+END';
   event_marker:='''issuance:''';
  ELSE
   pattern:='''/explore/household-changes''';
   event_marker:='''household-application:''';
  END IF;
  IF position(event_marker IN body)=0 OR position('public.bfe_notifications' IN body)=0 THEN RAISE EXCEPTION 'Fulfillment notification differs from the expected service. No changes applied.'; END IF;
  changed:=regexp_replace(body,pattern,'''/more/notifications''','g');
  IF changed=body THEN
   IF position('''/more/notifications''' IN body)=0 THEN RAISE EXCEPTION 'Expected notification destination was not found. No changes applied.'; END IF;
   CONTINUE;
  END IF;
  IF (SELECT count(*) FROM regexp_matches(body,pattern,'g'))<>1 OR position(body IN definition)=0 THEN RAISE EXCEPTION 'Expected one notification destination. No changes applied.'; END IF;
  EXECUTE replace(definition,body,changed);
 END LOOP;
END;$repair$;
NOTIFY pgrst,'reload schema'; COMMIT;
