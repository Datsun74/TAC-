# Лист сімейних побажань

Невеликий вебзастосунок для спільного сімейного списку покупок і побажань. На цьому етапі тут є лише готова технічна основа та стартова сторінка.

## Запуск у WebStorm

1. Відкрийте папку проєкту у WebStorm.
2. У нижній частині WebStorm відкрийте **Terminal**.
3. Встановіть залежності:

   ```bash
   npm install
   ```

4. У корені проєкту створіть файл `.env.local`. Можна скопіювати `.env.example` і перейменувати копію.
5. Вставте в `.env.local` дані вашого проєкту Supabase:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

6. Запустіть застосунок:

   ```bash
   npm run dev
   ```

7. Відкрийте у браузері [http://localhost:3000](http://localhost:3000).

## Де знайти дані Supabase

1. Відкрийте [Supabase Dashboard](https://supabase.com/dashboard) і виберіть свій проєкт.
2. Перейдіть до **Connect** або **Project Settings → API**.
3. Скопіюйте **Project URL** у `NEXT_PUBLIC_SUPABASE_URL`.
4. Скопіюйте **Publishable key** (у старіших проєктах — `anon` / `public` key) у `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Не додавайте `.env.local` до Git і не надсилайте цей файл іншим людям: він уже виключений у `.gitignore`.

## Корисні команди

```bash
npm run dev    # розробка
npm run lint   # перевірка стилю коду
npm run build  # перевірка production-збірки
```

## Структура

```text
src/
  app/         # сторінки та базовий layout
  components/  # повторно використовувані компоненти
  lib/         # Supabase та конфігурація навігації
  types/       # TypeScript-типи
  utils/       # невеликі допоміжні функції
```
