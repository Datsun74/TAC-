-- Додайте окремий стан «Взята в роботу» між «Активна» та «У процесі».
-- Виконайте цей файл, якщо supabase/tasks.sql вже запускали раніше.
-- Файл безпечно запускати після tasks-status-in-progress.sql.

begin;

alter table public.tasks
  drop constraint if exists tasks_status_metadata_matches,
  drop constraint if exists tasks_status_check;

alter table public.tasks
  add constraint tasks_status_check
    check (status in ('active', 'in_work', 'in_progress', 'completed', 'rejected', 'postponed')),
  add constraint tasks_status_metadata_matches check (
    (status = 'active' and postponed_until is null and completed_by is null and completed_at is null and rejected_by is null and rejected_at is null)
    or (status = 'in_work' and postponed_until is null and completed_by is null and completed_at is null and rejected_by is null and rejected_at is null)
    or (status = 'in_progress' and postponed_until is null and completed_by is null and completed_at is null and rejected_by is null and rejected_at is null)
    or (status = 'postponed' and postponed_until is not null and completed_by is null and completed_at is null and rejected_by is null and rejected_at is null)
    or (status = 'completed' and postponed_until is null and completed_by is not null and completed_at is not null and rejected_by is null and rejected_at is null)
    or (status = 'rejected' and postponed_until is null and completed_by is null and completed_at is null and rejected_by is not null and rejected_at is not null)
  );

commit;
