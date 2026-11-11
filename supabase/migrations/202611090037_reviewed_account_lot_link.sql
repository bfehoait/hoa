-- Apply after 036. Adds explicit staff review for existing account/lot links.
-- No links, ownership corrections, receipts or receipt entitlements are seeded.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.bfe_account_lot_match(p_target uuid,p_physical text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.members; l public.bfe_lots; parts text[]; physical text; normalized text; links jsonb;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0
 OR NOT public.bfe_can('people','view','association')
 OR NOT public.bfe_can('property','view','association')
 OR NOT public.bfe_can('property','manage','association') THEN
  RAISE EXCEPTION 'Account and property review permissions required.' USING ERRCODE='42501'; END IF;
 IF p_target IS NULL OR p_physical IS NULL OR length(p_physical)>40 THEN RAISE EXCEPTION 'Check the account and lot reference.' USING ERRCODE='22023'; END IF;
 SELECT * INTO m FROM public.members WHERE user_id=p_target;
 IF m.user_id IS NULL OR cardinality(public.bfe_roles_for(p_target))=0 THEN RAISE EXCEPTION 'Active account required.' USING ERRCODE='22023'; END IF;
 physical:=nullif(btrim(p_physical),'');
 IF physical IS NOT NULL AND physical !~ '^[1-9][0-9]*-[0-9]{2}-[0-9]{3}$' THEN RAISE EXCEPTION 'Use a physical lot ID such as 1-01-001.' USING ERRCODE='22023'; END IF;
 IF physical IS NULL THEN
  IF btrim(coalesce(m.unit,'')) ~ '^[1-9][0-9]*-[0-9]{2}-[0-9]{3}$' THEN physical:=btrim(m.unit);
  ELSE
   normalized:=regexp_replace(upper(btrim(coalesce(m.unit,''))),'[[:space:]_-]+','','g');
   parts:=regexp_match(normalized,'^(?:PHASE|PH|P)([1-9][0-9]*)B(?:LOCK)?([1-9][0-9]*)L(?:OT)?([1-9][0-9]*)$');
   -- Never truncate a too-long block or lot into a different valid address.
   IF parts IS NOT NULL AND length(parts[1])<=10 AND length(parts[2])<=2 AND length(parts[3])<=3 THEN
    physical:=parts[1]||'-'||lpad(parts[2],2,'0')||'-'||lpad(parts[3],3,'0');
   END IF;
  END IF;
 END IF;
 SELECT f.* INTO l FROM public.bfe_lots f JOIN public.bfe_import_batches b ON b.id=f.batch_id AND b.status='active' WHERE f.physical_id=physical;
 SELECT coalesce(jsonb_agg(jsonb_build_object('relationship',relationship,'state',state) ORDER BY relationship),'[]') INTO links
 FROM public.bfe_lot_memberships WHERE user_id=p_target AND lot_id=l.id AND state IN ('pending','approved');
 RETURN jsonb_build_object(
  'expected',jsonb_build_object('user_id',m.user_id,'name',m.name,'unit',m.unit,'role',m.role,'extra_roles',m.extra_roles,'status',m.status),
  'physical_id',physical,'can_link',p_target<>auth.uid(),
  'candidate',CASE WHEN l.id IS NULL THEN NULL ELSE jsonb_build_object('id',l.id,'physical_id',l.physical_id,'recorded_homeowner',coalesce(l.corrected_homeowner,l.recorded_homeowner),'version',l.version) END,
  'relationships',links);
END;$$;
CREATE FUNCTION public.bfe_link_account_lot(p_target uuid,p_lot uuid,p_expected jsonb,p_version integer,p_relationship text,p_reference text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE m public.members; l public.bfe_lots; link public.bfe_lot_memberships; options jsonb; snapshot jsonb;
BEGIN
 -- This authorized read repeats the full permission/active-account checks.
 options:=public.bfe_account_lot_match(p_target,'');
 IF p_target=auth.uid() THEN RAISE EXCEPTION 'An independent approver is required.' USING ERRCODE='42501'; END IF;
 IF p_relationship IS NULL OR p_relationship NOT IN ('owner','renter','household') OR p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Verify the relationship and enter a review reference.' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('account-lot-link:'||p_target::text,0));
 SELECT * INTO m FROM public.members WHERE user_id=p_target FOR UPDATE;
 snapshot:=jsonb_build_object('user_id',m.user_id,'name',m.name,'unit',m.unit,'role',m.role,'extra_roles',m.extra_roles,'status',m.status);
 IF snapshot IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Account changed. Reopen the link review.' USING ERRCODE='40001'; END IF;
 SELECT f.* INTO l FROM public.bfe_lots f JOIN public.bfe_import_batches b ON b.id=f.batch_id AND b.status='active' WHERE f.id=p_lot FOR UPDATE OF f;
 IF l.id IS NULL OR p_version IS NULL OR l.version<>p_version THEN RAISE EXCEPTION 'Lot changed or unavailable. Reopen the link review.' USING ERRCODE='40001'; END IF;
 SELECT * INTO link FROM public.bfe_lot_memberships WHERE user_id=p_target AND lot_id=p_lot AND relationship=p_relationship AND state IN ('pending','approved') FOR UPDATE;
 IF link.state='approved' THEN
  IF link.starts_at>now() OR link.expires_at<=now() THEN RAISE EXCEPTION 'Existing relationship needs review in the lot register.' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('membership_id',link.id,'already_linked',true);
 END IF;
 IF link.id IS NULL THEN
  INSERT INTO public.bfe_lot_memberships(lot_id,user_id,relationship) VALUES(p_lot,p_target,p_relationship) RETURNING * INTO link;
  INSERT INTO public.bfe_registry_audit(lot_id,actor_id,action,details)
  VALUES(p_lot,auth.uid(),'Staff account link requested',jsonb_build_object('membership',link.id,'reference',btrim(p_reference)));
 END IF;
 -- Reuse the established independent review and audit path. Receipt access
 -- remains a separate bfe_entitle_receipt review; no automatic entitlement.
 PERFORM public.bfe_review_lot_membership(link.id,'approved',btrim(p_reference),NULL);
 RETURN jsonb_build_object('membership_id',link.id,'already_linked',false);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_account_lot_match(uuid,text),public.bfe_link_account_lot(uuid,uuid,jsonb,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_account_lot_match(uuid,text),public.bfe_link_account_lot(uuid,uuid,jsonb,integer,text,text) TO authenticated;

-- Formatting normalization only. No fuzzy/substring name matching.
CREATE FUNCTION public.bfe_owner_name_key(p_name text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE name text:=upper(btrim(coalesce(p_name,''))); parts text[];
BEGIN
 parts:=string_to_array(name,',');
 IF cardinality(parts)=2 AND btrim(parts[1])<>'' AND btrim(parts[2])<>'' THEN name:=parts[2]||' '||parts[1]; END IF;
 RETURN regexp_replace(name,'[^[:alnum:]]','','g');
END;$$;
REVOKE ALL ON FUNCTION public.bfe_owner_name_key(text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bfe_workbook_account_matches(p_targets uuid[],p_checksum text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE target uuid; m public.members; l public.bfe_lots; options jsonb; rows jsonb:='[]'; tag text; ready integer:=0; bid uuid;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0
 OR NOT public.bfe_can('people','view','association') OR NOT public.bfe_can('property','view','association') OR NOT public.bfe_can('property','manage','association') THEN RAISE EXCEPTION 'Account and property review permissions required.' USING ERRCODE='42501'; END IF;
 IF p_targets IS NULL OR cardinality(p_targets) NOT BETWEEN 1 AND 20 OR array_position(p_targets,NULL) IS NOT NULL OR cardinality(p_targets)<>(SELECT count(DISTINCT x) FROM unnest(p_targets)x)
 OR p_checksum IS NULL OR p_checksum !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Select up to twenty distinct accounts and an assessed workbook.' USING ERRCODE='22023'; END IF;
 SELECT id INTO bid FROM public.bfe_import_batches WHERE checksum=p_checksum AND status='active';
 IF bid IS NULL THEN RETURN jsonb_build_object('workbook_installed',false,'rows','[]'::jsonb,'ready',0); END IF;
 FOREACH target IN ARRAY p_targets LOOP
  options:=NULL; tag:='needs_review';
  SELECT * INTO m FROM public.members WHERE user_id=target;
  IF m.user_id IS NULL OR cardinality(public.bfe_roles_for(target))=0 THEN tag:='inactive';
  ELSE
   options:=public.bfe_account_lot_match(target,'');
   IF target=auth.uid() THEN tag:='self_review_required';
   ELSIF NOT ('homeowner'=ANY(public.bfe_roles_for(target))) THEN tag:='not_homeowner';
   ELSIF nullif(public.bfe_owner_name_key(m.name),'') IS NULL THEN tag:='missing_name';
   ELSIF (SELECT count(*) FROM public.members n WHERE n.status='Active' AND public.bfe_owner_name_key(n.name)=public.bfe_owner_name_key(m.name))>1 THEN tag:='duplicate_name';
   ELSIF options->>'physical_id' IS NULL THEN tag:='unrecognized_address';
   ELSIF options->'candidate'='null'::jsonb THEN tag:='no_matching_lot';
   ELSE
    SELECT * INTO l FROM public.bfe_lots WHERE id=(options->'candidate'->>'id')::uuid;
    IF l.batch_id<>bid THEN tag:='different_workbook';
    ELSIF nullif(btrim(l.corrected_homeowner),'') IS NOT NULL AND public.bfe_owner_name_key(l.corrected_homeowner)<>public.bfe_owner_name_key(l.recorded_homeowner) THEN tag:='owner_record_corrected';
    ELSIF public.bfe_owner_name_key(l.recorded_homeowner)<>public.bfe_owner_name_key(m.name) THEN tag:='name_mismatch';
    ELSIF EXISTS(SELECT 1 FROM public.bfe_lot_memberships WHERE user_id=target AND lot_id=l.id AND relationship='owner' AND state='approved' AND (starts_at>now() OR expires_at<=now())) THEN tag:='existing_link_needs_review';
    ELSE tag:='exact_match'; ready:=ready+1;
    END IF;
   END IF;
  END IF;
  rows:=rows||jsonb_build_array(jsonb_build_object('target_id',target,'name',m.name,'unit',m.unit,'status',tag,'match',options));
 END LOOP;
 RETURN jsonb_build_object('workbook_installed',true,'rows',rows,'ready',ready);
END;$$;
CREATE FUNCTION public.bfe_link_workbook_accounts(p_targets uuid[],p_checksum text,p_expected jsonb,p_reference text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE report jsonb; item jsonb; result jsonb; linked integer:=0; existing integer:=0;
BEGIN
 IF p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 100 THEN RAISE EXCEPTION 'Enter a verification reference of 3 to 100 characters.' USING ERRCODE='22023'; END IF;
 report:=public.bfe_workbook_account_matches(p_targets,p_checksum);
 IF report IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Matches changed. Run the workbook check again.' USING ERRCODE='40001'; END IF;
 IF coalesce((report->>'ready')::integer,0)=0 THEN RAISE EXCEPTION 'No exact matches are ready to link.' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(report->'rows') WHERE value->>'status'='exact_match' ORDER BY value->>'target_id' LOOP
  result:=public.bfe_link_account_lot((item->>'target_id')::uuid,(item->'match'->'candidate'->>'id')::uuid,item->'match'->'expected',(item->'match'->'candidate'->>'version')::integer,'owner',btrim(p_reference)||' / workbook '||p_checksum);
  IF (result->>'already_linked')::boolean THEN existing:=existing+1; ELSE linked:=linked+1; END IF;
 END LOOP;
 RETURN jsonb_build_object('linked',linked,'already_linked',existing);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_workbook_account_matches(uuid[],text),public.bfe_link_workbook_accounts(uuid[],text,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_workbook_account_matches(uuid[],text),public.bfe_link_workbook_accounts(uuid[],text,jsonb,text) TO authenticated;

NOTIFY pgrst,'reload schema'; COMMIT;
