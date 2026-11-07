-- Vehicle/sticker and permit/clearance requests.
--
-- These are request-and-approve workflows with the same shape as gate passes,
-- so they reuse the existing feature-record machinery (submit, review, audit,
-- notifications, history) instead of introducing new tables or endpoints.
-- Residents may submit; only the office may decide. Fees, sticker numbers and
-- required documents stay unavailable until the association supplies them.
BEGIN;

INSERT INTO public.bfe_feature_definitions(code,capability,resident_create,publishable,fields) VALUES
('vehicles','property',true,false,'[{"key":"request","label":"What do you need","options":["New sticker","Renew sticker","Replace a lost sticker","Remove a vehicle"],"required":true},{"key":"plate","label":"Plate or conduction number","type":"text","required":true},{"key":"vehicleType","label":"Vehicle type","options":["Car","Motorcycle","Van or SUV","Truck","Other"],"required":true},{"key":"makeModel","label":"Make and model","type":"text","required":true},{"key":"colour","label":"Colour","type":"text","required":true},{"key":"unit","label":"Unit the vehicle belongs to","type":"text","required":true},{"key":"owner","label":"Who owns the vehicle","options":["Homeowner","Household member","Tenant","Company"],"required":true},{"key":"driver","label":"Who usually drives it","type":"text","required":true,"showWhen":{"key":"owner","in":["Household member","Tenant"]}},{"key":"company","label":"Registered company","type":"text","required":true,"showWhen":{"key":"owner","in":["Company"]}},{"key":"lostReport","label":"What happened to the sticker","type":"textarea","required":true,"showWhen":{"key":"request","in":["Replace a lost sticker"]}},{"key":"orCr","label":"OR / CR reference","type":"text","required":false}]'::jsonb),
('permits','property',true,false,'[{"key":"permit","label":"Permit or clearance needed","options":["Construction","Renovation","Move-in clearance","Move-out clearance","Other"],"required":true},{"key":"unit","label":"Unit the work is for","type":"text","required":true},{"key":"start","label":"Proposed start date","type":"date","required":true},{"key":"finish","label":"Proposed finish date","type":"date","required":true},{"key":"scope","label":"Describe the work","type":"textarea","required":true,"showWhen":{"key":"permit","in":["Construction","Renovation","Other"]}},{"key":"contractor","label":"Contractor or crew","type":"text","required":true,"showWhen":{"key":"permit","in":["Construction","Renovation"]}},{"key":"workers","label":"How many workers","type":"number","required":true,"showWhen":{"key":"permit","in":["Construction","Renovation"]}},{"key":"mover","label":"Moving company or crew","type":"text","required":true,"showWhen":{"key":"permit","in":["Move-in clearance","Move-out clearance"]}},{"key":"documents","label":"Supporting document reference","type":"text","required":false}]'::jsonb)
ON CONFLICT (code) DO UPDATE SET capability=EXCLUDED.capability,resident_create=EXCLUDED.resident_create,publishable=EXCLUDED.publishable,fields=EXCLUDED.fields;

NOTIFY pgrst,'reload schema';
COMMIT;
