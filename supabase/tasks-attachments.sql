-- «Задачник»: приватні вкладення до задач.
-- Виконуйте тільки після supabase/tasks.sql.
-- Вкладення зберігаються у приватному Storage bucket, а не відкритими URL.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-files',
  'task-files',
  false,
  6291456,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  storage_path text not null unique check (char_length(btrim(storage_path)) between 5 and 700),
  original_name text not null check (char_length(btrim(original_name)) between 1 and 255),
  media_type text not null check (char_length(btrim(media_type)) between 1 and 120),
  byte_size integer not null check (byte_size > 0 and byte_size <= 6291456),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  uploaded_by_name text not null check (char_length(btrim(uploaded_by_name)) between 2 and 80),
  created_at timestamptz not null default now()
);

create index if not exists task_attachments_task_created_idx
  on public.task_attachments (task_id, created_at desc);

create or replace function public.can_access_task_file(file_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tasks
    where id::text = split_part(file_path, '/', 2)
      and family_id::text = split_part(file_path, '/', 1)
      and public.can_access_task(id)
  );
$$;

revoke all on function public.can_access_task_file(text) from public;
grant execute on function public.can_access_task_file(text) to authenticated;

alter table public.task_attachments enable row level security;
revoke all on table public.task_attachments from anon, authenticated;
grant select, insert, delete on table public.task_attachments to authenticated;

drop policy if exists "task users can read task attachments" on public.task_attachments;
drop policy if exists "task users can create task attachments" on public.task_attachments;
drop policy if exists "uploaders can delete task attachments" on public.task_attachments;
create policy "task users can read task attachments"
  on public.task_attachments for select to authenticated
  using (public.can_access_task(task_id));
create policy "task users can create task attachments"
  on public.task_attachments for insert to authenticated
  with check (
    public.can_access_task(task_id)
    and family_id = (
      select family_id
      from public.tasks
      where id = task_attachments.task_id
    )
    and uploaded_by = (select auth.uid())
  );
create policy "uploaders can delete task attachments"
  on public.task_attachments for delete to authenticated
  using (
    public.can_access_task(task_id)
    and uploaded_by = (select auth.uid())
  );

drop policy if exists "task users can read task files" on storage.objects;
drop policy if exists "task users can upload task files" on storage.objects;
drop policy if exists "task users can delete their task files" on storage.objects;
create policy "task users can read task files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'task-files'
    and public.can_access_task_file(name)
  );
create policy "task users can upload task files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'task-files'
    and public.can_access_task_file(name)
  );
create policy "task users can delete their task files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'task-files'
    and public.can_access_task_file(name)
    and owner_id = (select auth.uid()::text)
  );

commit;
