-- Apply after 054. Candidate-information photos use the existing private cover
-- service under Documents permissions. No voting/nomination certification added.
-- Preserve installed metadata, Storage policies and server object-owner binding.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $media$
DECLARE signature text; fid oid; body text; definition text; changed text; pattern text;
BEGIN
 pattern:='CASE[[:space:]]+WHEN[[:space:]]+r.module[[:space:]]*=[[:space:]]*''publishing''[[:space:]]+THEN[[:space:]]+''community''[[:space:]]+ELSE[[:space:]]+''livelihood''[[:space:]]+END';
 FOREACH signature IN ARRAY ARRAY['public.bfe_listing_visible(uuid)','public.bfe_prepare_listing_cover(uuid)','public.bfe_remove_listing_cover(uuid)','public.bfe_listing_object_access(text,boolean)','public.bfe_listing_cover_uploaded()','public.bfe_save_listing_links(uuid,jsonb)'] LOOP
  fid:=to_regprocedure(signature);
  SELECT p.prosrc,pg_get_functiondef(p.oid) INTO body,definition FROM pg_proc p WHERE p.oid=fid AND p.prosecdef;
  IF body IS NULL THEN RAISE EXCEPTION 'Install the reviewed private cover service through 032 first.'; END IF;
  IF position('election-candidates' IN body)>0 THEN
   IF position('''documents''' IN body)=0 THEN RAISE EXCEPTION 'Candidate media permission mapping differs. Review before changing.'; END IF;
   CONTINUE;
  END IF;
  IF signature='public.bfe_save_listing_links(uuid,jsonb)' THEN
   IF position('r.module NOT IN (''businesses'',''buy-sell'',''jobs'',''garage-sales'',''workshops'',''booth-events'')' IN body)=0
    OR (SELECT count(*) FROM regexp_matches(body,'public[.]bfe_can\(''livelihood'',''create'',','g'))<>2 THEN
    RAISE EXCEPTION 'Installed listing-link permissions differ from 015. No changes applied.';
   END IF;
   changed:=replace(body,'public.bfe_can(''livelihood'',''create'',','public.bfe_can(CASE WHEN r.module=''election-candidates'' THEN ''documents'' ELSE ''livelihood'' END,''create'',');
  ELSE
   IF NOT (body ~ pattern) THEN RAISE EXCEPTION 'Installed media permissions differ from 030/032. No changes applied.'; END IF;
   changed:=regexp_replace(body,pattern,'CASE WHEN r.module=''publishing'' THEN ''community'' WHEN r.module=''election-candidates'' THEN ''documents'' ELSE ''livelihood'' END','g');
  END IF;
  changed:=replace(changed,'''booth-events''','''booth-events'',''election-candidates''');
  IF signature='public.bfe_listing_cover_uploaded()' AND (position('object_owner' IN body)=0 OR position('bfe_roles_for' IN body)=0) THEN RAISE EXCEPTION 'Install server object-owner validation from 032 before candidate media.'; END IF;
  IF position(body IN definition)=0 THEN RAISE EXCEPTION 'Media function could not be patched safely.'; END IF;
  EXECUTE replace(definition,body,changed);
 END LOOP;
END;$media$;
NOTIFY pgrst,'reload schema'; COMMIT;
