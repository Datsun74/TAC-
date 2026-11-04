-- «Задачник»: робочі простори, працівники й робочі задачі.
-- Виконуйте після supabase/tasks.sql та, за потреби, tasks-status-in-work.sql.
-- Наявні сімейні задачі не переміщуються і залишаються сімейними.

begin;

do $$
begin
  create type public.task_workspace_role as enum ('owner', 'manager', 'worker');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.task_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.task_workspace_members (
  workspace_id uuid not null references public.task_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 80),
  role public.task_workspace_role not null default 'worker',
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.task_workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.task_workspaces(id) on delete cascade,
  code text not null unique default encode(gen_random_bytes(18), 'hex'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  constraint task_workspace_invites_acceptance_matches check (
    (accepted_by is null and accepted_at is null)
    or (accepted_by is not null and accepted_at is not null)
  )
);

create index if not exists task_workspace_members_user_idx
  on public.task_workspace_members (user_id, is_active);

create index if not exists task_workspace_invites_workspace_idx
  on public.task_workspace_invites (workspace_id, expires_at desc);

alter table public.tasks
  add column if not exists workspace_id uuid references public.task_workspaces(id) on delete cascade;

alter table public.tasks
  alter column family_id drop not null;

alter table public.tasks
  drop constraint if exists tasks_scope_matches;

alter table public.tasks
  add constraint tasks_scope_matches check (
    (family_id is not null and workspace_id is null)
    or (family_id is null and workspace_id is not null)
  );

alter table public.task_participants
  drop constraint if exists task_participants_member_user_id_fkey;

alter table public.task_participants
  add constraint task_participants_member_user_id_fkey
  foreign key (member_user_id) references auth.users(id) on delete cascade;

create index if not exists tasks_workspace_status_due_idx
  on public.tasks (workspace_id, status, due_date asc nulls last, created_at desc)
  where workspace_id is not null;

create or replace function public.is_active_task_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.task_workspace_members
    where workspace_id = target_workspace_id
      and user_id = (select auth.uid())
      and is_active
  );
$$;

create or replace function public.is_task_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.task_workspace_members
    where workspace_id = target_workspace_id
      and user_id = (select auth.uid())
      and is_active
      and role in ('owner', 'manager')
  );
$$;

create or replace function public.can_manage_task_scope(target_family_id uuid, target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    target_family_id is not null
    and target_workspace_id is null
    and public.is_active_family_member(target_family_id)
  )
  or (
    target_family_id is null
    and target_workspace_id is not null
    and public.is_active_task_workspace_member(target_workspace_id)
  );
$$;

create or replace function public.is_task_scope_member(target_family_id uuid, target_workspace_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members
    where target_family_id is not null
      and target_workspace_id is null
      and family_id = target_family_id
      and user_id = target_user_id
      and is_active
  )
  or exists (
    select 1
    from public.task_workspace_members
    where target_family_id is null
      and target_workspace_id is not null
      and workspace_id = target_workspace_id
      and user_id = target_user_id
      and is_active
  );
$$;

create or replace function public.can_access_task(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tasks
    where id = target_task_id
      and public.can_manage_task_scope(family_id, workspace_id)
      and (created_by = (select auth.uid()) or public.is_task_participant(id))
  );
$$;

