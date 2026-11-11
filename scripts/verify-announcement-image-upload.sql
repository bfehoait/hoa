-- Read-only diagnosis for the project owner in SQL Editor.
-- No account names, email addresses, image paths, tokens or content returned.
-- The candidate is the latest Submitted announcement with a prepared cover.
WITH candidate AS (
 SELECT r.owner_id,r.status,r.publication_consent,a.cover_path
 FROM public.bfe_feature_records r
 JOIN public.bfe_listing_assets a ON a.record_id=r.id
 WHERE r.module='publishing' AND r.status='Submitted' AND a.cover_path IS NOT NULL
 ORDER BY r.created_at DESC,r.id LIMIT 1
), functions AS (
 SELECT p.proname,p.oid,p.prosecdef,pg_get_functiondef(p.oid) AS definition
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN (
 'bfe_prepare_listing_cover','bfe_listing_visible','bfe_listing_object_access','bfe_listing_cover_uploaded')
)
SELECT jsonb_build_object(
 'bucket',(SELECT jsonb_build_object('private',NOT b.public,'size_limit',b.file_size_limit,'mime_types',b.allowed_mime_types) FROM storage.buckets b WHERE b.id='bfe-listing-covers'),
 'upload_trigger_enabled',EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='storage.objects'::regclass AND tgname='bfe_listing_cover_uploaded' AND tgenabled IN ('O','A')),
 'authenticated_storage_insert',has_table_privilege('authenticated','storage.objects','INSERT'),
 'authenticated_storage_select',has_table_privilege('authenticated','storage.objects','SELECT'),
 'functions',(SELECT jsonb_agg(jsonb_build_object('name',proname,'security_definer',prosecdef,'mentions_publishing',position('publishing' IN definition)>0,'mentions_community',position('community' IN definition)>0,'authenticated_execute',has_function_privilege('authenticated',oid,'EXECUTE')) ORDER BY proname) FROM functions),
 'storage_policies',(SELECT jsonb_agg(jsonb_build_object('name',policyname,'mode',permissive,'roles',roles,'command',cmd,'using',qual,'check',with_check) ORDER BY policyname) FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND cmd IN ('ALL','INSERT','SELECT')),
 'latest_prepared_announcement',(SELECT jsonb_build_object(
   'found',true,'status',c.status,'consent',c.publication_consent,
   'owner_active',cardinality(public.bfe_roles_for(c.owner_id))>0,
   'owner_can_create',public.bfe_can_for(c.owner_id,'community','create','own') OR public.bfe_can_for(c.owner_id,'community','create','association'),
   'owner_can_publish',public.bfe_can_for(c.owner_id,'community','publish','association'),
   'image_object_exists',EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='bfe-listing-covers' AND o.name=c.cover_path)
 ) FROM candidate c)
) AS announcement_image_check;
