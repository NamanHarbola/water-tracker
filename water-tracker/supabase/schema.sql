-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)

-- 1. Profiles: one row per auth user, tells the app who's an admin
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- auto-create a profile row whenever someone signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Logs: one row per uploaded water-break clip
create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  slot_id text not null,
  video_path text not null,
  uploaded_at timestamptz not null default now(),
  reviewed boolean not null default false
);

-- 3. Calorie logs
create table if not exists calorie_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  calories integer not null,
  logged_at timestamptz not null default now()
);

-- Row Level Security
alter table profiles enable row level security;
alter table logs enable row level security;
alter table calorie_logs enable row level security;

-- profiles: everyone signed in can read profiles (needed so the admin
-- panel can show names); users can only update their own row
create policy "profiles are readable by signed-in users"
  on profiles for select using (auth.role() = 'authenticated');
create policy "users update own profile"
  on profiles for update using (auth.uid() = id);

-- logs: users can insert/read their own; admins can read + update all
create policy "users insert own logs"
  on logs for insert with check (auth.uid() = user_id);
create policy "users read own logs"
  on logs for select using (auth.uid() = user_id);
create policy "admins read all logs"
  on logs for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "admins update all logs"
  on logs for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- calorie_logs: users manage their own; admins can read all
create policy "users insert own calories"
  on calorie_logs for insert with check (auth.uid() = user_id);
create policy "users read own calories"
  on calorie_logs for select using (auth.uid() = user_id);
create policy "admins read all calories"
  on calorie_logs for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- 4. Storage bucket for video clips (run once)
insert into storage.buckets (id, name, public)
values ('water-clips', 'water-clips', false)
on conflict (id) do nothing;

create policy "users upload own clips"
  on storage.objects for insert
  with check (bucket_id = 'water-clips' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users read own clips"
  on storage.objects for select
  using (bucket_id = 'water-clips' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "admins read all clips"
  on storage.objects for select
  using (
    bucket_id = 'water-clips' and
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- 5. After running this once, make yourself admin manually:
-- update profiles set role = 'admin' where email = 'you@example.com';
