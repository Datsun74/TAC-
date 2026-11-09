-- «Задачник»: Хошин Канрі для стратегічних задач.
-- Виконуйте після tasks.sql. Якщо інші модулі задачника вже підключено,
-- цей файл безпечно запускається після них.
-- Створює окремі таблиці Задачника; покупки не змінюються.

begin;

create table if not exists public.task_hoshin_plans (
  task_id uuid primary key references public.tasks(id) on delete cascade,
  action text not null default '' check (char_length(btrim(action)) <= 5000),
  metric_name text not null default '' check (char_length(btrim(metric_name)) <= 160),
  metric_target text not null default '' check (char_length(btrim(metric_target)) <= 160),
  owner_name text not null default '' check (char_length(btrim(owner_name)) <= 80),
  executor_comment text not null default '' check (char_length(btrim(executor_comment)) <= 5000),
  proposed_metric text not null default '' check (char_length(btrim(proposed_metric)) <= 500),
  proposal_author_name text check (proposal_author_name is null or char_length(btrim(proposal_author_name)) between 2 and 80),
  proposal_updated_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_hoshin_nodes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  parent_id uuid references public.task_hoshin_nodes(id) on delete cascade,
  level text not null check (level in ('division', 'department')),
  title text not null check (char_length(btrim(title)) between 2 and 160),
  action text not null default '' check (char_length(btrim(action)) <= 5000),
  metric_name text not null default '' check (char_length(btrim(metric_name)) <= 160),
  metric_target text not null default '' check (char_length(btrim(metric_target)) <= 160),
  owner_name text not null default '' check (char_length(btrim(owner_name)) <= 80),
  executor_comment text not null default '' check (char_length(btrim(executor_comment)) <= 5000),
  proposed_metric text not null default '' check (char_length(btrim(proposed_metric)) <= 500),
  proposal_author_name text check (proposal_author_name is null or char_length(btrim(proposal_author_name)) between 2 and 80),
  proposal_updated_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_hoshin_nodes_tree_matches check (
    (level = 'division' and parent_id is null)
    or (level = 'department' and parent_id is not null)
  )
);

create index if not exists task_hoshin_nodes_task_idx
  on public.task_hoshin_nodes (task_id, level, created_at);

create index if not exists task_hoshin_nodes_parent_idx
  on public.task_hoshin_nodes (parent_id, created_at)
  where parent_id is not null;

create or replace function public.validate_task_hoshin_plan()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.tasks where id = new.task_id and horizon = 'strategic') then
    raise exception 'Hoshin Kanri is available only for strategic tasks.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.validate_task_hoshin_node()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_task_id uuid;
  parent_level text;
begin
  if not exists (select 1 from public.tasks where id = new.task_id and horizon = 'strategic') then
    raise exception 'Hoshin Kanri is available only for strategic tasks.';
  end if;

  if new.level = 'department' then
    select task_id, level into parent_task_id, parent_level
    from public.task_hoshin_nodes
    where id = new.parent_id;

    if parent_task_id is null or parent_task_id <> new.task_id or parent_level <> 'division' then
      raise exception 'A department must belong to a division of the same strategic task.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists task_hoshin_plans_validate on public.task_hoshin_plans;
create trigger task_hoshin_plans_validate
  before insert or update on public.task_hoshin_plans
  for each row execute function public.validate_task_hoshin_plan();

drop trigger if exists task_hoshin_nodes_validate on public.task_hoshin_nodes;
create trigger task_hoshin_nodes_validate
  before insert or update on public.task_hoshin_nodes
  for each row execute function public.validate_task_hoshin_node();

alter table public.task_hoshin_plans enable row level security;
alter table public.task_hoshin_nodes enable row level security;

revoke all on table public.task_hoshin_plans from anon, authenticated;
revoke all on table public.task_hoshin_nodes from anon, authenticated;
grant select, insert, update, delete on table public.task_hoshin_plans to authenticated;
grant select, insert, update, delete on table public.task_hoshin_nodes to authenticated;

drop policy if exists "task participants can read hoshin plans" on public.task_hoshin_plans;
drop policy if exists "task participants can create hoshin plans" on public.task_hoshin_plans;
drop policy if exists "task participants can update hoshin plans" on public.task_hoshin_plans;
drop policy if exists "task participants can delete hoshin plans" on public.task_hoshin_plans;
create policy "task participants can read hoshin plans"
  on public.task_hoshin_plans for select to authenticated
  using (public.can_access_task(task_id));
create policy "task participants can create hoshin plans"
  on public.task_hoshin_plans for insert to authenticated
  with check (public.can_access_task(task_id));
create policy "task participants can update hoshin plans"
  on public.task_hoshin_plans for update to authenticated
  using (public.can_access_task(task_id))
  with check (public.can_access_task(task_id));
create policy "task participants can delete hoshin plans"
  on public.task_hoshin_plans for delete to authenticated
  using (public.can_access_task(task_id));

drop policy if exists "task participants can read hoshin nodes" on public.task_hoshin_nodes;
drop policy if exists "task participants can create hoshin nodes" on public.task_hoshin_nodes;
drop policy if exists "task participants can update hoshin nodes" on public.task_hoshin_nodes;
drop policy if exists "task participants can delete hoshin nodes" on public.task_hoshin_nodes;
create policy "task participants can read hoshin nodes"
  on public.task_hoshin_nodes for select to authenticated
  using (public.can_access_task(task_id));
create policy "task participants can create hoshin nodes"
  on public.task_hoshin_nodes for insert to authenticated
  with check (public.can_access_task(task_id));
create policy "task participants can update hoshin nodes"
  on public.task_hoshin_nodes for update to authenticated
  using (public.can_access_task(task_id))
  with check (public.can_access_task(task_id));
create policy "task participants can delete hoshin nodes"
  on public.task_hoshin_nodes for delete to authenticated
  using (public.can_access_task(task_id));

commit;
