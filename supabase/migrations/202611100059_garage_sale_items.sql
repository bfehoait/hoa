-- Apply after 058. Structured per-item review; no listings or approvals seeded.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
CREATE TABLE public.bfe_garage_items (
 id uuid PRIMARY KEY,record_id uuid NOT NULL REFERENCES public.bfe_feature_records(id),
 title text NOT NULL CHECK(char_length(title) BETWEEN 2 AND 120),detail text NOT NULL CHECK(char_length(detail) BETWEEN 5 AND 2000),
 condition text NOT NULL CHECK(condition IN ('New','Like new','Good','Fair','For repair')),
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 10000),price_centavos bigint NOT NULL CHECK(price_centavos BETWEEN 0 AND 9007199254740991),
 status text NOT NULL DEFAULT 'Submitted' CHECK(status IN ('Submitted','Published','Rejected','Withdrawn')),
 version integer NOT NULL DEFAULT 1,review_note text NOT NULL DEFAULT '',updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bfe_garage_item_queue ON public.bfe_garage_items(status,updated_at,id);
CREATE TABLE public.bfe_garage_item_audit(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,item_id uuid NOT NULL REFERENCES public.bfe_garage_items(id),actor_id uuid NOT NULL,action text NOT NULL,reference text NOT NULL,before_values jsonb,after_values jsonb NOT NULL,at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.bfe_garage_items ENABLE ROW LEVEL SECURITY; ALTER TABLE public.bfe_garage_item_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bfe_garage_items,public.bfe_garage_item_audit FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.bfe_garage_items(p_record uuid DEFAULT NULL,p_office boolean DEFAULT false,p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE review boolean; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 THEN RAISE EXCEPTION 'Active account required.' USING ERRCODE='42501'; END IF;
 IF p_office IS NULL OR p_page IS NULL OR p_page NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Check item filters.' USING ERRCODE='22023'; END IF;
 review:=public.bfe_can('livelihood','view','association');
 IF p_office AND NOT review THEN RAISE EXCEPTION 'Office listing access required.' USING ERRCODE='42501'; END IF;
 IF NOT p_office AND (p_record IS NULL OR NOT public.bfe_listing_visible(p_record)) THEN RAISE EXCEPTION 'Garage sale unavailable.' USING ERRCODE='42501'; END IF;
 WITH visible AS MATERIALIZED (
  SELECT i.*,CASE WHEN review OR r.owner_id=auth.uid() THEN r.title ELSE r.public_title END AS sale_title,r.owner_id=auth.uid() AS is_owner,r.owner_id=auth.uid() AND (public.bfe_can('livelihood','create','own') OR public.bfe_can('livelihood','create','association')) AND r.status IN ('Submitted','Published') AS can_edit,
   review AND public.bfe_can('livelihood','approve','association') AND public.bfe_can('livelihood','publish','association') AS can_moderate, review AND public.bfe_can('livelihood','approve','association') AND public.bfe_can('livelihood','publish','association') AND i.status='Submitted' AS can_review, r.status='Published' AND r.publication_consent AND r.expires_at>now() AS can_publish
  FROM public.bfe_garage_items i JOIN public.bfe_feature_records r ON r.id=i.record_id AND r.module='garage-sales'
  WHERE (p_record IS NULL OR i.record_id=p_record) AND (p_office OR review OR (r.owner_id=auth.uid() AND public.bfe_can('livelihood','view','own')) OR
   (i.status='Published' AND r.status='Published' AND r.publication_consent AND r.expires_at>now() AND (r.audience='members' OR r.audience=ANY(public.bfe_current_roles()))))
 ), page AS (SELECT * FROM visible ORDER BY updated_at DESC,id OFFSET p_page*20 LIMIT 20)
 SELECT jsonb_build_object('total',(SELECT count(*) FROM visible),'rows',(SELECT coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('price_centavos',p.price_centavos::text,'review_note',CASE WHEN review OR p.is_owner THEN p.review_note ELSE '' END) ORDER BY updated_at DESC,id),'[]') FROM page p),
 'can_create',EXISTS(SELECT 1 FROM public.bfe_feature_records r WHERE r.id=p_record AND r.module='garage-sales' AND r.owner_id=auth.uid() AND r.status IN ('Submitted','Published') AND (public.bfe_can('livelihood','create','own') OR public.bfe_can('livelihood','create','association')))) INTO result;
 RETURN result;
