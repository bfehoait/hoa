-- Read-only metadata/counts after 066/067; no applicant identities returned.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='30s';
SELECT jsonb_build_object(
 'assessment_only',true,
 'registration_canonical_patch_present',coalesce((SELECT position('Choose phase 1-3' IN prosrc)>0 AND position('lpad(' IN prosrc)>0 FROM pg_proc WHERE oid=to_regprocedure('public.bfe_apply_for_membership(jsonb)')),false),
 'pending_registrations',(SELECT count(*) FROM public.registrations WHERE status='Pending'),
 'canonical_pending_registrations',(SELECT count(*) FROM public.registrations WHERE status='Pending' AND unit ~ '^[1-3]-(0[1-9]|1[0-9])-(00[1-9]|0[1-9][0-9]|10[0-9]|11[01])$'),
 'office_directory_present',to_regprocedure('public.bfe_staff_directory(text,integer,text,text,text)') IS NOT NULL,
 'review_inbox_present',to_regprocedure('public.bfe_office_review_inbox()') IS NOT NULL,
 'amenity_guard_present',coalesce((SELECT position('weekday=1' IN prosrc)>0 AND position('NEW.attendees>40' IN prosrc)>0 FROM pg_proc WHERE oid=to_regprocedure('public.bfe_amenity_hours_guard()')),false),
 'amenity_guard_trigger',(SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgrelid='public.bfe_bookings'::regclass AND tgname='bfe_amenity_hours_guard' AND NOT tgisinternal),
 'unrecognized_active_facility_names',(SELECT count(*) FROM public.bfe_facilities WHERE active AND lower(btrim(name)) NOT IN ('clubhouse','function hall','basketball court','open court','swimming pool'))
) AS readiness;
COMMIT;
