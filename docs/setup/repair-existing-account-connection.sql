-- Owner-run repair AFTER 077. This does not create Auth users, set passwords,
-- change roles/status, approve lots, or repair every email match in bulk.
-- Review the individual's identity AND existing roles before granting login
-- access to this member. Existing admin/driver/etc. roles become effective.

-- STEP 1 (read-only): fill the member record ID and run this SELECT alone.
-- Keep returned Auth UUIDs private; do not copy names/emails into source.
SELECT m.id AS member_id,m.role,m.extra_roles,m.status,
 a.id AS candidate_auth_id,
 a.email_confirmed_at IS NOT NULL AS email_confirmed,
 (SELECT count(*) FROM public.members d WHERE d.user_id=a.id) AS existing_connections,
 (SELECT count(*) FROM auth.users d WHERE lower(btrim(d.email))=lower(btrim(m.email))) AS matching_auth_count
FROM public.members m
JOIN auth.users a ON lower(btrim(a.email))=lower(btrim(m.email))
WHERE m.id::text=''; -- Fill the selected existing member record ID.

-- STEP 2: fill chosen_member, chosen_auth, review_reference and confirmation
-- from the privately reviewed result. Run BEGIN through COMMIT as ONE block.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $repair$
DECLARE
 chosen_member text:='';
 chosen_auth uuid:=NULL;
 review_reference text:='';
 confirmation text:=''; -- Must equal: VERIFIED IDENTITY AND EXISTING ROLES
 m public.members; a auth.users; saved_setting text; affected integer;
BEGIN
 IF chosen_member='' OR chosen_auth IS NULL OR char_length(btrim(review_reference)) NOT BETWEEN 3 AND 200
  OR confirmation<>'VERIFIED IDENTITY AND EXISTING ROLES' THEN
  RAISE EXCEPTION 'Select and independently verify the existing member, Auth account and roles first.';
 END IF;
 -- Serialize against existing manual account operations where possible.
 PERFORM pg_advisory_xact_lock(hashtextextended('bfe-developer-role-changes',0));
 SELECT * INTO STRICT a FROM auth.users WHERE id=chosen_auth FOR UPDATE;
 SELECT * INTO STRICT m FROM public.members WHERE id::text=chosen_member FOR UPDATE;
 IF m.user_id IS NOT NULL OR m.status<>'Active' OR a.email_confirmed_at IS NULL
  OR nullif(btrim(m.email),'') IS NULL
  OR lower(btrim(m.email)) IS DISTINCT FROM lower(btrim(a.email))
  OR EXISTS(SELECT 1 FROM public.members WHERE user_id=chosen_auth)
  OR (SELECT count(*) FROM public.members WHERE lower(btrim(email))=lower(btrim(m.email)))<>1
  OR (SELECT count(*) FROM auth.users WHERE lower(btrim(email))=lower(btrim(a.email)))<>1 THEN
  RAISE EXCEPTION 'The reviewed account is missing, ambiguous, already linked, inactive or has changed. Nothing repaired.';
 END IF;
 saved_setting:=coalesce(current_setting('app.claiming',true),'');
 PERFORM set_config('app.claiming','on',true);
 UPDATE public.members SET user_id=chosen_auth WHERE id=m.id AND user_id IS NULL;
 GET DIAGNOSTICS affected=ROW_COUNT;
 PERFORM set_config('app.claiming',saved_setting,true);
 IF affected<>1 OR NOT EXISTS(SELECT 1 FROM public.members WHERE id=m.id AND user_id=chosen_auth
  AND role IS NOT DISTINCT FROM m.role AND extra_roles IS NOT DISTINCT FROM m.extra_roles AND status=m.status)
  OR cardinality(public.bfe_roles_for(chosen_auth))=0 THEN
  RAISE EXCEPTION 'The member guard did not accept the account connection. Nothing repaired.';
 END IF;
 PERFORM public.bfe_assert_manual_account_connection(chosen_auth);
 INSERT INTO public.bfe_account_connection_repairs(member_id,target_id,review_reference)
 VALUES(chosen_member,chosen_auth,btrim(review_reference));
END;$repair$;
COMMIT;
