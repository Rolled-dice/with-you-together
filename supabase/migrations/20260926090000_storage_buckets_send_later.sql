-- Ensure storage buckets exist on a fresh (self-owned) project and add the
-- `send-later` bucket used for scheduled voice/video messages.
--
-- The `prescriptions` bucket's object RLS policies already exist in earlier
-- migrations (20260722070558, 20260913085112); this migration only guarantees
-- the bucket row itself is present when replaying migrations into a new project
-- (Lovable had created it via the dashboard, so it was not in a migration).
--
-- The `send-later` bucket is new here. Media is uploaded server-side with the
-- service-role client and played back via server-generated signed URLs, but we
-- still add owner-scoped policies so the bucket is safe if accessed directly.

-- 1) Buckets (idempotent). Both are private.
insert into storage.buckets (id, name, public)
values ('prescriptions', 'prescriptions', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('send-later', 'send-later', false)
on conflict (id) do nothing;

-- 2) send-later object policies: owner is the first path segment (the uploader's
--    user id), matching the `send-later/<userId>/<uuid>.<ext>` key scheme.
drop policy if exists "Users upload own send-later media" on storage.objects;
create policy "Users upload own send-later media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'send-later'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users read own send-later media" on storage.objects;
create policy "Users read own send-later media"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'send-later'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete own send-later media" on storage.objects;
create policy "Users delete own send-later media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'send-later'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
