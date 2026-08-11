-- Storage RLS policies for the private `visit-images` bucket.
--
-- The app uploads client-side (browser Supabase client, publishable key — subject to
-- RLS) under the path convention visits/{auth.uid()}/{visit_id}/... per
-- IMPLEMENTATION.md §4. Server-side re-hosting of YouCam results (lib/storage.js) uses
-- the secret key and bypasses RLS entirely, so these policies only govern client uploads
-- and any client-side reads.
--
-- Run this in the Supabase SQL editor. If you already have policies on storage.objects
-- for this bucket with a different path assumption, drop/adjust them first so they don't
-- conflict.

create policy "Users can upload own visit images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'visit-images'
  and (storage.foldername(name))[1] = 'visits'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Users can read own visit images"
on storage.objects for select
to authenticated
using (
  bucket_id = 'visit-images'
  and (storage.foldername(name))[1] = 'visits'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Users can update own visit images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'visit-images'
  and (storage.foldername(name))[1] = 'visits'
  and (storage.foldername(name))[2] = auth.uid()::text
);
