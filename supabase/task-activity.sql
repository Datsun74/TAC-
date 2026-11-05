-- «Задачник»: повна історія змін статусу задач.
-- Виконуйте після tasks.sql, task-workspaces.sql і task-create-reliability.sql.
-- Файл додає лише нову таблицю Задачника та не змінює покупки.

begin;

create table if not exists public.task_activity_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  event_type text not null check (event_type in ('created', 'status_changed')),
  actor_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  actor_name text not null check (char_length(btrim(actor_name)) between 2 and 80),
  previous_status text check (previous_status is null or previous_status in ('active', 'in_work', 'in_progress', 'completed', 'rejected', 'postponed')),
  next_status text not null check (next_status in ('active', 'in_work', 'in_progress', 'completed', 'rejected', 'postponed')),
  occurred_at timestamptz not null default now(),
  constraint task_activity_event_matches check (
    (event_type = 'created' and previous_status is null and next_status = 'active')
    or (event_type = 'status_changed' and previous_status is not null)
  )
);

create index if not exists task_activity_events_task_time_idx
  on public.task_activity_events (task_id, occurred_at);

alter table public.task_activity_events enable row level security;
revoke all on table public.task_activity_events from anon, authenticated;
grant select, insert on table public.task_activity_events to authenticated;

drop policy if exists "task participants can read task activity" on public.task_activity_events;
drop policy if exists "task participants can add task activity" on public.task_activity_events;
create policy "task participants can read task activity"
  on public.task_activity_events for select to authenticated
  using (public.can_access_task(task_id));
create policy "task participants can add task activity"
  on public.task_activity_events for insert to authenticated
  with check (
    public.can_access_task(task_id)
    and actor_user_id = (select auth.uid())
  );

commit;
