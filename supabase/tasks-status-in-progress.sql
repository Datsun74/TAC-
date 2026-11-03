-- Додайте статус «У процесі», якщо supabase/tasks.sql уже було виконано раніше.
-- Якщо ви ще не запускали tasks.sql, достатньо виконати лише оновлений tasks.sql.

begin;

alter table public.tasks
  drop constraint if exists tasks_status_metadata_matches,
  drop constraint if exists tasks_status_check;

alter table public.tasks
  add constraint tasks_status_check
    check (status in ('active', 'in_progress', 'completed', 'rejected', 'postponed')),
  add constraint tasks_status_metadata_matches check (
    (status = 'active' and postponed_until is null and completed_by is null and completed_at is null and rejected_by is null and rejected_at is null)
    or (status = 'in_progress' and postponed_until is null and completed_by is null and completed_at is null and rejected_by is null and rejected_at is null)
    or (status = 'postponed' and postponed_until is not null and completed_by is null and completed_at is null and rejected_by is null and rejected_at is null)
    or (status = 'completed' and postponed_until is null and completed_by is not null and completed_at is not null and rejected_by is null and rejected_at is null)
    or (status = 'rejected' and postponed_until is null and completed_by is null and completed_at is null and rejected_by is not null and rejected_at is not null)
  );

commit;
