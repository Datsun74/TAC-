-- Run this complete file once in Supabase SQL Editor after schema.sql and family-access.sql.
-- It keeps all existing purchases and assigns them to one initial family space.
-- The text casts below let this run as a single Supabase SQL Editor query.

alter type public.list_item_status add value if not exists 'rejected';

do $$
begin
  create type public.family_member_role as enum ('owner', 'member');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  owner_user_id uuid not null unique references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.family_members
  add column if not exists family_id uuid references public.families(id) on delete cascade,
  add column if not exists role public.family_member_role not null default 'member';

alter table public.shopping_items
  add column if not exists family_id uuid references public.families(id) on delete cascade,
  add column if not exists rejected_by text check (rejected_by is null or char_length(btrim(rejected_by)) between 2 and 80),
  add column if not exists rejected_at timestamptz;

do $$
declare
  old_owner_id uuid;
  current_family_id uuid;
begin
  if exists (select 1 from public.family_members where family_id is null) then
    select user_id
      into old_owner_id
      from public.family_members
      where family_id is null
      order by joined_at, user_id
      limit 1;

    if old_owner_id is null then
      raise exception 'No user was found for the existing shopping list.';
    end if;

    select id into current_family_id
      from public.families
      where owner_user_id = old_owner_id;

    if current_family_id is null then
      insert into public.families (name, owner_user_id)
      values ('Моя сім''я', old_owner_id)
      returning id into current_family_id;
    end if;

    update public.family_members
      set family_id = current_family_id,
          role = case when user_id = old_owner_id then 'owner'::public.family_member_role else 'member'::public.family_member_role end
      where family_id is null;

    update public.shopping_items
      set family_id = current_family_id
      where family_id is null;
  end if;
end
$$;

alter table public.family_members alter column family_id set not null;
alter table public.shopping_items alter column family_id set not null;

update public.family_members as member
  set role = 'owner'
  from public.families as family
  where family.owner_user_id = member.user_id
    and family.id = member.family_id;

alter table public.shopping_items
  drop constraint if exists shopping_items_purchase_metadata_matches_status,
  drop constraint if exists shopping_items_purchased_after_creation,
  drop constraint if exists shopping_items_status_metadata_matches_status,
  drop constraint if exists shopping_items_rejected_after_creation,
  add constraint shopping_items_status_metadata_matches_status check (
    (status::text = 'active' and purchased_by is null and purchased_at is null and rejected_by is null and rejected_at is null)
    or (status::text = 'purchased' and purchased_by is not null and purchased_at is not null and rejected_by is null and rejected_at is null)
    or (status::text = 'rejected' and purchased_by is null and purchased_at is null and rejected_by is not null and rejected_at is not null)
  ),
  add constraint shopping_items_purchased_after_creation check (purchased_at is null or purchased_at >= created_at),
  add constraint shopping_items_rejected_after_creation check (rejected_at is null or rejected_at >= created_at);

create index if not exists shopping_items_family_active_browse_idx
  on public.shopping_items (family_id, category, store_section, created_at desc)
  where status::text = 'active';

create index if not exists shopping_items_family_purchased_history_idx
  on public.shopping_items (family_id, purchased_at desc)
  where status::text = 'purchased';

create index if not exists shopping_items_family_rejected_history_idx
  on public.shopping_items (family_id, rejected_at desc)
  where status::text = 'rejected';

create table if not exists public.family_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  code text not null unique default encode(gen_random_bytes(18), 'hex'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  accepted_by uuid unique references auth.users(id) on delete set null,
  accepted_at timestamptz,
  constraint family_invites_acceptance_matches check (
    (accepted_by is null and accepted_at is null)
    or (accepted_by is not null and accepted_at is not null)
  )
);

create or replace function public.is_active_family_member(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members
    where user_id = (select auth.uid())
      and family_id = target_family_id
      and is_active
  );
$$;

create or replace function public.is_family_owner(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members
    where user_id = (select auth.uid())
      and family_id = target_family_id
      and is_active
      and role = 'owner'
  );
$$;

