-- Apply after 053. Restore draft/review/post/reverse accounting forms.
-- No rates, invoices, payments, expenses, ledger balances or permissions seeded.
-- Imported receipt evidence and its entitlement rules are not changed.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_accounting_form_definitions(kind text PRIMARY KEY,fields jsonb NOT NULL);
CREATE TABLE public.bfe_accounting_entries (
 id uuid PRIMARY KEY,kind text NOT NULL REFERENCES public.bfe_accounting_form_definitions(kind),
 fields jsonb NOT NULL CHECK(jsonb_typeof(fields)='object'),status text NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Submitted','Posted','Rejected','Reversed')),
 creator_id uuid NOT NULL REFERENCES auth.users(id),reviewer_id uuid REFERENCES auth.users(id),review_note text,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bfe_accounting_entry_queue ON public.bfe_accounting_entries(kind,status,created_at DESC,id);
CREATE UNIQUE INDEX bfe_posted_expense_category ON public.bfe_accounting_entries(lower(btrim(fields->>'category'))) WHERE kind='expense-category' AND status='Posted';
CREATE UNIQUE INDEX bfe_posted_payment_reference ON public.bfe_accounting_entries(lower(btrim(fields->>'reference'))) WHERE kind='payment' AND status='Posted';
CREATE UNIQUE INDEX bfe_posted_expense_reference ON public.bfe_accounting_entries(lower(btrim(fields->>'reference'))) WHERE kind='expense' AND status='Posted';
CREATE UNIQUE INDEX bfe_posted_expense_month ON public.bfe_accounting_entries((fields->>'period')) WHERE kind='monthly-expense' AND status='Posted';
CREATE TABLE public.bfe_accounting_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),run_id uuid NOT NULL REFERENCES public.bfe_accounting_entries(id),
 lot_id uuid NOT NULL REFERENCES public.bfe_lots(id),period text NOT NULL,amount_centavos bigint NOT NULL CHECK(amount_centavos>=0),
 due_date date NOT NULL,reversed boolean NOT NULL DEFAULT false,rate_snapshot jsonb NOT NULL
);
CREATE UNIQUE INDEX bfe_one_current_dues_invoice ON public.bfe_accounting_invoices(lot_id,period) WHERE NOT reversed;
CREATE INDEX bfe_invoice_run ON public.bfe_accounting_invoices(run_id);
CREATE TABLE public.bfe_accounting_payments (
 entry_id uuid PRIMARY KEY REFERENCES public.bfe_accounting_entries(id),lot_id uuid NOT NULL REFERENCES public.bfe_lots(id),
 invoice_id uuid REFERENCES public.bfe_accounting_invoices(id),amount_centavos bigint NOT NULL CHECK(amount_centavos>0)
);
CREATE INDEX bfe_invoice_payment ON public.bfe_accounting_payments(invoice_id);
CREATE TABLE public.bfe_accounting_expenses (
 entry_id uuid PRIMARY KEY REFERENCES public.bfe_accounting_entries(id),category_id uuid NOT NULL REFERENCES public.bfe_accounting_entries(id),
 amount_centavos bigint NOT NULL CHECK(amount_centavos>0)
);
CREATE TABLE public.bfe_accounting_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,entry_id uuid NOT NULL REFERENCES public.bfe_accounting_entries(id),actor_id uuid NOT NULL,
 action text NOT NULL,reference text NOT NULL,before_values jsonb,after_values jsonb NOT NULL,at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bfe_accounting_form_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_accounting_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_accounting_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_accounting_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bfe_accounting_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_accounting_form_definitions,public.bfe_accounting_entries,public.bfe_accounting_invoices,public.bfe_accounting_payments,public.bfe_accounting_expenses,public.bfe_accounting_audit FROM PUBLIC,anon,authenticated;
