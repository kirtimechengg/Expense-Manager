-- =====================================================================
-- Wallet — receipt photos (run AFTER 0001_wallet_sync.sql)
-- Dashboard → SQL Editor → New query → paste → Run. Safe to re-run.
-- =====================================================================

-- Which photo belongs to a transaction: "<transaction id>/<file>.jpg" ('' = no photo).
alter table public.transactions add column if not exists receipt_path text not null default '';

-- Private bucket. Files are stored as "<household id>/<transaction id>/<file>.jpg".
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- "May the signed-in user access this file?" → only if they belong to the household in the first folder.
create or replace function public.can_access_receipt(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return public.is_household_member(split_part(object_name, '/', 1)::uuid);
exception when others then
  return false; -- first folder isn't a valid household id
end;
$$;

revoke all on function public.can_access_receipt(text) from public, anon;
grant execute on function public.can_access_receipt(text) to authenticated;

drop policy if exists "household members read receipts" on storage.objects;
create policy "household members read receipts" on storage.objects
  for select to authenticated using (bucket_id = 'receipts' and public.can_access_receipt(name));

drop policy if exists "household members upload receipts" on storage.objects;
create policy "household members upload receipts" on storage.objects
  for insert to authenticated with check (bucket_id = 'receipts' and public.can_access_receipt(name));

drop policy if exists "household members replace receipts" on storage.objects;
create policy "household members replace receipts" on storage.objects
  for update to authenticated using (bucket_id = 'receipts' and public.can_access_receipt(name))
  with check (bucket_id = 'receipts' and public.can_access_receipt(name));

drop policy if exists "household members delete receipts" on storage.objects;
create policy "household members delete receipts" on storage.objects
  for delete to authenticated using (bucket_id = 'receipts' and public.can_access_receipt(name));
