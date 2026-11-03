-- «Задачник»: виконайте цей файл у Supabase SQL Editor ПІСЛЯ
-- family-access.sql та family-spaces-and-rejected.sql.
-- Він не змінює і не видаляє наявні покупки.

begin;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_by_name text not null check (char_length(btrim(created_by_name)) between 2 and 80),
  title text not null check (char_length(btrim(title)) between 2 and 160),
  goal text check (goal is null or char_length(btrim(goal)) <= 5000),
  area text not null check (area in ('work', 'family', 'personal')),
  horizon text not null check (horizon in ('strategic', 'operational', 'tactical')),
  due_date date,
  status text not null default 'active' check (status in ('active', 'in_progress', 'completed', 'rejected', 'postponed')),
  postponed_until date,
  completed_by text check (completed_by is null or char_length(btrim(completed_by)) between 2 and 80),
  completed_at timestamptz,
  rejected_by text check (rejected_by is null or char_length(btrim(rejected_by)) between 2 and 80),
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  constraint tasks_status_metadata_matches check (
    (status = 'active' and postponed_until is null and completed_by is null and completed_at is null and rejected_by is null and rejected_at is null)
    or (status = 'in_progress' and postponed_until is null and completed_by is null and completed_at is null and rejected_by is null and rejected_at is null)
    or (status = 'postponed' and postponed_until is not null and completed_by is null and completed_at is null and rejected_by is null and rejected_at is null)
    or (status = 'completed' and postponed_until is null and completed_by is not null and completed_at is not null and rejected_by is null and rejected_at is null)
    or (status = 'rejected' and postponed_until is null and completed_by is null and completed_at is null and rejected_by is not null and rejected_at is not null)
  )
);

create table if not exists public.task_participants (
  task_id uuid not null references public.tasks(id) on delete cascade,
  member_user_id uuid not null references public.family_members(user_id) on delete cascade,
  member_name text not null check (char_length(btrim(member_name)) between 2 and 80),
  added_at timestamptz not null default now(),
  primary key (task_id, member_user_id)
);

create index if not exists tasks_family_status_due_idx
  on public.tasks (family_id, status, due_date asc nulls last, created_at desc);

create index if not exists task_participants_member_idx
  on public.task_participants (member_user_id, task_id);

create or replace function public.is_task_participant(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.task_participants
    where task_id = target_task_id
      and member_user_id = (select auth.uid())
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
      and public.is_active_family_member(family_id)
      and (created_by = (select auth.uid()) or public.is_task_participant(id))
  );
$$;

revoke all on function public.is_task_participant(uuid) from public;
revoke all on function public.can_access_task(uuid) from public;
grant execute on function public.is_task_participant(uuid) to authenticated;
grant execute on function public.can_access_task(uuid) to authenticated;

alter table public.tasks enable row level security;
alter table public.task_participants enable row level security;

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
  using (
    public.is_active_family_member(family_id)
    and (created_by = (select auth.uid()) or public.is_task_participant(id))
  );
create policy "family members can create tasks"
  on public.tasks for insert to authenticated
  with check (
    public.is_active_family_member(family_id)
    and created_by = (select auth.uid())
  );
create policy "task participants can update their tasks"
  on public.tasks for update to authenticated
  using (
    public.is_active_family_member(family_id)
    and (created_by = (select auth.uid()) or public.is_task_participant(id))
  )
  with check (public.is_active_family_member(family_id));
create policy "task creators can delete their tasks"
  on public.tasks for delete to authenticated
  using (created_by = (select auth.uid()));

drop policy if exists "task participants can read task participants" on public.task_participants;
drop policy if exists "task creators can add participants" on public.task_participants;
drop policy if exists "task creators can remove participants" on public.task_participants;
create policy "task participants can read task participants"
  on public.task_participants for select to authenticated
  using (public.can_access_task(task_id));
create policy "task creators can add participants"
  on public.task_participants for insert to authenticated
  with check (
    public.can_access_task(task_id)
    and exists (
      select 1
      from public.tasks as task
      join public.family_members as member on member.family_id = task.family_id
      where task.id = task_participants.task_id
        and member.user_id = task_participants.member_user_id
        and member.is_active
    )
  );
create policy "task creators can remove participants"
  on public.task_participants for delete to authenticated
  using (public.can_access_task(task_id));

commit;
