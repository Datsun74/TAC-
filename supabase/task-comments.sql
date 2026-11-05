-- «Задачник»: короткі коментарі для спільних задач.
-- Виконуйте після tasks.sql та task-workspaces.sql.
-- Файл додає лише нову таблицю Задачника та не змінює покупки.

begin;

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_user_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  author_name text not null check (char_length(btrim(author_name)) between 2 and 80),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists task_comments_task_time_idx
  on public.task_comments (task_id, created_at);

alter table public.task_comments enable row level security;
revoke all on table public.task_comments from anon, authenticated;
grant select, insert, delete on table public.task_comments to authenticated;

drop policy if exists "task participants can read task comments" on public.task_comments;
drop policy if exists "task participants can add task comments" on public.task_comments;
drop policy if exists "comment authors can remove task comments" on public.task_comments;
create policy "task participants can read task comments"
  on public.task_comments for select to authenticated
  using (public.can_access_task(task_id));
create policy "task participants can add task comments"
  on public.task_comments for insert to authenticated
  with check (
    public.can_access_task(task_id)
    and author_user_id = (select auth.uid())
  );
create policy "comment authors can remove task comments"
  on public.task_comments for delete to authenticated
  using (author_user_id = (select auth.uid()));

commit;
