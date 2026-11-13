INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES ('avatars','avatars',false,524288,ARRAY['image/png']) ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=524288,allowed_mime_types=ARRAY['image/png'];
CREATE POLICY ritmo_avatar_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='avatars');
CREATE POLICY ritmo_avatar_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid()::text));
CREATE POLICY ritmo_avatar_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='avatars' AND (storage.foldername(name))[1]=(SELECT auth.uid()::text));
