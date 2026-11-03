-- «Задачник»: підзадачі та чеклісти.
-- Виконуйте після supabase/tasks.sql. Файл сумісний як із сімейними,
-- так і з робочими просторами після supabase/task-workspaces.sql.

begin;

create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 240),
  is_completed boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_by_name text check (completed_by_name is null or char_length(btrim(completed_by_name)) between 2 and 80),
  completed_at timestamptz,
  constraint task_checklist_completion_matches check (
    (not is_completed and completed_by_name is null and completed_at is null)
    or (is_completed and completed_by_name is not null and completed_at is not null)
  )
);

create index if not exists task_checklist_items_task_order_idx
  on public.task_checklist_items (task_id, sort_order asc, created_at asc);

alter table public.task_checklist_items enable row level security;

revoke all on table public.task_checklist_items from anon, authenticated;
grant select, insert, update, delete on table public.task_checklist_items to authenticated;

drop policy if exists "task participants can read checklist items" on public.task_checklist_items;
drop policy if exists "task participants can add checklist items" on public.task_checklist_items;
drop policy if exists "task participants can update checklist items" on public.task_checklist_items;
drop policy if exists "task participants can remove checklist items" on public.task_checklist_items;

create policy "task participants can read checklist items"
  on public.task_checklist_items for select to authenticated
  using (public.can_access_task(task_id));

create policy "task participants can add checklist items"
  on public.task_checklist_items for insert to authenticated
  with check (
    public.can_access_task(task_id)
    and created_by = (select auth.uid())
  );

create policy "task participants can update checklist items"
  on public.task_checklist_items for update to authenticated
  using (public.can_access_task(task_id))
  with check (public.can_access_task(task_id));

create policy "task participants can remove checklist items"
  on public.task_checklist_items for delete to authenticated
  using (public.can_access_task(task_id));

commit;
