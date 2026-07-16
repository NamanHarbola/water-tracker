-- Run this in the Supabase SQL editor AFTER schema.sql.
-- Adds display name + avatar support for the profile screen.

alter table profiles add column if not exists full_name text;
alter table profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- avatars bucket is public-read (so <img> tags just work), but only the
-- owner can upload/replace their own file, named <user_id>.<ext>
create policy "anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users upload own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users replace own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
