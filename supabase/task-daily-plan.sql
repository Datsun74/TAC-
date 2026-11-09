-- «Задачник»: щоденний план на вкладці «Сьогодні».
-- Виконайте після supabase/tasks.sql та supabase/task-gantt.sql.
-- «Сьогодні» й «Завтра» не є новими статусами: задача лишається «У процесі».

begin;

alter table public.tasks
  add column if not exists daily_plan_date date,
  add column if not exists daily_plan_hour smallint;

alter table public.tasks
  drop constraint if exists tasks_daily_plan_metadata_matches;

alter table public.tasks
  add constraint tasks_daily_plan_metadata_matches check (
    (daily_plan_date is null and daily_plan_hour is null)
    or (daily_plan_date is not null and daily_plan_hour between 8 and 20)
  );

create index if not exists tasks_daily_plan_date_hour_idx
  on public.tasks (daily_plan_date, daily_plan_hour)
  where daily_plan_date is not null;

create or replace function public.normalize_task_daily_plan()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Денний план існує тільки для задачі «У процесі» або для вже виконаної
  -- задачі, щоб її було видно у колонці «Виконано» за відповідний день.
  if new.status not in ('in_progress', 'completed') then
    new.daily_plan_date := null;
    new.daily_plan_hour := null;
  elsif TG_OP = 'UPDATE' and new.status = 'in_progress' and old.status <> 'in_progress' then
    new.daily_plan_date := null;
    new.daily_plan_hour := null;
  end if;

  return new;
end;
$$;

drop trigger if exists normalize_task_daily_plan_before_write on public.tasks;
create trigger normalize_task_daily_plan_before_write
  before insert or update of status, daily_plan_date, daily_plan_hour on public.tasks
  for each row execute function public.normalize_task_daily_plan();

commit;
