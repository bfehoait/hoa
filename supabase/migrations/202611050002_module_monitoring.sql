-- Read-only developer monitoring. Apply after 202611050001_request_workflow.sql.
-- Preserves legacy policies, records and role helpers. No sample rows are added.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE FUNCTION public.bfe_monitor_module(p_section text, p_page integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = '' SET statement_timeout = '5s' AS $$
DECLARE
  payload jsonb; items jsonb; output_rows jsonb; total_count bigint; paged_source boolean := true;
  allowed_fields text[] := ARRAY[
    'id','no','title','name','email','phone','contact','unit','unit_snapshot',
    'phase','block','lot','lotNo','street','owner','occupancy','type','kind',
    'role','extra_roles','status','category','priority','assignee','assignedTo',
    'description','body','note','review_note','period','facility','slot',
    'vehicle','plate','tag','expires','post','shift','date','at','created_at',
    'updated_at','last_seen','added','amount','paid','received','balance',
    'opening','reserve','planned','actual','due','opens','closes','oic','secondary',
    'owner_id','author_id','author_kind','actor_id','actor_role','action',
    'old_status','new_status','source','ref_no','request_id','has_auth_link'
  ];
BEGIN
  IF NOT ('developer' = ANY(public.bfe_current_roles())) THEN
    RAISE EXCEPTION 'An active developer assignment is required.' USING ERRCODE = '42501';
  END IF;
  IF p_page IS NULL OR p_page < 0 OR p_page > 10000 THEN
    RAISE EXCEPTION 'Unsupported monitoring page.' USING ERRCODE = '22023';
  END IF;
  -- Explicit sources, not dynamic SQL or an arbitrary table/key reader.
  CASE p_section
    WHEN 'members' THEN
      SELECT count(*) INTO total_count FROM public.members;
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id',m.id,'name',m.name,'email',m.email,'phone',m.phone,'unit',m.unit,
        'role',m.role,'extra_roles',array_to_string(m.extra_roles,', '),'status',m.status,
        'last_seen',m.last_seen,'has_auth_link',m.user_id IS NOT NULL
      ) ORDER BY m.id), '[]'::jsonb) INTO payload FROM
        (SELECT * FROM public.members ORDER BY id OFFSET p_page * 20 LIMIT 20) m;
    WHEN 'registrations' THEN
      SELECT count(*) INTO total_count FROM public.registrations;
      SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'email',r.email,
        'phone',r.phone,'unit',r.unit,'role',r.role,'status',r.status,
        'created_at',r.created_at,'review_note',r.review_note) ORDER BY r.created_at DESC,r.id), '[]'::jsonb)
      INTO payload FROM (SELECT * FROM public.registrations ORDER BY created_at DESC,id OFFSET p_page * 20 LIMIT 20) r;
    WHEN 'bfe_requests' THEN
      SELECT count(*) INTO total_count FROM public.bfe_requests;
      SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.updated_at DESC,r.id),'[]'::jsonb)
      INTO payload FROM (SELECT * FROM public.bfe_requests ORDER BY updated_at DESC,id OFFSET p_page * 20 LIMIT 20) r;
    WHEN 'bfe_request_messages' THEN
      SELECT count(*) INTO total_count FROM public.bfe_request_messages;
      SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC,r.id),'[]'::jsonb)
      INTO payload FROM (SELECT * FROM public.bfe_request_messages ORDER BY created_at DESC,id OFFSET p_page * 20 LIMIT 20) r;
    WHEN 'bfe_request_audit' THEN
      SELECT count(*) INTO total_count FROM public.bfe_request_audit;
      SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id DESC),'[]'::jsonb)
      INTO payload FROM (SELECT * FROM public.bfe_request_audit ORDER BY id DESC OFFSET p_page * 20 LIMIT 20) r;
    WHEN 'audit_log' THEN
      SELECT count(*) INTO total_count FROM public.audit_log;
      SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'at',r.at,
        'actor_role',r.actor_role,'action',r.action,'source',r.source,'ref_no',r.ref_no)
        ORDER BY r.id DESC),'[]'::jsonb) INTO payload FROM
        (SELECT * FROM public.audit_log ORDER BY id DESC OFFSET p_page * 20 LIMIT 20) r;
    ELSE
      paged_source := false;
      IF p_section IS NULL OR p_section <> ALL(ARRAY[
        'units','household','requests','complaints','concerns','tickets','dues',
        'lotPayments','ledger','expenses','budget','collectionsHistory','reportLog',
        'bookings','events','gatePasses','passes','stickers','incidents','guards',
        'secAdmin','announcements','notifs','hotlines','marketplace','boothEvents',
        'boothApps','rides','carpools','boardDocs','disclosures','rules','election'
      ]::text[]) THEN
        RAISE EXCEPTION 'Unsupported monitoring section.' USING ERRCODE = '22023';
      END IF;
      SELECT value INTO payload FROM public.portal_data WHERE key = p_section;
  END CASE;
  IF payload IS NULL OR jsonb_typeof(payload) = 'null' THEN
    RETURN jsonb_build_object('source',p_section,'present',false,'total',null,'rows','[]'::jsonb);
  END IF;
  -- Ballots, votes, eligibility lists, uploaded proof, images, passwords,
  -- tokens and arbitrary nested JSON never enter this monitoring response.
  IF p_section = 'election' THEN
    allowed_fields := ARRAY['id','title','status','opens','closes'];
  END IF;
  IF jsonb_typeof(payload) NOT IN ('array','object') THEN
    RAISE EXCEPTION 'The saved section has an unsupported format.' USING ERRCODE = '22023';
  END IF;
  items := CASE WHEN jsonb_typeof(payload) = 'array' THEN payload
    WHEN jsonb_typeof(payload) = 'object' THEN jsonb_build_array(payload)
    ELSE '[]'::jsonb END;
  IF NOT paged_source THEN total_count := jsonb_array_length(items); END IF;
  WITH page_rows AS (
    SELECT e.value AS item, e.ordinality AS position
    FROM jsonb_array_elements(items) WITH ORDINALITY e(value,ordinality)
    ORDER BY e.ordinality OFFSET (CASE WHEN paged_source THEN 0 ELSE p_page * 20 END) LIMIT 20
  ), normalized AS (
    SELECT position, (SELECT coalesce(jsonb_object_agg(f.key,
      CASE WHEN jsonb_typeof(f.value)='string' THEN to_jsonb(left(f.value #>> '{}',5000)) ELSE f.value END),'{}'::jsonb)
      FROM jsonb_each(CASE WHEN jsonb_typeof(item)='object' THEN item ELSE '{}'::jsonb END) f
      WHERE f.key = ANY(allowed_fields) AND jsonb_typeof(f.value) IN ('string','number','boolean','null')) AS item
    FROM page_rows
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'reference',left(coalesce(item->>'id',item->>'no',p_section || '-' || position::text),200),
    'label',left(coalesce(nullif(item->>'title',''),nullif(item->>'name',''),nullif(item->>'facility',''),nullif(item->>'action',''),nullif(item->>'unit',''),nullif(item->>'no',''),p_section || ' record'),180),
    'status',left(item->>'status',100),'unit',left(coalesce(item->>'unit',item->>'unit_snapshot'),200),
    'recorded_at',left(coalesce(item->>'updated_at',item->>'created_at',item->>'at',item->>'date'),100),
    'fields',item
  ) ORDER BY position),'[]'::jsonb) INTO output_rows FROM normalized;
  RETURN jsonb_build_object('source',p_section,'present',true,'total',total_count,'rows',output_rows);
END;
$$;
REVOKE ALL ON FUNCTION public.bfe_monitor_module(text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_monitor_module(text,integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
