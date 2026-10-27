-- Додає категорію «Сергій особисте» до вже створеної бази Supabase.
-- Запустіть цей запит один раз у Supabase SQL Editor.

alter type public.shopping_category add value if not exists 'serhii_personal' before 'other';
