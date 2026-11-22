-- =====================================================================
-- Wallet — family sync schema
-- Run this ONCE in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run: everything uses "if not exists" / "create or replace".
-- =====================================================================

-- ---------- Households & members ----------

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null default '',
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
-- A person belongs to at most one household (keeps the app simple).
create unique index if not exists household_members_one_per_user on public.household_members (user_id);

create table if not exists public.household_invites (
  code text primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz
);

-- "Is the signed-in user a member of this household?"  (security definer avoids RLS recursion)
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = (select auth.uid())
  );
$$;

-- ---------- Synced data (mirrors the app's local SQLite tables) ----------

create table if not exists public.categories (
  household_id uuid not null references public.households (id) on delete cascade,
  id text not null,
  name text not null,
  kind text not null check (kind in ('expense', 'income', 'investment')),
  icon text not null,
  color text not null,
  sort_order integer not null default 0,
  updated_at timestamptz not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (household_id, id)
);

create table if not exists public.transactions (
  household_id uuid not null references public.households (id) on delete cascade,
  id text not null,
  type text not null check (type in ('expense', 'income', 'investment')),
  amount numeric(14, 2) not null check (amount >= 0),
  category_id text not null,
  date date not null,
  note text not null default '',
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (household_id, id)
);

create table if not exists public.budgets (
  household_id uuid not null references public.households (id) on delete cascade,
  category_id text not null,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  remark text not null default '',
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (household_id, category_id, month)
);

create index if not exists categories_pull on public.categories (household_id, server_updated_at);
create index if not exists transactions_pull on public.transactions (household_id, server_updated_at);
create index if not exists budgets_pull on public.budgets (household_id, server_updated_at);

-- "Last writer wins": an incoming change that is OLDER than what the server has is ignored,
-- but the row is touched so the sending device pulls the newer version back.
create or replace function public.wallet_sync_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.household_id <> old.household_id then
      raise exception 'household_id cannot change';
    end if;
    if new.updated_at < old.updated_at then
      new := old;
    end if;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists categories_stamp on public.categories;
create trigger categories_stamp before insert or update on public.categories
  for each row execute function public.wallet_sync_stamp();
drop trigger if exists transactions_stamp on public.transactions;
create trigger transactions_stamp before insert or update on public.transactions
  for each row execute function public.wallet_sync_stamp();
drop trigger if exists budgets_stamp on public.budgets;
create trigger budgets_stamp before insert or update on public.budgets
  for each row execute function public.wallet_sync_stamp();

-- ---------- Row Level Security: only household members can see or change data ----------

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

drop policy if exists "members read household" on public.households;
create policy "members read household" on public.households
  for select to authenticated using (public.is_household_member(id));

drop policy if exists "members rename household" on public.households;
create policy "members rename household" on public.households
  for update to authenticated using (public.is_household_member(id)) with check (public.is_household_member(id));

drop policy if exists "members read members" on public.household_members;
create policy "members read members" on public.household_members
  for select to authenticated using (public.is_household_member(household_id));

drop policy if exists "members read invites" on public.household_invites;
create policy "members read invites" on public.household_invites
  for select to authenticated using (public.is_household_member(household_id));

do $$
declare t text;
begin
  foreach t in array array['categories', 'transactions', 'budgets'] loop
    execute format('drop policy if exists "members read" on public.%I', t);
    execute format('create policy "members read" on public.%I for select to authenticated using (public.is_household_member(household_id))', t);
    execute format('drop policy if exists "members insert" on public.%I', t);
    execute format('create policy "members insert" on public.%I for insert to authenticated with check (public.is_household_member(household_id))', t);
    execute format('drop policy if exists "members update" on public.%I', t);
    execute format('create policy "members update" on public.%I for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))', t);
    -- No delete policy: the app "soft deletes" (deleted = true) so other devices learn about it.
  end loop;
end $$;

-- Membership changes only happen through the functions below.
revoke all on public.households, public.household_members, public.household_invites,
  public.categories, public.transactions, public.budgets from anon;
grant select, update on public.households to authenticated;
grant select on public.household_members, public.household_invites to authenticated;
grant select, insert, update on public.categories, public.transactions, public.budgets to authenticated;

-- ---------- Functions the app calls ----------

-- Create a household and become its owner.
create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  hid uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'You are already in a household. Leave it first.';
  end if;
  insert into public.households (name, created_by)
    values (coalesce(nullif(trim(household_name), ''), 'Our household'), uid)
    returning id into hid;
  insert into public.household_members (household_id, user_id, email, role)
    values (hid, uid, coalesce((select auth.jwt()) ->> 'email', ''), 'owner');
  return hid;
end;
$$;

-- Make a one-time invite code (valid 7 days) for your household.
create or replace function public.create_invite()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  hid uuid;
  new_code text;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I to avoid typos
  i int;
begin
  select household_id into hid from public.household_members where user_id = uid;
  if hid is null then raise exception 'You are not in a household.'; end if;
  loop
    new_code := '';
    for i in 1..8 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.household_invites where code = new_code);
  end loop;
  insert into public.household_invites (code, household_id, created_by) values (new_code, hid, uid);
  return new_code;
end;
$$;

-- Join a household with an invite code.
create or replace function public.join_household(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  inv public.household_invites%rowtype;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'You are already in a household. Leave it first.';
  end if;
  select * into inv from public.household_invites
    where code = upper(replace(trim(invite_code), ' ', ''))
    for update;
  if not found or inv.used_by is not null or inv.expires_at < now() then
    raise exception 'This invite code is invalid or has expired.';
  end if;
  update public.household_invites set used_by = uid, used_at = now() where code = inv.code;
  insert into public.household_members (household_id, user_id, email, role)
    values (inv.household_id, uid, coalesce((select auth.jwt()) ->> 'email', ''), 'member');
  return inv.household_id;
end;
$$;

-- Leave your household. If you were the last member, the household and its data are deleted.
-- If the owner leaves, the longest-standing member becomes owner.
create or replace function public.leave_household()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  hid uuid;
  was_owner boolean;
begin
  select household_id, role = 'owner' into hid, was_owner from public.household_members where user_id = uid;
  if hid is null then return; end if;
  delete from public.household_members where household_id = hid and user_id = uid;
  if not exists (select 1 from public.household_members where household_id = hid) then
    delete from public.households where id = hid;
  elsif was_owner then
    update public.household_members set role = 'owner'
      where household_id = hid
        and user_id = (select user_id from public.household_members where household_id = hid order by joined_at limit 1);
  end if;
end;
$$;

-- Owner removes another member.
create or replace function public.remove_member(member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  hid uuid;
begin
  select household_id into hid from public.household_members where user_id = uid and role = 'owner';
  if hid is null then raise exception 'Only the household owner can remove members.'; end if;
  if member_id = uid then raise exception 'Use "Leave household" to remove yourself.'; end if;
  delete from public.household_members where household_id = hid and user_id = member_id;
end;
$$;

revoke all on function public.create_household(text), public.create_invite(), public.join_household(text),
  public.leave_household(), public.remove_member(uuid), public.is_household_member(uuid) from public, anon;
grant execute on function public.create_household(text), public.create_invite(), public.join_household(text),
  public.leave_household(), public.remove_member(uuid), public.is_household_member(uuid) to authenticated;
