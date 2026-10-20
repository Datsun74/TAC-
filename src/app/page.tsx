import Link from "next/link";

import { FamilyAppShell } from "@/components/family-app-shell";

export default async function Home() {
  return (
    <FamilyAppShell>
      <section className="flex flex-1 items-center py-10 sm:py-16 lg:py-20">
      <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end lg:gap-16">
        <div className="max-w-3xl">
          <p className="mb-5 text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">
            Для всієї родини
          </p>
          <h1 className="max-w-2xl text-4xl leading-tight font-semibold tracking-tight text-stone-950 sm:text-5xl lg:text-6xl">
            Сімейні покупки
          </h1>
          <p className="mt-6 text-lg leading-8 text-stone-700 sm:text-xl">
            Спільний список покупок для всієї родини
          </p>
          <p className="mt-3 text-base leading-7 text-stone-600">
            Додавайте потрібне, тримайте список поруч і збирайтеся до магазину без зайвих повідомлень у чатах.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex items-center justify-center rounded-full bg-amber-800 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-amber-900 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none"
              href="/purchases"
            >
              Переглянути покупки
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-full border border-stone-300 px-6 py-3 text-base font-semibold text-stone-800 transition-colors hover:border-stone-400 hover:bg-white focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none"
              href="/add"
            >
              Додати запис
            </Link>
          </div>
        </div>

        <aside className="rounded-3xl border border-amber-100 bg-amber-50 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-2xl bg-white text-xl shadow-sm">
              ✦
            </span>
            <p className="font-semibold text-stone-900">Спільні плани</p>
          </div>
          <p className="mt-5 text-sm leading-6 text-stone-600">
            Невеликий простір для важливих речей, які хочеться пам’ятати разом.
          </p>
          <p className="mt-4 rounded-2xl bg-white/80 p-4 text-sm leading-6 text-stone-600">
            Додавайте покупки до спільного списку. Режим походу в магазин і позначка «Куплено» з’являться на наступному етапі.
          </p>
        </aside>
      </div>
      </section>
    </FamilyAppShell>
  );
}
