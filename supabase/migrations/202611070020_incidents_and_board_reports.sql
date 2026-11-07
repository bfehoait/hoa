-- Incident records and board reports.
--
-- Both are record-and-review workflows with the same shape as the existing
-- modules, so they reuse the feature-record machinery (submit, review, audit,
-- notifications, history) rather than adding tables or endpoints.
--
--   incidents     capability 'security',  resident_create false, not publishable.
--                 Security and the office file them; residents never see them.
--   board-reports capability 'documents', resident_create false, publishable.
--                 Only a reviewer may publish, and only the curated public
--                 text reaches members.
--
-- No figures, findings or penalties are implied by either definition. Amounts
-- and outcomes stay unavailable until verified records exist.
BEGIN;

INSERT INTO public.bfe_feature_definitions(code,capability,resident_create,publishable,fields) VALUES
('incidents','security',false,false,'[{"key":"kind","label":"Incident type","options":["Gate or entry","Property damage","Disturbance","Vehicle","Injury or medical","Other"],"required":true},{"key":"occurred","label":"Date it happened","type":"date","required":true},{"key":"time","label":"Time it happened","type":"time","required":true},{"key":"location","label":"Where it happened","type":"text","required":true},{"key":"severity","label":"Severity","options":["Information only","Needs follow-up","Urgent"],"required":true},{"key":"plate","label":"Vehicle plate involved","type":"text","required":true,"showWhen":{"key":"kind","in":["Vehicle"]}},{"key":"injuries","label":"Who was hurt and how","type":"textarea","required":true,"showWhen":{"key":"kind","in":["Injury or medical"]}},{"key":"damage","label":"What was damaged","type":"textarea","required":true,"showWhen":{"key":"kind","in":["Property damage"]}},{"key":"action","label":"Action taken","type":"textarea","required":true},{"key":"reportedBy","label":"Reported by","type":"text","required":false}]'::jsonb),
('board-reports','documents',false,true,'[{"key":"kind","label":"Report type","options":["Monthly update","Financial summary","Annual report","Committee report","Other"],"required":true},{"key":"period","label":"Period covered","type":"text","required":true},{"key":"audience","label":"Who it is for","options":["All members","Homeowners","Board only"],"required":true},{"key":"committee","label":"Which committee","type":"text","required":true,"showWhen":{"key":"kind","in":["Committee report"]}},{"key":"summary","label":"Summary","type":"textarea","required":true},{"key":"reference","label":"Supporting document reference","type":"text","required":false}]'::jsonb)
ON CONFLICT (code) DO UPDATE SET capability=EXCLUDED.capability,resident_create=EXCLUDED.resident_create,publishable=EXCLUDED.publishable,fields=EXCLUDED.fields;

NOTIFY pgrst,'reload schema';
COMMIT;
