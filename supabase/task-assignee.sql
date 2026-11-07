-- «Задачник»: відповідальна людина за виконання задачі.
-- Виконуйте після supabase/tasks.sql. Безпечно запускати повторно.

begin;

alter table public.tasks
  add column if not exists assignee_user_id uuid,
  add column if not exists assignee_name text;

alter table public.tasks
  drop constraint if exists tasks_assignee_matches;

alter table public.tasks
  add constraint tasks_assignee_matches check (
    (assignee_user_id is null and assignee_name is null)
    or (
      assignee_user_id is not null
      and char_length(btrim(assignee_name)) between 2 and 80
    )
  );

create index if not exists tasks_assignee_user_id_idx
  on public.tasks (assignee_user_id)
  where assignee_user_id is not null;

commit;
