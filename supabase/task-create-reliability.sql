-- «Задачник»: надійне створення задачі разом з учасниками.
-- Виконуйте після supabase/tasks.sql та supabase/task-workspaces.sql.
-- Файл не змінює дані «Сімейних покупок».

begin;

create or replace function public.create_task_with_participants(
  target_family_id uuid,
  target_workspace_id uuid,
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
  new_task_id uuid;
begin
  if current_user_id is null then
    raise exception 'Sign-in is required.';
  end if;

  if (target_family_id is null and target_workspace_id is null)
    or (target_family_id is not null and target_workspace_id is not null) then
    raise exception 'Choose exactly one task space.';
  end if;

  if not public.can_manage_task_scope(target_family_id, target_workspace_id) then
    raise exception 'You are not an active member of this task space.';
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
    family_id,
    workspace_id,
    created_by,
    created_by_name,
    title,
    goal,
    area,
    horizon,
    due_date
  )
  values (
    target_family_id,
    target_workspace_id,
    current_user_id,
    btrim(creator_display_name),
    btrim(task_title),
    nullif(btrim(task_goal), ''),
    task_area,
    task_horizon,
    task_due_date
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

revoke all on function public.create_task_with_participants(uuid, uuid, text, text, text, text, date, text, uuid[]) from public;
grant execute on function public.create_task_with_participants(uuid, uuid, text, text, text, text, date, text, uuid[]) to authenticated;

commit;
