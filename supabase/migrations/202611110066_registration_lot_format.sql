-- Apply after 065 (requires the registration changes in 063).
-- New submissions only: historical address text is left for staff review.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $registration$
DECLARE body text; definition text; changed text;
BEGIN
 SELECT prosrc,pg_get_functiondef(oid) INTO body,definition FROM pg_proc
 WHERE oid=to_regprocedure('public.bfe_apply_for_membership(jsonb)') AND prosecdef;
 IF md5(regexp_replace(body,'[[:space:]]','','g')) IS DISTINCT FROM '807803e029139c53eabc70611b94617a'
 OR position(body IN definition)=0 THEN
  RAISE EXCEPTION 'Registration service differs from reviewed migration 063. No changes applied; inspect it first.';
 END IF;
 changed:=replace(body,$old$coalesce((p_fields->>'phase')::integer,0) NOT BETWEEN 1 AND 99$old$,$new$coalesce((p_fields->>'phase')::integer,0) NOT BETWEEN 1 AND 3$new$);
 changed:=replace(changed,$old$coalesce((p_fields->>'block')::integer,0) NOT BETWEEN 1 AND 999$old$,$new$coalesce((p_fields->>'block')::integer,0) NOT BETWEEN 1 AND 19$new$);
 changed:=replace(changed,$old$coalesce((p_fields->>'lot')::integer,0) NOT BETWEEN 1 AND 9999$old$,$new$coalesce((p_fields->>'lot')::integer,0) NOT BETWEEN 1 AND 111$new$);
 changed:=replace(changed,
 $old$u:='P'||(p_fields->>'phase')||' B'||(p_fields->>'block')||' L'||(p_fields->>'lot');$old$,
 $new$u:=((p_fields->>'phase')::integer)::text||'-'||lpad(((p_fields->>'block')::integer)::text,2,'0')||'-'||lpad(((p_fields->>'lot')::integer)::text,3,'0');$new$);
 -- Reject fractional/string notation before PostgreSQL integer coercion.
 changed:=replace(changed,$old$client:=(p_fields->>'clientId')::uuid;$old$,
 $new$IF coalesce(p_fields->>'phase','')!~'^[1-3]$'
 OR coalesce(p_fields->>'block','')!~'^(0?[1-9]|1[0-9])$'
 OR coalesce(p_fields->>'lot','')!~'^(0{0,2}[1-9]|0?[1-9][0-9]|10[0-9]|11[01])$' THEN
  RAISE EXCEPTION 'Choose phase 1-3, block 01-19 and lot 001-111.' USING ERRCODE='22023';
 END IF;
 client:=(p_fields->>'clientId')::uuid;$new$);
 IF changed=body OR position('lpad(' IN changed)=0 OR position('Choose phase 1-3' IN changed)=0 THEN
  RAISE EXCEPTION 'Registration lot patch could not be applied safely.';
 END IF;
 EXECUTE replace(definition,body,changed);
END;$registration$;
NOTIFY pgrst,'reload schema';
COMMIT;
