-- «Лист сімейних побажань»: базова структура даних для покупок і побажань.
-- Запускайте цей файл у Supabase SQL Editor одним запитом.
-- Публічний доступ не надається: RLS увімкнено, а політики доступу буде
-- додано лише разом із безпечним способом входу членів родини.

create extension if not exists pgcrypto;

do $$
begin
  create type public.list_item_type as enum ('purchase', 'wish');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.shopping_category as enum ('groceries', 'cosmetics', 'building', 'serhii_personal', 'other');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.list_item_status as enum ('active', 'purchased');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 160),
  item_type public.list_item_type not null default 'purchase',
  category public.shopping_category not null,
  store_section text not null check (char_length(btrim(store_section)) between 2 and 80),
  quantity text not null check (char_length(btrim(quantity)) between 1 and 80),
  features text,
  requested_by text not null check (char_length(btrim(requested_by)) between 2 and 80),
  created_at timestamptz not null default now(),
  status public.list_item_status not null default 'active',
  purchased_by text check (purchased_by is null or char_length(btrim(purchased_by)) between 2 and 80),
  purchased_at timestamptz,
  constraint shopping_items_purchase_metadata_matches_status check (
    (status = 'active' and purchased_by is null and purchased_at is null)
    or (status = 'purchased' and purchased_by is not null and purchased_at is not null)
  ),
  constraint shopping_items_purchased_after_creation check (
    purchased_at is null or purchased_at >= created_at
  )
);

comment on table public.shopping_items is
  'Покупки та побажання однієї сім’ї. Доступ буде додано після вибору безпечного способу входу.';
comment on column public.shopping_items.category is
  'Основна категорія: groceries=Продукти, cosmetics=Косметика, building=Будівництво, serhii_personal=Сергій особисте, other=Інше.';
comment on column public.shopping_items.store_section is
  'Відділ магазину в межах категорії, наприклад Молочні продукти, Алкоголь або ЗОЖ-товари.';
comment on column public.shopping_items.requested_by is
  'Ім’я члена родини, який замовив позицію.';
comment on column public.shopping_items.purchased_by is
  'Ім’я члена родини, який позначив позицію купленою.';

create index if not exists shopping_items_active_browse_idx
  on public.shopping_items (category, store_section, created_at desc)
  where status = 'active';

create index if not exists shopping_items_purchased_history_idx
  on public.shopping_items (purchased_at desc)
  where status = 'purchased';

alter table public.shopping_items enable row level security;

-- Явно закриваємо таблицю для браузерних ролей до блоку спільного доступу.
revoke all on table public.shopping_items from anon, authenticated;
