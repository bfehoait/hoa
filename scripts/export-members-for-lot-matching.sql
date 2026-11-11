-- Owner-run read-only export for the authorized offline workbook comparison.
-- Export the result as JSON into .private-imports/members-for-lot-matching.json.
-- Contains private account identity/address data: do not commit, publish,
-- screenshot or paste it into application source. No emails/passwords/tokens.
-- No LIMIT: export all current accounts rather than silently omitting a page.
SELECT user_id,name,unit,role,extra_roles,status
FROM public.members
ORDER BY name NULLS LAST,user_id;