INSERT INTO public.bfe_accounting_form_definitions(kind,fields) VALUES
('dues-rule','[{"key":"name","label":"Rate name","type":"text","required":true},{"key":"mode","label":"Assessment basis","required":true,"options":["Flat amount","Per square metre"]},{"key":"rate","label":"Monthly rate (PHP)","type":"number","required":true},{"key":"dueDay","label":"Due day of month (1–31)","type":"number","required":true},{"key":"latePercent","label":"Approved late fee percentage","type":"number","required":true},{"key":"effective","label":"Effective from","type":"date","required":true},{"key":"source","label":"Approved policy reference","type":"text","required":true}]'),
('billing-run','[{"key":"period","label":"Billing month","type":"month","required":true},{"key":"rule","label":"Posted rate reference","type":"text","required":true},{"key":"scope","label":"Properties to bill","required":true,"options":["All active lots","One phase","One lot"]},{"key":"phase","label":"Phase (when billing one phase)","type":"number","required":false},{"key":"physicalId","label":"Physical lot ID (when billing one lot)","type":"text","required":false},{"key":"memo","label":"Billing memo","type":"textarea","required":false}]'),
('payment','[{"key":"physicalId","label":"Physical lot ID","type":"text","required":true},{"key":"date","label":"Date paid","type":"date","required":true},{"key":"amount","label":"Amount (PHP)","type":"number","required":true},{"key":"method","label":"Payment method","type":"text","required":true},{"key":"payee","label":"Received from / payer","type":"text","required":true},{"key":"reference","label":"Official receipt or payment reference","type":"text","required":true},{"key":"allocationPeriod","label":"Invoice month to allocate (leave blank for unallocated)","type":"month","required":false},{"key":"memo","label":"Payment memo","type":"textarea","required":false}]'),
('expense-category','[{"key":"category","label":"Category name","type":"text","required":true},{"key":"description","label":"Description","type":"textarea","required":false}]'),
('expense','[{"key":"date","label":"Expense date","type":"date","required":true},{"key":"category","label":"Posted expense category","type":"text","required":true},{"key":"amount","label":"Amount (PHP)","type":"number","required":true},{"key":"payee","label":"Payee","type":"text","required":true},{"key":"method","label":"Payment method","type":"text","required":true},{"key":"reference","label":"Expense voucher or document reference","type":"text","required":true},{"key":"memo","label":"Expense memo","type":"textarea","required":false}]'),
('monthly-expense','[{"key":"period","label":"Reporting month","type":"month","required":true},{"key":"amount","label":"Reported expense total (PHP)","type":"number","required":true},{"key":"reference","label":"Report reference","type":"text","required":true},{"key":"memo","label":"Notes and reconciliation explanation","type":"textarea","required":true}]');

