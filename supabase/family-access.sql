-- Закритий доступ для однієї сім'ї.
-- Запустіть цей файл у Supabase SQL Editor після schema.sql.

begin;

create table if not exists public.family_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 80),
  is_active boolean not null default true,
  joined_at timestamptz not null default now()
);

comment on table public.family_members is
  'Закритий список дозволених членів сім’ї. Email зберігається лише в Supabase Auth і не потрапляє до покупок.';
comment on column public.family_members.display_name is
  'Видиме ім’я в інтерфейсі, наприклад Сергій.';

alter table public.family_members enable row level security;

revoke all on table public.family_members from anon, authenticated;
grant select on table public.family_members to authenticated;

drop policy if exists "family members can view only their own profile" on public.family_members;
create policy "family members can view only their own profile"
  on public.family_members
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.shopping_items from anon, authenticated;
grant select, insert, update, delete on table public.shopping_items to authenticated;

drop policy if exists "approved family members can read shopping items" on public.shopping_items;
drop policy if exists "approved family members can add shopping items" on public.shopping_items;
drop policy if exists "approved family members can update shopping items" on public.shopping_items;
drop policy if exists "approved family members can delete shopping items" on public.shopping_items;

create policy "approved family members can read shopping items"
  on public.shopping_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.family_members
      where family_members.user_id = (select auth.uid())
        and family_members.is_active
    )
  );

create policy "approved family members can add shopping items"
  on public.shopping_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.family_members
      where family_members.user_id = (select auth.uid())
        and family_members.is_active
    )
  );

create policy "approved family members can update shopping items"
  on public.shopping_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.family_members
      where family_members.user_id = (select auth.uid())
        and family_members.is_active
    )
  )
  with check (
    exists (
      select 1
      from public.family_members
      where family_members.user_id = (select auth.uid())
        and family_members.is_active
    )
  );

create policy "approved family members can delete shopping items"
  on public.shopping_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.family_members
      where family_members.user_id = (select auth.uid())
        and family_members.is_active
    )
  );

commit;
