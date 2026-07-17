-- Run this in the Supabase SQL editor AFTER schema.sql, migration_02, and
-- migration_03.
--
-- Adds per-user editable water-goal settings (start hour, end hour, slot
-- count, calorie goal, timezone) so the schedule is no longer a fixed
-- 9am-9pm hourly grid for everyone.
--
-- (Push notifications are handled by OneSignal in this setup — see the
-- README's "Real push notifications" section — so there's no local
-- push_subscriptions table here; OneSignal tracks subscriptions on its
-- own servers, keyed to each user via OneSignal.login(userId).)

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