CREATE FUNCTION public.bfe_validate_accounting_fields(p_kind text,p_fields jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE defs jsonb; f jsonb; k text; v text; result jsonb:='{}'; parsed_date date;
BEGIN
 SELECT fields INTO defs FROM public.bfe_accounting_form_definitions WHERE kind=p_kind;
 IF defs IS NULL OR p_fields IS NULL OR jsonb_typeof(p_fields)<>'object' OR octet_length(p_fields::text)>12000 THEN RAISE EXCEPTION 'Check accounting form.' USING ERRCODE='22023'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_fields) LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(defs) q WHERE q->>'key'=k) OR jsonb_typeof(p_fields->k)<>'string' THEN RAISE EXCEPTION 'Unsupported accounting answer.' USING ERRCODE='22023'; END IF;
 END LOOP;
 FOR f IN SELECT value FROM jsonb_array_elements(defs) LOOP
  k:=f->>'key';v:=btrim(coalesce(p_fields->>k,''));
  IF (coalesce((f->>'required')::boolean,false) AND v='') OR char_length(v)>2000 THEN RAISE EXCEPTION 'Complete the required accounting questions.' USING ERRCODE='22023'; END IF;
  IF v<>'' THEN
   IF f ? 'options' AND NOT (f->'options' ? v) THEN RAISE EXCEPTION 'Choose a supported accounting answer.' USING ERRCODE='22023'; END IF;
   IF f->>'type'='number' THEN
    IF v !~ '^[0-9]+([.][0-9]{1,2})?$' OR char_length(v)>15 THEN RAISE EXCEPTION 'Use a non-negative amount with up to two decimal places.' USING ERRCODE='22023'; END IF;
    IF v::numeric>10000000000 THEN RAISE EXCEPTION 'Amount exceeds the supported range.' USING ERRCODE='22023'; END IF;
   END IF;
   IF f->>'type'='month' AND v !~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Choose a valid reporting month.' USING ERRCODE='22023'; END IF;
   IF f->>'type'='date' THEN parsed_date:=v::date; IF to_char(parsed_date,'YYYY-MM-DD')<>v THEN RAISE EXCEPTION 'Use a valid date.' USING ERRCODE='22023'; END IF; END IF;
  END IF;
  result:=result||jsonb_build_object(k,v);
 END LOOP;
 IF p_kind='dues-rule' AND ((result->>'dueDay')::numeric NOT BETWEEN 1 AND 31 OR trunc((result->>'dueDay')::numeric)<>(result->>'dueDay')::numeric OR (result->>'latePercent')::numeric>100) THEN RAISE EXCEPTION 'Choose a due day from 1 to 31 and a percentage from 0 to 100.' USING ERRCODE='22023'; END IF;
 IF p_kind IN ('payment','expense') AND (result->>'amount')::numeric<=0 THEN RAISE EXCEPTION 'Payment or expense amount must be positive.' USING ERRCODE='22023'; END IF;
 IF p_kind='billing-run' AND ((result->>'scope'='One phase' AND (coalesce(result->>'phase','') !~ '^[1-9][0-9]*$')) OR (result->>'scope'='One lot' AND coalesce(result->>'physicalId','')='')) THEN RAISE EXCEPTION 'Specify the phase or lot for the selected scope.' USING ERRCODE='22023'; END IF;
 RETURN result;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_validate_accounting_fields(text,jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.bfe_save_accounting_draft(p_id uuid,p_version integer,p_kind text,p_fields jsonb,p_reference text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_accounting_entries; result public.bfe_accounting_entries; normalized jsonb;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT public.bfe_can('finance','view','association') OR NOT public.bfe_can('finance','create','association') THEN RAISE EXCEPTION 'Finance draft permission required.' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_version IS NULL OR p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Enter the source or preparation reference.' USING ERRCODE='22023'; END IF;
 normalized:=public.bfe_validate_accounting_fields(p_kind,p_fields);
 PERFORM pg_advisory_xact_lock(hashtextextended('accounting:'||p_id::text,0));
 SELECT * INTO r FROM public.bfe_accounting_entries WHERE id=p_id FOR UPDATE;
 IF r.id IS NOT NULL AND (r.creator_id<>auth.uid() OR r.kind<>p_kind OR r.status NOT IN ('Draft','Rejected')) THEN RAISE EXCEPTION 'Only your editable draft can be changed.' USING ERRCODE='42501'; END IF;
 IF r.id IS NOT NULL AND r.fields=normalized AND r.status='Draft' THEN RETURN r.id; END IF;
 IF coalesce(r.version,0)<>p_version THEN RAISE EXCEPTION 'Draft changed. Refresh before saving.' USING ERRCODE='40001'; END IF;
 INSERT INTO public.bfe_accounting_entries(id,kind,fields,creator_id) VALUES(p_id,p_kind,normalized,auth.uid())
 ON CONFLICT(id) DO UPDATE SET fields=EXCLUDED.fields,status='Draft',reviewer_id=NULL,review_note=NULL,version=bfe_accounting_entries.version+1,updated_at=now() RETURNING * INTO result;
 INSERT INTO public.bfe_accounting_audit(entry_id,actor_id,action,reference,before_values,after_values) VALUES(p_id,auth.uid(),'Draft saved',btrim(p_reference),CASE WHEN r.id IS NULL THEN NULL ELSE to_jsonb(r) END,to_jsonb(result));
 RETURN p_id;
END;$$;

CREATE FUNCTION public.bfe_decide_accounting_entry(p_id uuid,p_version integer,p_status text,p_reference text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_accounting_entries; result public.bfe_accounting_entries; rule public.bfe_accounting_entries; l public.bfe_lots; invoice public.bfe_accounting_invoices;
 category_id uuid; amount bigint; allocated numeric; first_day date; last_day date; due date; area numeric; billed integer:=0;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT public.bfe_can('finance','view','association') THEN RAISE EXCEPTION 'Finance access required.' USING ERRCODE='42501'; END IF;
 IF p_status IS NULL OR p_status NOT IN ('Submitted','Posted','Rejected','Reversed') OR p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 OR p_version IS NULL THEN RAISE EXCEPTION 'Check decision and reference.' USING ERRCODE='22023'; END IF;
 -- One lock serializes accounting decisions, including dependency checks and allocations.
 PERFORM pg_advisory_xact_lock(hashtextextended('accounting-posting',0));
 SELECT * INTO r FROM public.bfe_accounting_entries WHERE id=p_id FOR UPDATE;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Accounting record unavailable.' USING ERRCODE='42501'; END IF;
 IF p_status='Submitted' THEN
  IF r.creator_id<>auth.uid() OR NOT public.bfe_can('finance','create','association') THEN RAISE EXCEPTION 'Submit your own finance draft.' USING ERRCODE='42501'; END IF;
 ELSE
  IF r.creator_id=auth.uid() OR NOT public.bfe_can('finance','approve','association') OR (p_status='Reversed' AND NOT public.bfe_can('finance','manage','association')) THEN RAISE EXCEPTION 'An independent authorized finance reviewer is required.' USING ERRCODE='42501'; END IF;
 END IF;
 IF r.status=p_status AND r.version=p_version+1 AND EXISTS(SELECT 1 FROM public.bfe_accounting_audit WHERE entry_id=p_id AND actor_id=auth.uid() AND action=p_status AND reference=btrim(p_reference)) THEN RETURN; END IF;
 IF r.version<>p_version OR NOT ((r.status='Draft' AND p_status='Submitted') OR (r.status='Submitted' AND p_status IN ('Posted','Rejected')) OR (r.status='Posted' AND p_status='Reversed')) THEN RAISE EXCEPTION 'Accounting record changed or decision unavailable.' USING ERRCODE='40001'; END IF;
 PERFORM public.bfe_validate_accounting_fields(r.kind,r.fields);
 IF p_status='Posted' THEN
  IF r.kind IN ('payment','expense') AND EXISTS(SELECT 1 FROM public.bfe_accounting_entries WHERE id<>p_id AND kind=r.kind AND status='Posted' AND lower(btrim(fields->>'reference'))=lower(btrim(r.fields->>'reference'))) THEN RAISE EXCEPTION 'A posted record already uses this reference.' USING ERRCODE='22023'; END IF;
  IF r.kind='expense-category' AND EXISTS(SELECT 1 FROM public.bfe_accounting_entries WHERE kind='expense-category' AND status='Posted' AND lower(btrim(fields->>'category'))=lower(btrim(r.fields->>'category'))) THEN RAISE EXCEPTION 'This expense category is already posted.' USING ERRCODE='22023'; END IF;
  IF r.kind='monthly-expense' AND EXISTS(SELECT 1 FROM public.bfe_accounting_entries WHERE kind='monthly-expense' AND status='Posted' AND fields->>'period'=r.fields->>'period') THEN RAISE EXCEPTION 'A monthly total already exists. Reverse it before posting a correction.' USING ERRCODE='22023'; END IF;
  IF r.kind='billing-run' THEN
   SELECT * INTO rule FROM public.bfe_accounting_entries WHERE id=(r.fields->>'rule')::uuid AND kind='dues-rule' AND status='Posted' FOR SHARE;
   IF rule.id IS NULL THEN RAISE EXCEPTION 'Choose a posted dues configuration.' USING ERRCODE='22023'; END IF;
   first_day:=((r.fields->>'period')||'-01')::date; last_day:=(first_day+interval '1 month - 1 day')::date;
   IF (rule.fields->>'effective')::date>first_day THEN RAISE EXCEPTION 'The selected rate is not effective for this billing month.' USING ERRCODE='22023'; END IF;
   due:=first_day+(least((rule.fields->>'dueDay')::numeric::integer,extract(day FROM last_day)::integer)-1);
   FOR l IN SELECT f.* FROM public.bfe_lots f JOIN public.bfe_import_batches b ON b.id=f.batch_id AND b.status='active'
    WHERE r.fields->>'scope'='All active lots' OR (r.fields->>'scope'='One phase' AND f.phase=nullif(r.fields->>'phase','')::numeric) OR (r.fields->>'scope'='One lot' AND f.physical_id=r.fields->>'physicalId') ORDER BY f.id FOR SHARE OF f LOOP
    IF rule.fields->>'mode'='Per square metre' THEN
     SELECT area_sqm INTO area FROM public.bfe_lot_business_details WHERE lot_id=l.id;
     IF area IS NULL OR area<=0 THEN RAISE EXCEPTION 'A selected lot has no reviewed area. Complete property business details before billing.' USING ERRCODE='22023'; END IF;
    ELSE area:=1; END IF;
    IF (rule.fields->>'rate')::numeric*area*100>9007199254740991 THEN RAISE EXCEPTION 'Invoice amount exceeds the supported range.' USING ERRCODE='22023'; END IF;
    IF EXISTS(SELECT 1 FROM public.bfe_accounting_invoices WHERE lot_id=l.id AND period=r.fields->>'period' AND NOT reversed) THEN RAISE EXCEPTION 'This scope already contains an invoice for the selected month. Review or reverse the previous run.' USING ERRCODE='22023'; END IF;
    amount:=round((rule.fields->>'rate')::numeric*area*100)::bigint;
    INSERT INTO public.bfe_accounting_invoices(run_id,lot_id,period,amount_centavos,due_date,rate_snapshot) VALUES(p_id,l.id,r.fields->>'period',amount,due,rule.fields);
    billed:=billed+1; IF billed>10000 THEN RAISE EXCEPTION 'Split this billing run into smaller scopes.' USING ERRCODE='22023'; END IF;
   END LOOP;
   IF billed=0 THEN RAISE EXCEPTION 'No active properties match this billing scope.' USING ERRCODE='22023'; END IF;
  ELSIF r.kind='payment' THEN
   SELECT f.* INTO l FROM public.bfe_lots f JOIN public.bfe_import_batches b ON b.id=f.batch_id AND b.status='active' WHERE f.physical_id=r.fields->>'physicalId';
   IF l.id IS NULL THEN RAISE EXCEPTION 'Choose an active registered property.' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM public.bfe_receipts WHERE lower(btrim(or_number))=lower(btrim(r.fields->>'reference'))) THEN RAISE EXCEPTION 'An imported receipt already uses this reference. Reconcile it instead of posting a duplicate.' USING ERRCODE='22023'; END IF;
   amount:=round((r.fields->>'amount')::numeric*100)::bigint;
   IF coalesce(r.fields->>'allocationPeriod','')<>'' THEN
    SELECT * INTO invoice FROM public.bfe_accounting_invoices WHERE lot_id=l.id AND period=r.fields->>'allocationPeriod' AND NOT reversed FOR UPDATE;
    IF invoice.id IS NULL THEN RAISE EXCEPTION 'No current invoice matches this property and month.' USING ERRCODE='22023'; END IF;
    SELECT coalesce(sum(p.amount_centavos),0) INTO allocated FROM public.bfe_accounting_payments p JOIN public.bfe_accounting_entries e ON e.id=p.entry_id AND e.status='Posted' WHERE p.invoice_id=invoice.id;
    IF allocated+amount>invoice.amount_centavos THEN RAISE EXCEPTION 'Allocation exceeds the remaining invoice amount. Split the payment or record it unallocated.' USING ERRCODE='22023'; END IF;
   END IF;
   INSERT INTO public.bfe_accounting_payments(entry_id,lot_id,invoice_id,amount_centavos) VALUES(p_id,l.id,invoice.id,amount);
  ELSIF r.kind='expense' THEN
   SELECT id INTO category_id FROM public.bfe_accounting_entries WHERE kind='expense-category' AND status='Posted' AND lower(btrim(fields->>'category'))=lower(btrim(r.fields->>'category'));
   IF category_id IS NULL THEN RAISE EXCEPTION 'Choose a posted expense category.' USING ERRCODE='22023'; END IF;
   INSERT INTO public.bfe_accounting_expenses(entry_id,category_id,amount_centavos) VALUES(p_id,category_id,round((r.fields->>'amount')::numeric*100)::bigint);
  END IF;
 ELSIF p_status='Reversed' THEN
  IF r.kind='billing-run' THEN
   IF EXISTS(SELECT 1 FROM public.bfe_accounting_invoices i JOIN public.bfe_accounting_payments p ON p.invoice_id=i.id JOIN public.bfe_accounting_entries e ON e.id=p.entry_id AND e.status='Posted' WHERE i.run_id=p_id) THEN RAISE EXCEPTION 'Reverse allocated payments before reversing this billing run.' USING ERRCODE='22023'; END IF;
   UPDATE public.bfe_accounting_invoices SET reversed=true WHERE run_id=p_id;
  ELSIF r.kind='dues-rule' AND EXISTS(SELECT 1 FROM public.bfe_accounting_entries e WHERE kind='billing-run' AND status='Posted' AND fields->>'rule'=p_id::text) THEN RAISE EXCEPTION 'Reverse dependent billing runs before reversing this rate.' USING ERRCODE='22023';
  ELSIF r.kind='expense-category' AND EXISTS(SELECT 1 FROM public.bfe_accounting_expenses x JOIN public.bfe_accounting_entries e ON e.id=x.entry_id AND e.status='Posted' WHERE x.category_id=p_id) THEN RAISE EXCEPTION 'Reverse dependent expenses before reversing this category.' USING ERRCODE='22023'; END IF;
 END IF;
 UPDATE public.bfe_accounting_entries SET status=p_status,reviewer_id=CASE WHEN p_status='Submitted' THEN NULL ELSE auth.uid() END,review_note=btrim(p_reference),version=version+1,updated_at=now() WHERE id=p_id RETURNING * INTO result;
 INSERT INTO public.bfe_accounting_audit(entry_id,actor_id,action,reference,before_values,after_values) VALUES(p_id,auth.uid(),p_status,btrim(p_reference),to_jsonb(r),to_jsonb(result));
 IF p_status IN ('Posted','Rejected','Reversed') THEN INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(r.creator_id,'account','Accounting review updated','Open the accounting workbench to review the recorded decision.','/more/notifications','accounting:'||p_id||':'||result.version); END IF;
END;$$;

CREATE FUNCTION public.bfe_accounting_dashboard(p_kind text DEFAULT 'dues-rule',p_status text DEFAULT '',p_page integer DEFAULT 0,p_search text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT public.bfe_can('finance','view','association') THEN RAISE EXCEPTION 'Association finance access required.' USING ERRCODE='42501'; END IF;
 IF p_kind IS NULL OR NOT EXISTS(SELECT 1 FROM public.bfe_accounting_form_definitions WHERE kind=p_kind) OR p_status IS NULL OR p_status NOT IN ('','Draft','Submitted','Posted','Rejected','Reversed') OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 OR p_search IS NULL OR length(p_search)>100 THEN RAISE EXCEPTION 'Check accounting filters.' USING ERRCODE='22023'; END IF;
 WITH visible AS MATERIALIZED (SELECT * FROM public.bfe_accounting_entries WHERE kind=p_kind AND (p_status='' OR status=p_status) AND position(lower(p_search) IN lower(fields::text))>0),
 page AS (SELECT * FROM visible ORDER BY created_at DESC,id OFFSET p_page*20 LIMIT 20)
 SELECT jsonb_build_object('rows',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY created_at DESC,id),'[]') FROM page p),'total',(SELECT count(*) FROM visible),
 'can_create',public.bfe_can('finance','create','association'),'can_review',public.bfe_can('finance','approve','association'),'can_reverse',public.bfe_can('finance','approve','association') AND public.bfe_can('finance','manage','association'),'can_export',public.bfe_can('finance','export','association'),
 'rules',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',fields->>'name') ORDER BY fields->>'name'),'[]') FROM public.bfe_accounting_entries WHERE kind='dues-rule' AND status='Posted'),
 'categories',(SELECT coalesce(jsonb_agg(fields->>'category' ORDER BY fields->>'category'),'[]') FROM public.bfe_accounting_entries WHERE kind='expense-category' AND status='Posted'),
 'summary',jsonb_build_object('invoices',(SELECT count(*) FROM public.bfe_accounting_invoices WHERE NOT reversed),
 'billed_centavos',(SELECT coalesce(sum(amount_centavos),0)::text FROM public.bfe_accounting_invoices WHERE NOT reversed),
 'allocated_centavos',(SELECT coalesce(sum(p.amount_centavos),0)::text FROM public.bfe_accounting_payments p JOIN public.bfe_accounting_entries e ON e.id=p.entry_id WHERE e.status='Posted' AND p.invoice_id IS NOT NULL),
 'unallocated_centavos',(SELECT coalesce(sum(p.amount_centavos),0)::text FROM public.bfe_accounting_payments p JOIN public.bfe_accounting_entries e ON e.id=p.entry_id WHERE e.status='Posted' AND p.invoice_id IS NULL),
 'expenses_centavos',(SELECT coalesce(sum(x.amount_centavos),0)::text FROM public.bfe_accounting_expenses x JOIN public.bfe_accounting_entries e ON e.id=x.entry_id WHERE e.status='Posted'))
 ) INTO result;
 RETURN result;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_save_accounting_draft(uuid,integer,text,jsonb,text),public.bfe_decide_accounting_entry(uuid,integer,text,text),public.bfe_accounting_dashboard(text,text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_save_accounting_draft(uuid,integer,text,jsonb,text),public.bfe_decide_accounting_entry(uuid,integer,text,text),public.bfe_accounting_dashboard(text,text,integer,text) TO authenticated;
CREATE FUNCTION public.bfe_export_accounting_page(p_kind text,p_status text DEFAULT '',p_page integer DEFAULT 0,p_search text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT public.bfe_can('finance','export','association') THEN RAISE EXCEPTION 'Finance export permission required.' USING ERRCODE='42501'; END IF;
 RETURN public.bfe_accounting_dashboard(p_kind,p_status,p_page,p_search);
END;$$;
REVOKE ALL ON FUNCTION public.bfe_export_accounting_page(text,text,integer,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_export_accounting_page(text,text,integer,text) TO authenticated;
CREATE FUNCTION public.bfe_office_business_review_inbox() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; extra jsonb;
BEGIN
 result:=public.bfe_office_review_inbox();
 extra:='[]'::jsonb;
 IF public.bfe_can('finance','view','association') THEN
  SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.module),'[]') INTO extra FROM (
   SELECT 'accounting'::text AS kind,kind AS module,count(*) AS pending,0 AS in_review,public.bfe_can('finance','approve','association') AS can_decide
   FROM public.bfe_accounting_entries WHERE status='Submitted' GROUP BY kind
  )q;
 END IF;
 RETURN jsonb_set(result,'{queues}',coalesce(result->'queues','[]')||extra)||jsonb_build_object('accounting_available',true);
END;$$;
CREATE FUNCTION public.bfe_accounting_entry_detail(p_id uuid,p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR NOT public.bfe_can('finance','view','association') THEN RAISE EXCEPTION 'Association finance access required.' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 OR NOT EXISTS(SELECT 1 FROM public.bfe_accounting_entries WHERE id=p_id) THEN RAISE EXCEPTION 'Accounting record unavailable.' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object(
 'invoice_total',(SELECT count(*) FROM public.bfe_accounting_invoices WHERE run_id=p_id),
 'invoices',(SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY physical_id,id),'[]') FROM (
  SELECT i.id,l.physical_id,i.period,i.due_date,i.amount_centavos::text,i.reversed FROM public.bfe_accounting_invoices i JOIN public.bfe_lots l ON l.id=i.lot_id WHERE run_id=p_id ORDER BY l.physical_id,i.id OFFSET p_page*20 LIMIT 20
 )q),
 'history',(SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY at DESC,id DESC),'[]') FROM (
  SELECT a.id::text,a.action,a.reference,a.at,coalesce((SELECT m.name FROM public.members m WHERE m.user_id=a.actor_id LIMIT 1),'Account holder') AS actor_name FROM public.bfe_accounting_audit a WHERE entry_id=p_id ORDER BY a.at DESC,a.id DESC LIMIT 30
 )q));
END;$$;
REVOKE ALL ON FUNCTION public.bfe_office_business_review_inbox(),public.bfe_accounting_entry_detail(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_office_business_review_inbox(),public.bfe_accounting_entry_detail(uuid,integer) TO authenticated;
NOTIFY pgrst,'reload schema'; COMMIT;
