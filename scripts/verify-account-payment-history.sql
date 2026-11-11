-- Owner SQL Editor diagnosis for the most recently opened ACTIVE account preview.
-- Open the affected preview immediately before running this script.
-- Returns setup flags, counts and sanitized error codes only, never names,
-- account IDs, receipt details, amounts, tokens or SQL error context.
-- All temporary setup and any preview audit entry are rolled back at the end.
-- No receipts, memberships or receipt entitlements are created/changed.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='8s';
CREATE FUNCTION pg_temp.check_account_payments() RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE v_target uuid; v_actor uuid; v_session uuid; v_result jsonb;
 v_sub text:=current_setting('request.jwt.claim.sub',true);
 v_code text; v_message text; v_direct jsonb; v_gateway jsonb;
BEGIN
 IF to_regclass('public.bfe_member_inspections') IS NULL THEN
  RETURN jsonb_build_object('preview_setup_installed',false);
 END IF;
 SELECT id,target_id,developer_id INTO v_session,v_target,v_actor
 FROM public.bfe_member_inspections
 WHERE ended_at IS NULL AND expires_at>now()
 ORDER BY created_at DESC,id LIMIT 1;
 IF v_target IS NULL THEN
  RETURN jsonb_build_object('active_preview_found',false,'next_step','Open the affected account preview, then rerun.');
 END IF;
 IF to_regprocedure('public.bfe_lot_receipts(uuid,date,date,integer,boolean)') IS NULL THEN
  RETURN jsonb_build_object('active_preview_found',true,'receipt_service_installed',false);
 END IF;
 PERFORM set_config('request.jwt.claim.sub',v_target::text,true);
 BEGIN
  SELECT public.bfe_lot_receipts(NULL,NULL,NULL,0,false) INTO v_result;
  v_direct:=jsonb_build_object('ok',true,'visible_existing_receipts',v_result->'total');
 EXCEPTION WHEN query_canceled THEN
  PERFORM set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
  RETURN jsonb_build_object('active_preview_found',true,'receipt_service_installed',true,
   'direct_receipt_read',jsonb_build_object('ok',false,'code','57014','detail','Receipt read exceeded the short diagnostic limit.'),
   'account_preview_read',jsonb_build_object('skipped',true));
 WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_code=RETURNED_SQLSTATE,v_message=MESSAGE_TEXT;
  v_direct:=jsonb_build_object('ok',false,'code',v_code,'detail',CASE
   WHEN v_message ~ '^column reference "[a-z_][a-z0-9_]*" is ambiguous$' THEN v_message
   WHEN v_message ~ '^column "[a-z_][a-z0-9_]*" does not exist$' THEN v_message
   ELSE 'Error detail withheld; code identifies the failure class.' END);
 END;
 PERFORM set_config('request.jwt.claim.sub',v_actor::text,true);
 BEGIN
  SELECT public.bfe_account_preview_read(v_session,'bfe_lot_receipts',
    '{"p_lot":null,"p_from":null,"p_to":null,"p_page":0,"p_export":false}'::jsonb) INTO v_result;
  v_gateway:=jsonb_build_object('ok',true,'visible_existing_receipts',v_result->'total');
 EXCEPTION WHEN query_canceled THEN
  v_gateway:=jsonb_build_object('ok',false,'code','57014','detail','Preview read exceeded the short diagnostic limit.');
 WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_code=RETURNED_SQLSTATE,v_message=MESSAGE_TEXT;
  v_gateway:=jsonb_build_object('ok',false,'code',v_code,'detail',CASE
   WHEN v_message ~ '^column reference "[a-z_][a-z0-9_]*" is ambiguous$' THEN v_message
   WHEN v_message ~ '^column "[a-z_][a-z0-9_]*" does not exist$' THEN v_message
   ELSE 'Error detail withheld; code identifies the failure class.' END);
 END;
 PERFORM set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
 RETURN jsonb_build_object('active_preview_found',true,'receipt_service_installed',true,
  'direct_receipt_read',v_direct,'account_preview_read',v_gateway);
EXCEPTION WHEN OTHERS THEN
 PERFORM set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
 RAISE;
END;$$;
SELECT pg_temp.check_account_payments() AS account_payment_check;
ROLLBACK;
