-- Run this in the Supabase SQL editor AFTER schema.sql, migration_02, and
-- migration_03.
--
-- Adds:
--   1. Per-user editable water-goal settings (start hour, end hour, slot
--      count, calorie goal) so the schedule is no longer a fixed 9am-9pm
--      hourly grid for everyone.
--   2. A push_subscriptions table for real background push notifications
--      (see supabase/functions/send-reminders and migration_05_cron.sql).

alter table profiles add column if not exists water_start_hour int not null default 9;
alter table profiles add column if not exists water_end_hour int not null default 21;
alter table profiles add column if not exists water_slot_count int not null default 13;
alter table profiles add column if not exists calorie_goal int not null default 2000;
alter table profiles add column if not exists timezone text not null default 'Asia/Kolkata';

do $$
begin
  alter table profiles add constraint water_hours_valid
    check (
      water_start_hour >= 0 and water_start_hour <= 23 and
      water_end_hour >= 0 and water_end_hour <= 23 and
      water_end_hour >= water_start_hour
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table profiles add constraint water_slot_count_valid
    check (water_slot_count >= 1 and water_slot_count <= 48);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table profiles add constraint calorie_goal_valid
    check (calorie_goal >= 200 and calorie_goal <= 10000);
exception when duplicate_object then null;
end $$;

-- Push subscriptions: one row per browser/device the user has enabled push
-- notifications on (a user may have several — phone + laptop, say).
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "users manage own push subscriptions" on push_subscriptions;
create policy "users manage own push subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No "admins read all" policy needed: the send-reminders edge function
-- authenticates with the service-role key, which bypasses RLS entirely.
