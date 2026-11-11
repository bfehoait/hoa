-- Owner-run read-only metadata check after applying 048-059 in order.
-- Returns no identities, contact numbers, paths, financial amounts or content.
-- Function presence does not prove role access or successful browser outcomes.
WITH required(migration,signature) AS (VALUES
 ('048','public.bfe_create_business_request(uuid,text,text,text,jsonb)'),
 ('048','public.bfe_request_business_context(uuid)'),
 ('048','public.bfe_save_request_handling(uuid,integer,integer,text,uuid,text,text)'),
 ('050','public.bfe_request_business_participation(uuid,uuid,integer,text,jsonb)'),
 ('050','public.bfe_business_participation_dashboard(text,boolean,boolean,integer)'),
 ('051','public.bfe_household_roster(uuid,integer)'),
 ('051','public.bfe_save_household_occupant(uuid,uuid,integer,text,text,text,text,boolean,text)'),
 ('052','public.bfe_office_configuration(text)'),
 ('052','public.bfe_published_office_contacts()'),
 ('053','public.bfe_lot_business_details(uuid)'),
 ('053','public.bfe_save_lot_business_details(uuid,integer,jsonb,text)'),
 ('054','public.bfe_save_accounting_draft(uuid,integer,text,jsonb,text)'),
 ('054','public.bfe_decide_accounting_entry(uuid,integer,text,text)'),
 ('054','public.bfe_accounting_dashboard(text,text,integer,text)'),
 ('054','public.bfe_export_accounting_page(text,text,integer,text)'),
 ('054','public.bfe_accounting_entry_detail(uuid,integer)'),
 ('054','public.bfe_office_business_review_inbox()'),
 ('056','public.bfe_create_shuttle_journey(uuid,text,text,integer,text)'),
 ('056','public.bfe_update_shuttle_journey(uuid,integer,integer,text)'),
 ('056','public.bfe_shuttle_journey_dashboard(boolean,integer,text)'),
 ('057','public.bfe_office_create_booking(uuid,text,uuid,uuid,timestamptz,timestamptz,text,integer)'),
 ('057','public.bfe_office_booking_members(text)'),
 ('059','public.bfe_garage_items(uuid,boolean,integer)'),
 ('059','public.bfe_save_garage_item(uuid,uuid,integer,text,text,text,integer,numeric,text)'),
 ('059','public.bfe_decide_garage_item(uuid,integer,text,text)')
), checks AS (
 SELECT r.*,p.oid IS NOT NULL AND p.prosecdef AS installed,
  CASE WHEN p.oid IS NOT NULL THEN has_function_privilege('authenticated',p.oid,'EXECUTE') ELSE false END AS executable
 FROM required r LEFT JOIN pg_proc p ON p.oid=to_regprocedure(r.signature)
), groups AS (
 SELECT migration,count(*) AS required_functions,count(*) FILTER(WHERE installed AND executable) AS ready_functions FROM checks GROUP BY migration
)
SELECT jsonb_build_object(
 'functions',(SELECT jsonb_agg(to_jsonb(g) ORDER BY migration) FROM groups g),
 'missing_functions',(SELECT coalesce(jsonb_agg(signature ORDER BY signature),'[]') FROM checks WHERE NOT(installed AND executable)),
 '049_listing_kind_question',EXISTS(SELECT 1 FROM public.bfe_feature_definitions WHERE code='buy-sell' AND fields @> '[{"key":"listingKind"}]'),
 '055_candidate_media_mapping',EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.bfe_prepare_listing_cover(uuid)') AND position('election-candidates' IN prosrc)>0 AND position('documents' IN prosrc)>0),
 '058_ride_request_not_seat_offer',EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.bfe_activity_open(uuid)') AND position('Looking for a ride' IN prosrc)>0),
 '059_item_inbox_queue',EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('public.bfe_office_business_review_inbox()') AND position('garage_items' IN prosrc)>0)
) AS business_form_readiness;
