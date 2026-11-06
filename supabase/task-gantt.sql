-- «Задачник»: планові й фактичні строки для діаграми Ганта.
-- Виконуйте після supabase/tasks.sql. Безпечно запускати повторно.

begin;

alter table public.tasks
  add column if not exists planned_start_date date,
  add column if not exists actual_started_at timestamptz;

alter table public.tasks
  drop constraint if exists tasks_planned_dates_match;

alter table public.tasks
  add constraint tasks_planned_dates_match check (
    planned_start_date is null
    or due_date is null
    or planned_start_date <= due_date
  );

create index if not exists tasks_gantt_timeline_idx
  on public.tasks (planned_start_date asc nulls last, due_date asc nulls last);

commit;
