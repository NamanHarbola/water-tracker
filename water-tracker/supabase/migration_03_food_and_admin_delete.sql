-- Run this in the Supabase SQL editor AFTER schema.sql (and migration_02).
-- Adds:
--   1. An optional food_name column so calorie entries can remember what was
--      logged (used by the new "search a food" calorie feature).
--   2. RLS policies letting admins delete logs + their storage clips, which
--      the admin panel's new "delete clip" button needs.

alter table calorie_logs add column if not exists food_name text;

-- Admins can delete any water-clip log row (e.g. after reviewing it).
create policy "admins delete logs"
  on logs for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Admins can delete the underlying video file from storage too.
create policy "admins delete clips"
  on storage.objects for delete
  using (
    bucket_id = 'water-clips' and
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
