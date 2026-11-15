-- Apply after 078. Owner-authorized role-based, aggregate-only dashboard reads.
-- Board: governance/financial summaries; Security: recorded pass/gate summaries.
-- Developer: existing cross-workspace read access. No raw-record/write grants.
-- Explicit hidden tab rules and scope-matching read/summary deny grants remain effective.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.bfe_workspace_summary_allowed(p_module text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE roles text[]:=public.bfe_current_roles(); scope_name text:=CASE WHEN p_module='transport' THEN 'own' ELSE 'association' END;
BEGIN
 IF auth.uid() IS NULL OR coalesce(cardinality(roles),0)=0 THEN RETURN false; END IF;
 IF p_module NOT IN ('security','finance','transport') OR p_module IS NULL THEN RETURN false; END IF;
 IF 'developer'=ANY(roles) THEN RETURN public.bfe_can(p_module,'view','association'); END IF;
 IF NOT ((p_module='security' AND 'security'=ANY(roles)) OR (p_module='finance' AND 'board'=ANY(roles)) OR (p_module='transport' AND 'driver'=ANY(roles))) THEN RETURN false; END IF;
 IF public.bfe_tab_mode_for(auth.uid(),p_module,scope_name)='hidden' THEN RETURN false; END IF;
 IF EXISTS (
  SELECT 1 FROM public.bfe_access_assignments a JOIN public.bfe_access_grants g ON g.assignment_id=a.id
  WHERE a.user_id=auth.uid() AND a.revoked_at IS NULL AND a.starts_at<=now()
   AND (a.expires_at IS NULL OR a.expires_at>now()) AND g.module=p_module
   AND g.action IN ('view','summary') AND g.scope=scope_name AND g.effect='deny'
 ) THEN RETURN false; END IF;
 RETURN true;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_workspace_summary_allowed(text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.bfe_workspace_metrics(p_workspace text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE day_start timestamptz := (date_trunc('day',now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila');
 today date := (now() AT TIME ZONE 'Asia/Manila')::date;
 year_start text := to_char(now() AT TIME ZONE 'Asia/Manila','YYYY')||'-01-01';
 result jsonb; broad boolean;
BEGIN
 IF auth.uid() IS NULL OR coalesce(cardinality(public.bfe_current_roles()),0)=0 THEN
  RAISE EXCEPTION 'Active account required.' USING ERRCODE='42501'; END IF;
 IF p_workspace='security' THEN
  IF (public.bfe_current_roles() && ARRAY['security','developer']::text[]) IS NOT TRUE OR NOT public.bfe_workspace_summary_allowed('security') THEN
   RAISE EXCEPTION 'Security view permission required.' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object(
   'entered_passes',(SELECT count(*) FROM public.bfe_visitor_passes WHERE status='Entered'),
   'movements_today',(SELECT count(*) FROM public.bfe_visitor_audit WHERE action IN ('Entered','Exited') AND at>=day_start AND at<=now()),
   'entries_by_type',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.label),'[]'::jsonb) FROM (
    SELECT coalesce(p.pass_kind,'visitor') AS label,count(*) AS count
    FROM public.bfe_visitor_audit a JOIN public.bfe_visitor_passes p ON p.id=a.pass_id
    WHERE a.action='Entered' AND a.at>=day_start AND a.at<=now() GROUP BY p.pass_kind
   ) t)
  ) INTO result;
 ELSIF p_workspace='transport' THEN
  broad := coalesce(public.bfe_shuttle_reviewer(),false);
  IF NOT broad AND NOT public.bfe_workspace_summary_allowed('transport') THEN
   RAISE EXCEPTION 'Driver or transport review permission required.' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object('association_scope',broad,
   'riders_today',coalesce(sum(r.passengers),0),
   'served_requests',count(*),
   'average_pickup_minutes',round(avg(extract(epoch FROM (r.arrived_at-r.created_at))/60) FILTER(WHERE r.arrived_at>=r.created_at),1),
   'timed_requests',count(*) FILTER(WHERE r.arrived_at>=r.created_at)
  ) INTO result FROM public.bfe_shuttle_requests r
  WHERE r.status='Picked up' AND r.closed_at>=day_start AND r.closed_at<=now()
   AND (broad OR r.driver_id=auth.uid());
 ELSIF p_workspace='board' THEN
  IF (public.bfe_current_roles() && ARRAY['board','developer']::text[]) IS NOT TRUE THEN
   RAISE EXCEPTION 'Board or Developer role required.' USING ERRCODE='42501'; END IF;
  IF NOT public.bfe_workspace_summary_allowed('finance') THEN
   result := jsonb_build_object('finance_available',false);
  ELSE
   WITH invoices AS (
    SELECT i.amount_centavos,least(i.amount_centavos,public.bfe_invoice_allocated(i.id)) AS allocated
    FROM public.bfe_accounting_invoices i JOIN public.bfe_accounting_entries e ON e.id=i.run_id AND e.status='Posted'
    WHERE NOT i.reversed AND i.period>=left(year_start,7) AND i.period<=to_char(today,'YYYY-MM')
   ) SELECT jsonb_build_object('finance_available',true,
    'billed_centavos',coalesce(sum(amount_centavos),0)::text,
    'allocated_centavos',coalesce(sum(allocated),0)::text,
    'allocation_percent',CASE WHEN sum(amount_centavos)>0 THEN round(sum(allocated)*100/sum(amount_centavos),1) ELSE NULL END
   ) INTO result FROM invoices;
   result := result || jsonb_build_object(
    'expense_centavos',(SELECT coalesce(sum(x.amount_centavos),0)::text FROM public.bfe_accounting_expenses x
     JOIN public.bfe_accounting_entries e ON e.id=x.entry_id AND e.status='Posted'
     WHERE e.fields->>'date'>=year_start AND e.fields->>'date'<=today::text),
    'expense_categories',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY (t.amount_centavos)::numeric DESC,t.label),'[]'::jsonb) FROM (
     SELECT coalesce(c.fields->>'category','Unspecified') AS label,sum(x.amount_centavos)::text AS amount_centavos
     FROM public.bfe_accounting_expenses x JOIN public.bfe_accounting_entries e ON e.id=x.entry_id AND e.status='Posted'
     JOIN public.bfe_accounting_entries c ON c.id=x.category_id
     WHERE e.fields->>'date'>=year_start AND e.fields->>'date'<=today::text GROUP BY c.fields->>'category'
    ) t));
  END IF;
 ELSE RAISE EXCEPTION 'Unknown workspace.' USING ERRCODE='22023';
 END IF;
 RETURN result || jsonb_build_object('workspace',p_workspace,'as_of',now(),'timezone','Asia/Manila');
END;$$;
REVOKE ALL ON FUNCTION public.bfe_workspace_metrics(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_workspace_metrics(text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