create or replace function public.create_task_workspace(workspace_name text, display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_workspace_id uuid;
  normalized_workspace_name text := btrim(workspace_name);
  normalized_display_name text := btrim(display_name);
begin
  if current_user_id is null then raise exception 'Sign-in is required.'; end if;
  if char_length(normalized_workspace_name) not between 2 and 80 then raise exception 'Workspace name must contain 2 to 80 characters.'; end if;
  if char_length(normalized_display_name) not between 2 and 80 then raise exception 'Display name must contain 2 to 80 characters.'; end if;

  insert into public.task_workspaces (name, owner_user_id)
  values (normalized_workspace_name, current_user_id)
  returning id into new_workspace_id;

  insert into public.task_workspace_members (workspace_id, user_id, display_name, role, is_active)
  values (new_workspace_id, current_user_id, normalized_display_name, 'owner', true);

  return new_workspace_id;
end;
$$;

create or replace function public.create_task_workspace_invite(target_workspace_id uuid)
returns table (code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign-in is required.'; end if;
  if not public.is_task_workspace_admin(target_workspace_id) then raise exception 'Only an owner or manager can invite workers.'; end if;

  return query
  insert into public.task_workspace_invites (workspace_id, created_by)
  values (target_workspace_id, auth.uid())
  returning task_workspace_invites.code, task_workspace_invites.expires_at;
end;
$$;

create or replace function public.accept_task_workspace_invite(invite_code text, display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  invite_record public.task_workspace_invites%rowtype;
  normalized_code text := btrim(invite_code);
  normalized_display_name text := btrim(display_name);
begin
  if current_user_id is null then raise exception 'Sign-in is required.'; end if;
  if char_length(normalized_display_name) not between 2 and 80 then raise exception 'Display name must contain 2 to 80 characters.'; end if;

  select * into invite_record
  from public.task_workspace_invites
  where code = normalized_code and accepted_at is null and expires_at > now()
  for update;

  if not found then raise exception 'The invitation code is invalid, used, or expired.'; end if;
  if exists (select 1 from public.task_workspace_members where workspace_id = invite_record.workspace_id and user_id = current_user_id) then raise exception 'This user already belongs to this workspace.'; end if;

  insert into public.task_workspace_members (workspace_id, user_id, display_name, role, is_active)
  values (invite_record.workspace_id, current_user_id, normalized_display_name, 'worker', true);

  update public.task_workspace_invites
  set accepted_by = current_user_id, accepted_at = now()
  where id = invite_record.id;

  return invite_record.workspace_id;
end;
$$;

create or replace function public.set_task_workspace_member_role(target_workspace_id uuid, target_user_id uuid, next_role public.task_workspace_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign-in is required.'; end if;
  if not exists (
    select 1
    from public.task_workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and is_active
      and role = 'owner'
  ) then raise exception 'Only the owner can change roles.'; end if;
  if next_role not in ('manager', 'worker') then raise exception 'The owner role cannot be assigned here.'; end if;

  update public.task_workspace_members
  set role = next_role
  where workspace_id = target_workspace_id
    and user_id = target_user_id
    and role <> 'owner';

  if not found then raise exception 'Member was not found or is the owner.'; end if;
end;
$$;

revoke all on function public.is_active_task_workspace_member(uuid) from public;
revoke all on function public.is_task_workspace_admin(uuid) from public;
revoke all on function public.can_manage_task_scope(uuid, uuid) from public;
revoke all on function public.is_task_scope_member(uuid, uuid, uuid) from public;
revoke all on function public.create_task_workspace(text, text) from public;
revoke all on function public.create_task_workspace_invite(uuid) from public;
revoke all on function public.accept_task_workspace_invite(text, text) from public;
revoke all on function public.set_task_workspace_member_role(uuid, uuid, public.task_workspace_role) from public;
grant execute on function public.is_active_task_workspace_member(uuid) to authenticated;
grant execute on function public.is_task_workspace_admin(uuid) to authenticated;
grant execute on function public.can_manage_task_scope(uuid, uuid) to authenticated;
grant execute on function public.is_task_scope_member(uuid, uuid, uuid) to authenticated;
grant execute on function public.create_task_workspace(text, text) to authenticated;
grant execute on function public.create_task_workspace_invite(uuid) to authenticated;
grant execute on function public.accept_task_workspace_invite(text, text) to authenticated;
grant execute on function public.set_task_workspace_member_role(uuid, uuid, public.task_workspace_role) to authenticated;

alter table public.task_workspaces enable row level security;
alter table public.task_workspace_members enable row level security;
alter table public.task_workspace_invites enable row level security;

revoke all on table public.task_workspaces from anon, authenticated;
revoke all on table public.task_workspace_members from anon, authenticated;
revoke all on table public.task_workspace_invites from anon, authenticated;
grant select on table public.task_workspaces to authenticated;
grant select on table public.task_workspace_members to authenticated;

drop policy if exists "workspace members can read their workspace" on public.task_workspaces;
drop policy if exists "workspace members can read members" on public.task_workspace_members;
create policy "workspace members can read their workspace"
  on public.task_workspaces for select to authenticated
  using (public.is_active_task_workspace_member(id));
create policy "workspace members can read members"
  on public.task_workspace_members for select to authenticated
  using (public.is_active_task_workspace_member(workspace_id));

revoke all on table public.tasks from anon, authenticated;
revoke all on table public.task_participants from anon, authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, delete on table public.task_participants to authenticated;

drop policy if exists "task participants can read their tasks" on public.tasks;
drop policy if exists "family members can create tasks" on public.tasks;
drop policy if exists "task participants can update their tasks" on public.tasks;
drop policy if exists "task creators can delete their tasks" on public.tasks;
create policy "task participants can read their tasks"
  on public.tasks for select to authenticated
  using (public.can_access_task(id));
create policy "task scope members can create tasks"
  on public.tasks for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.can_manage_task_scope(family_id, workspace_id)
  );
create policy "task participants can update their tasks"
  on public.tasks for update to authenticated
  using (public.can_access_task(id))
  with check (public.can_manage_task_scope(family_id, workspace_id));
create policy "task creators can delete their tasks"
  on public.tasks for delete to authenticated
  using (created_by = (select auth.uid()));

drop policy if exists "task participants can read task participants" on public.task_participants;
drop policy if exists "task creators can add participants" on public.task_participants;
drop policy if exists "task creators can remove participants" on public.task_participants;
create policy "task participants can read task participants"
  on public.task_participants for select to authenticated
  using (public.can_access_task(task_id));
create policy "task scope members can add participants"
  on public.task_participants for insert to authenticated
  with check (
    public.can_access_task(task_id)
    and exists (
      select 1
      from public.tasks as task
      where task.id = task_participants.task_id
        and public.is_task_scope_member(task.family_id, task.workspace_id, task_participants.member_user_id)
    )
  );
create policy "task creators can remove participants"
  on public.task_participants for delete to authenticated
  using (public.can_access_task(task_id));

commit;