END;$$;
CREATE FUNCTION public.bfe_save_garage_item(p_id uuid,p_record uuid,p_version integer,p_title text,p_detail text,p_condition text,p_quantity integer,p_price numeric,p_reference text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records; i public.bfe_garage_items; result public.bfe_garage_items;
BEGIN
 SELECT * INTO r FROM public.bfe_feature_records WHERE id=p_record FOR UPDATE;
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR r.id IS NULL OR r.module<>'garage-sales' OR r.owner_id IS DISTINCT FROM auth.uid() OR r.status NOT IN ('Submitted','Published') OR NOT(public.bfe_can('livelihood','create','own') OR public.bfe_can('livelihood','create','association')) THEN RAISE EXCEPTION 'Edit items only for your own submitted or published sale.' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_version IS NULL OR p_title IS NULL OR char_length(btrim(p_title)) NOT BETWEEN 2 AND 120 OR p_detail IS NULL OR char_length(btrim(p_detail)) NOT BETWEEN 5 AND 2000 OR p_condition IS NULL OR p_condition NOT IN ('New','Like new','Good','Fair','For repair') OR p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 10000 OR p_price IS NULL OR p_price<0 OR p_price*100>9007199254740991 OR p_price<>round(p_price,2) OR p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Check the item, quantity, price and submission reference.' USING ERRCODE='22023'; END IF;
 SELECT * INTO i FROM public.bfe_garage_items WHERE id=p_id FOR UPDATE;
 IF i.id IS NOT NULL AND i.record_id<>p_record THEN RAISE EXCEPTION 'Item unavailable.' USING ERRCODE='42501'; END IF;
 IF i.status='Submitted' AND i.version=p_version+1 AND i.title=btrim(p_title) AND i.detail=btrim(p_detail) AND i.condition=p_condition AND i.quantity=p_quantity AND i.price_centavos=p_price*100 THEN RETURN; END IF;
 IF (i.id IS NULL AND p_version<>0) OR (i.id IS NOT NULL AND i.version<>p_version) THEN RAISE EXCEPTION 'Item changed. Refresh before editing.' USING ERRCODE='40001'; END IF;
 INSERT INTO public.bfe_garage_items(id,record_id,title,detail,condition,quantity,price_centavos) VALUES(p_id,p_record,btrim(p_title),btrim(p_detail),p_condition,p_quantity,p_price*100)
 ON CONFLICT(id) DO UPDATE SET title=excluded.title,detail=excluded.detail,condition=excluded.condition,quantity=excluded.quantity,price_centavos=excluded.price_centavos,status='Submitted',review_note='',version=public.bfe_garage_items.version+1,updated_at=now() RETURNING * INTO result;
 INSERT INTO public.bfe_garage_item_audit(item_id,actor_id,action,reference,before_values,after_values) VALUES(p_id,auth.uid(),'Submitted',btrim(p_reference),CASE WHEN i.id IS NULL THEN NULL ELSE to_jsonb(i) END,to_jsonb(result));
END;$$;
CREATE FUNCTION public.bfe_decide_garage_item(p_id uuid,p_version integer,p_status text,p_reference text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.bfe_feature_records; i public.bfe_garage_items; result public.bfe_garage_items;
BEGIN
 -- Lock the parent first, matching edits and publication/withdrawal serialization.
 SELECT f.* INTO r FROM public.bfe_feature_records f JOIN public.bfe_garage_items x ON x.record_id=f.id WHERE x.id=p_id FOR UPDATE OF f;
 SELECT * INTO i FROM public.bfe_garage_items WHERE id=p_id FOR UPDATE;
 IF auth.uid() IS NULL OR cardinality(public.bfe_current_roles())=0 OR i.id IS NULL OR r.module<>'garage-sales' THEN RAISE EXCEPTION 'Item unavailable.' USING ERRCODE='42501'; END IF;
 IF p_status='Withdrawn' AND r.owner_id=auth.uid() AND (public.bfe_can('livelihood','create','own') OR public.bfe_can('livelihood','create','association')) THEN NULL;
 ELSIF NOT public.bfe_can('livelihood','view','association') OR NOT public.bfe_can('livelihood','approve','association') OR NOT public.bfe_can('livelihood','publish','association') OR p_status IS NULL OR p_status NOT IN ('Published','Rejected','Withdrawn') THEN RAISE EXCEPTION 'Listing review and publication permissions required.' USING ERRCODE='42501'; END IF;
 IF p_version IS NULL OR p_reference IS NULL OR char_length(btrim(p_reference)) NOT BETWEEN 3 AND 200 THEN RAISE EXCEPTION 'Enter the decision reference.' USING ERRCODE='22023'; END IF;
 IF i.status=p_status AND i.version=p_version+1 AND EXISTS(SELECT 1 FROM public.bfe_garage_item_audit WHERE item_id=p_id AND actor_id=auth.uid() AND action=p_status AND reference=btrim(p_reference)) THEN RETURN; END IF;
 IF i.version<>p_version OR (p_status IN ('Published','Rejected') AND i.status<>'Submitted') OR (p_status='Withdrawn' AND i.status='Withdrawn') THEN RAISE EXCEPTION 'Item changed. Refresh before deciding.' USING ERRCODE='40001'; END IF;
 IF p_status='Published' AND (r.status<>'Published' OR NOT r.publication_consent OR r.expires_at<=now()) THEN RAISE EXCEPTION 'Publish the consented, unexpired garage sale before publishing its items.' USING ERRCODE='22023'; END IF;
 UPDATE public.bfe_garage_items SET status=p_status,review_note=btrim(p_reference),version=version+1,updated_at=now() WHERE id=p_id RETURNING * INTO result;
 INSERT INTO public.bfe_garage_item_audit(item_id,actor_id,action,reference,before_values,after_values) VALUES(p_id,auth.uid(),p_status,btrim(p_reference),to_jsonb(i),to_jsonb(result));
 INSERT INTO public.bfe_notifications(recipient_id,kind,title,body,path,event_key) VALUES(r.owner_id,'community','Garage sale item updated','Open your garage sale submission to check the item decision.','/more/notifications','garage-item:'||p_id||':'||result.version) ON CONFLICT(recipient_id,event_key) DO NOTHING;
END;$$;
REVOKE ALL ON FUNCTION public.bfe_garage_items(uuid,boolean,integer),public.bfe_save_garage_item(uuid,uuid,integer,text,text,text,integer,numeric,text),public.bfe_decide_garage_item(uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bfe_garage_items(uuid,boolean,integer),public.bfe_save_garage_item(uuid,uuid,integer,text,text,text,integer,numeric,text),public.bfe_decide_garage_item(uuid,integer,text,text) TO authenticated;
DO $queue$
DECLARE body text; definition text; changed text; marker text:=' RETURN jsonb_set(result,''{queues}'',coalesce(result->''queues'',''[]'')||extra)||jsonb_build_object(''accounting_available'',true);';
BEGIN
 SELECT prosrc,pg_get_functiondef(oid) INTO body,definition FROM pg_proc WHERE oid=to_regprocedure('public.bfe_office_business_review_inbox()') AND prosecdef;
 IF body IS NULL OR position(marker IN body)=0 OR position(body IN definition)=0 THEN RAISE EXCEPTION 'Install the reviewed accounting inbox from 054 first.'; END IF;
 changed:=replace(body,marker,$addition$
 IF public.bfe_can('livelihood','view','association') THEN
  extra:=extra||jsonb_build_array(jsonb_build_object('kind','garage_items','module','garage-sales','pending',(SELECT count(*) FROM public.bfe_garage_items WHERE status='Submitted'),'in_review',0,'can_decide',public.bfe_can('livelihood','approve','association') AND public.bfe_can('livelihood','publish','association')));
 END IF;
$addition$||marker);
 EXECUTE replace(definition,body,changed);
END;$queue$;
NOTIFY pgrst,'reload schema'; COMMIT;