create or replace function public.create_family_space(family_name text, display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_family_id uuid;
  normalized_family_name text := btrim(family_name);
  normalized_display_name text := btrim(display_name);
begin
  if current_user_id is null then raise exception 'Sign-in is required.'; end if;
  if char_length(normalized_family_name) not between 2 and 80 then raise exception 'Family name must contain 2 to 80 characters.'; end if;
  if char_length(normalized_display_name) not between 2 and 80 then raise exception 'Display name must contain 2 to 80 characters.'; end if;
  if exists (select 1 from public.family_members where user_id = current_user_id) then raise exception 'This user already belongs to a family space.'; end if;

  insert into public.families (name, owner_user_id)
  values (normalized_family_name, current_user_id)
  returning id into new_family_id;

  insert into public.family_members (user_id, family_id, display_name, role, is_active)
  values (current_user_id, new_family_id, normalized_display_name, 'owner', true);

  return new_family_id;
end;
$$;

create or replace function public.accept_family_invite(invite_code text, display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  invite_record public.family_invites%rowtype;
  normalized_code text := btrim(invite_code);
  normalized_display_name text := btrim(display_name);
begin
  if current_user_id is null then raise exception 'Sign-in is required.'; end if;
  if char_length(normalized_display_name) not between 2 and 80 then raise exception 'Display name must contain 2 to 80 characters.'; end if;
  if exists (select 1 from public.family_members where user_id = current_user_id) then raise exception 'This user already belongs to a family space.'; end if;

  select * into invite_record
    from public.family_invites
    where code = normalized_code and accepted_at is null and expires_at > now()
    for update;

  if not found then raise exception 'The invitation code is invalid, used, or expired.'; end if;

  insert into public.family_members (user_id, family_id, display_name, role, is_active)
  values (current_user_id, invite_record.family_id, normalized_display_name, 'member', true);

  update public.family_invites
    set accepted_by = current_user_id, accepted_at = now()
    where id = invite_record.id;

  return invite_record.family_id;
end;
$$;

revoke all on function public.is_active_family_member(uuid) from public;
revoke all on function public.is_family_owner(uuid) from public;
revoke all on function public.create_family_space(text, text) from public;
revoke all on function public.accept_family_invite(text, text) from public;
grant execute on function public.is_active_family_member(uuid) to authenticated;
grant execute on function public.is_family_owner(uuid) to authenticated;
grant execute on function public.create_family_space(text, text) to authenticated;
grant execute on function public.accept_family_invite(text, text) to authenticated;

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;
alter table public.shopping_items enable row level security;

revoke all on table public.families from anon, authenticated;
revoke all on table public.family_members from anon, authenticated;
revoke all on table public.family_invites from anon, authenticated;
revoke all on table public.shopping_items from anon, authenticated;

grant select on table public.families to authenticated;
grant select on table public.family_members to authenticated;
grant select, insert on table public.family_invites to authenticated;
grant select, insert, update, delete on table public.shopping_items to authenticated;

drop policy if exists "family members can view only their own profile" on public.family_members;
drop policy if exists "active family members can view family profile" on public.family_members;
create policy "active family members can view family profile"
  on public.family_members for select to authenticated
  using (public.is_active_family_member(family_id));

drop policy if exists "family members can view their family" on public.families;
create policy "family members can view their family"
  on public.families for select to authenticated
  using (public.is_active_family_member(id));

drop policy if exists "family owners can view invites" on public.family_invites;
drop policy if exists "family owners can create invites" on public.family_invites;
create policy "family owners can view invites"
  on public.family_invites for select to authenticated
  using (public.is_family_owner(family_id));
create policy "family owners can create invites"
  on public.family_invites for insert to authenticated
  with check (public.is_family_owner(family_id) and created_by = (select auth.uid()) and accepted_at is null and accepted_by is null);

drop policy if exists "approved family members can read shopping items" on public.shopping_items;
drop policy if exists "approved family members can add shopping items" on public.shopping_items;
drop policy if exists "approved family members can update shopping items" on public.shopping_items;
drop policy if exists "approved family members can delete shopping items" on public.shopping_items;
drop policy if exists "family members can read their shopping items" on public.shopping_items;
drop policy if exists "family members can add their shopping items" on public.shopping_items;
drop policy if exists "family members can update their shopping items" on public.shopping_items;
drop policy if exists "family members can delete their shopping items" on public.shopping_items;

create policy "family members can read their shopping items"
  on public.shopping_items for select to authenticated
  using (public.is_active_family_member(family_id));
create policy "family members can add their shopping items"
  on public.shopping_items for insert to authenticated
  with check (public.is_active_family_member(family_id));
create policy "family members can update their shopping items"
  on public.shopping_items for update to authenticated
  using (public.is_active_family_member(family_id))
  with check (public.is_active_family_member(family_id));
create policy "family members can delete their shopping items"
  on public.shopping_items for delete to authenticated
  using (public.is_active_family_member(family_id));
