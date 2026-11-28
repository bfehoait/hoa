-- Read-only rollout inventory. Run before 099-105; no personal data is returned.
-- A false prerequisite needs investigation; do not rerun older migrations blindly.
SELECT signature AS prerequisite, to_regprocedure(signature) IS NOT NULL AS present
FROM unnest(ARRAY[
 'public.bfe_create_visitor_pass(uuid,uuid,text,text,text,timestamp with time zone,timestamp with time zone)',
 'public.bfe_create_priced_booking(uuid,uuid,timestamp with time zone,timestamp with time zone,text,integer,text,integer,integer,uuid,text)',
 'public.bfe_approve_booking_with_fee(uuid,integer,bigint,bigint,bigint,text)',
 'public.bfe_publication_audience_matches(text,text[],text[])',
 'public.bfe_can_for(uuid,text,text,text)',
 'public.bfe_request_business_context(uuid)',
 'public.bfe_my_notifications(integer,boolean)'
]) signature;

-- These normally read false before this rollout. If any are true, check which
-- files were already installed before choosing where to resume.
SELECT migration, to_regprocedure(signature) IS NOT NULL AS installed_marker
FROM (VALUES
 ('099','public.bfe_security_pass_lots(text)'),
 ('100','public.bfe_booking_checkout_read(uuid)'),
 ('101','public.bfe_excel_carpool_dashboard(text,text,integer,text,text)'),
 ('102','public.bfe_approve_excel_booking(uuid,integer,bigint,bigint,bigint,text,text)'),
 ('103','public.bfe_send_helpdesk_followups()'),
 ('104','public.bfe_move_clearance_queue()'),
 ('105','public.bfe_access_editor(text,text)')
) m(migration,signature);

SELECT id, public AS publicly_readable, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id='bfe-booking-proofs';
-- No row means migration 102 will create the private bucket.
-- Presence checks identify installation markers, not complete migration validity.
