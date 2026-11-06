-- «Задачник»: м'яке вимкнення робочого простору без видалення даних.
-- Виконуйте після supabase/task-workspaces.sql.

begin;

alter table public.task_workspaces
  add column if not exists status text not null default 'active';

alter table public.task_workspaces
  drop constraint if exists task_workspaces_status_check;

alter table public.task_workspaces
  add constraint task_workspaces_status_check
  check (status in ('active', 'test'));

create index if not exists task_workspaces_status_idx
  on public.task_workspaces (status, created_at desc);

create or replace function public.set_task_workspace_status(target_workspace_id uuid, next_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_status text := lower(btrim(next_status));
begin
  if auth.uid() is null then raise exception 'Sign-in is required.'; end if;
  if normalized_status not in ('active', 'test') then raise exception 'Unsupported workspace status.'; end if;

  if not exists (
    select 1
    from public.task_workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and is_active
      and role = 'owner'
  ) then raise exception 'Only the owner can change the workspace status.'; end if;

  update public.task_workspaces
  set status = normalized_status
  where id = target_workspace_id;

  if not found then raise exception 'Workspace was not found.'; end if;
end;
$$;

revoke all on function public.set_task_workspace_status(uuid, text) from public;
grant execute on function public.set_task_workspace_status(uuid, text) to authenticated;

commit;
