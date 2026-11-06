-- «Задачник»: відсоток виконання, поточний етап і результат задачі.
-- Виконуйте після supabase/tasks.sql. Безпечно запускати повторно.

begin;

alter table public.tasks
  add column if not exists progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  add column if not exists execution_note text check (execution_note is null or char_length(btrim(execution_note)) between 1 and 3000),
  add column if not exists execution_updated_at timestamptz;

commit;
