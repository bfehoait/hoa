-- Apply after 079. Read-only counts for existing authorized work queues.
-- No approval, role, tab, receipt, record, or accounting state is changed.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE FUNCTION public.bfe_navigation_action_badges() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE roles text[]:=public.bfe_current_roles(); result jsonb:='{}'::jsonb;
 queue_data jsonb; transport_data jsonb; gate_count bigint; driver_count bigint; driver_available boolean;
BEGIN
 IF auth.uid() IS NULL OR coalesce(cardinality(roles),0)=0 THEN
  RAISE EXCEPTION 'Active account required.' USING ERRCODE='42501';
 END IF;
 -- Reuse the installed Office aggregator and its individual capability flags.
 -- A denied workspace does not suppress counts for another authorized role.
 IF roles && ARRAY['admin','developer']::text[] THEN
  BEGIN
   queue_data:=public.bfe_office_business_review_inbox();
   result:=result||jsonb_build_object('office',queue_data);
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
 END IF;
 -- These are passes ready for a gate check / exit follow-up, not occupancy.
 -- The established reader authorizes association visibility; can_gate is its
 -- existing Security-role + status permission check. Do not grant either here.
 IF 'security'=ANY(roles) THEN
  BEGIN
   queue_data:=public.bfe_community_pass_dashboard(true,0);
   IF coalesce((queue_data->>'can_gate')::boolean,false) THEN
    SELECT count(*) INTO gate_count FROM public.bfe_visitor_passes r
    WHERE r.status='Entered' OR (
     r.status='Approved' AND r.valid_from<=now() AND r.valid_until>now()
     AND coalesce(cardinality(public.bfe_roles_for(r.owner_id)),0)>0
     AND EXISTS (
      SELECT 1 FROM public.bfe_lot_memberships m
      JOIN public.bfe_lots l ON l.id=m.lot_id
      JOIN public.bfe_import_batches b ON b.id=l.batch_id AND b.status='active'
      WHERE m.lot_id=r.lot_id AND m.user_id=r.owner_id AND m.state='approved'
       AND m.starts_at<=now() AND (m.expires_at IS NULL OR m.expires_at>now())
     )
    );
    result:=result||jsonb_build_object('gate_checks',gate_count);
   END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
 END IF;
 -- Use the authorized dispatch reader's total, never a paginated row count.
 IF public.bfe_shuttle_driver() OR public.bfe_shuttle_reviewer() THEN
  BEGIN
   transport_data:=public.bfe_shuttle_journey_dashboard(false,0,'');
   IF public.bfe_shuttle_reviewer() THEN
    result:=result||jsonb_build_object('shuttle_review',transport_data->'total');
   END IF;
   IF public.bfe_shuttle_driver() THEN
    driver_available:=public.bfe_shuttle_available(auth.uid())
     AND EXISTS(SELECT 1 FROM public.bfe_shuttles s WHERE s.active AND s.driver_id=auth.uid() AND s.ready)
     AND NOT EXISTS(SELECT 1 FROM public.bfe_shuttle_requests busy WHERE busy.driver_id=auth.uid()
      AND (busy.status='Arrived' OR (busy.status IN ('Accepted','On the way') AND busy.expires_at>now())));
    SELECT count(*) INTO driver_count FROM public.bfe_shuttle_requests r
    WHERE (r.driver_id=auth.uid() AND (
     r.status='Arrived' OR (r.status IN ('Accepted','On the way') AND r.expires_at>now())
    )) OR (
     driver_available AND r.status='Waiting for Shuttle'
     AND r.driver_id IS NULL
     AND EXISTS(SELECT 1 FROM public.bfe_shuttles s WHERE s.active AND s.driver_id=auth.uid() AND s.ready AND s.capacity>=r.passengers)
     AND r.expires_at>now()
     AND (r.created_at AT TIME ZONE 'Asia/Manila')::date=(now() AT TIME ZONE 'Asia/Manila')::date
    );
    result:=result||jsonb_build_object('driver_actions',driver_count);
   END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
 END IF;
 RETURN result||jsonb_build_object('as_of',now());
END;$$;
REVOKE ALL ON FUNCTION public.bfe_navigation_action_badges() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bfe_navigation_action_badges() TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
