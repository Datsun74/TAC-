-- «Задачник»: тимчасові проєкти всередині постійних просторів.
-- Виконуйте після tasks.sql, task-workspaces.sql та task-create-reliability.sql.
-- Простір (наприклад, «Дача») лишається постійним. Проєкт (наприклад,
-- «Будівництво дому») успадковує його доступи й може бути закритий.

begin;

create table if not exists public.task_projects (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete cascade,
  workspace_id uuid references public.task_workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  horizon text not null default 'tactical' check (horizon in ('strategic', 'operational', 'tactical')),
  status text not null default 'active' check (status in ('active', 'closed')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_by_name text not null check (char_length(btrim(created_by_name)) between 2 and 80),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint task_projects_scope_matches check (
    (family_id is not null and workspace_id is null)
    or (family_id is null and workspace_id is not null)
  ),
  constraint task_projects_closed_at_matches check (
    (status = 'active' and closed_at is null)
    or (status = 'closed' and closed_at is not null)
  )
);

alter table public.tasks
  add column if not exists project_id uuid references public.task_projects(id) on delete set null;

create index if not exists task_projects_scope_status_idx
  on public.task_projects (family_id, workspace_id, status, name);

create index if not exists tasks_project_status_due_idx
  on public.tasks (project_id, status, due_date asc nulls last, created_at desc);

alter table public.task_projects enable row level security;
revoke all on table public.task_projects from anon, authenticated;
grant select on table public.task_projects to authenticated;

drop policy if exists "task scope members can read projects" on public.task_projects;
create policy "task scope members can read projects"
  on public.task_projects for select to authenticated
  using (public.can_manage_task_scope(family_id, workspace_id));

create or replace function public.create_task_project(
  target_family_id uuid,
  target_workspace_id uuid,
  project_name text,
  project_horizon text,
  creator_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_project_id uuid;
begin
  if current_user_id is null then
    raise exception 'Sign-in is required.';
  end if;

  if (target_family_id is null and target_workspace_id is null)
    or (target_family_id is not null and target_workspace_id is not null) then
    raise exception 'Choose exactly one project space.';
  end if;

  if not public.can_manage_task_scope(target_family_id, target_workspace_id) then
    raise exception 'You are not an active member of this project space.';
  end if;

  if project_name is null or char_length(btrim(project_name)) not between 2 and 120 then
    raise exception 'Project name must contain 2 to 120 characters.';
  end if;

  if project_horizon not in ('strategic', 'operational', 'tactical') then
    raise exception 'Project planning level is invalid.';
  end if;

  if creator_display_name is null or char_length(btrim(creator_display_name)) not between 2 and 80 then
    raise exception 'Creator name must contain 2 to 80 characters.';
  end if;

  insert into public.task_projects (family_id, workspace_id, name, horizon, created_by, created_by_name)
  values (target_family_id, target_workspace_id, btrim(project_name), project_horizon, current_user_id, btrim(creator_display_name))
  returning id into new_project_id;

  return new_project_id;
end;
$$;

create or replace function public.set_task_project_status(
  target_project_id uuid,
  next_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Sign-in is required.';
  end if;

  if next_status not in ('active', 'closed') then
    raise exception 'Project status is invalid.';
  end if;

  update public.task_projects
  set status = next_status,
      closed_at = case when next_status = 'closed' then now() else null end
  where id = target_project_id
    and created_by = current_user_id
    and public.can_manage_task_scope(family_id, workspace_id);

  if not found then
    raise exception 'Project was not found or you cannot change it.';
  end if;
end;
$$;

create or replace function public.create_project_task_with_participants(
  target_project_id uuid,
  task_title text,
  task_goal text,
  task_area text,
  task_horizon text,
  task_due_date date,
  creator_display_name text,
  participant_user_ids uuid[] default array[]::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_family_id uuid;
  target_workspace_id uuid;
  project_status text;
  new_task_id uuid;
begin
  if current_user_id is null then
    raise exception 'Sign-in is required.';
  end if;

  select family_id, workspace_id, status
    into target_family_id, target_workspace_id, project_status
  from public.task_projects
  where id = target_project_id;

  if not found or project_status <> 'active' then
    raise exception 'Choose an active project.';
  end if;

  if not public.can_manage_task_scope(target_family_id, target_workspace_id) then
    raise exception 'You are not an active member of this project space.';
  end if;

  if task_title is null or char_length(btrim(task_title)) not between 2 and 160 then
    raise exception 'Task title must contain 2 to 160 characters.';
  end if;
  if creator_display_name is null or char_length(btrim(creator_display_name)) not between 2 and 80 then
    raise exception 'Creator name must contain 2 to 80 characters.';
  end if;
  if task_goal is not null and char_length(btrim(task_goal)) > 5000 then
    raise exception 'Task goal cannot exceed 5000 characters.';
  end if;
  if task_area not in ('work', 'family', 'personal') then
    raise exception 'Task area is invalid.';
  end if;
  if task_horizon not in ('strategic', 'operational', 'tactical') then
    raise exception 'Task planning level is invalid.';
  end if;
  if exists (
    select 1
    from unnest(coalesce(participant_user_ids, array[]::uuid[])) as participant(user_id)
    where not public.is_task_scope_member(target_family_id, target_workspace_id, participant.user_id)
  ) then
    raise exception 'Every participant must be an active member of the selected task space.';
  end if;

  insert into public.tasks (
    family_id, workspace_id, project_id, created_by, created_by_name,
    title, goal, area, horizon, due_date
  )
  values (
    target_family_id, target_workspace_id, target_project_id, current_user_id, btrim(creator_display_name),
    btrim(task_title), nullif(btrim(task_goal), ''), task_area, task_horizon, task_due_date
  )
  returning id into new_task_id;

  insert into public.task_participants (task_id, member_user_id, member_name)
  select
    new_task_id,
    participant.user_id,
    coalesce(family_member.display_name, workspace_member.display_name)
  from (
    select distinct user_id
    from unnest(coalesce(participant_user_ids, array[]::uuid[])) as participant_ids(user_id)
  ) as participant
  left join public.family_members as family_member
    on family_member.user_id = participant.user_id
    and family_member.family_id = target_family_id
    and family_member.is_active
  left join public.task_workspace_members as workspace_member
    on workspace_member.user_id = participant.user_id
    and workspace_member.workspace_id = target_workspace_id
    and workspace_member.is_active;

  return new_task_id;
end;
$$;

revoke all on function public.create_task_project(uuid, uuid, text, text, text) from public;
revoke all on function public.set_task_project_status(uuid, text) from public;
revoke all on function public.create_project_task_with_participants(uuid, text, text, text, text, date, text, uuid[]) from public;
grant execute on function public.create_task_project(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.set_task_project_status(uuid, text) to authenticated;
grant execute on function public.create_project_task_with_participants(uuid, text, text, text, text, date, text, uuid[]) to authenticated;

commit;
