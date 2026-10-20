import Link from "next/link";

import { PageIntro } from "@/components/page-intro";

const demoItems = [
  { title: "Молоко", type: "Покупка", details: "2 упаковки", note: "Для сніданків" },
  { title: "Фарби для малювання", type: "Побажання", details: "Набір акварелі", note: "Для творчого вечора" },
  { title: "Яблука", type: "Покупка", details: "1 кг", note: "Солодкі, якщо будуть" },
];

export default function PurchasesPage() {
  return (
    <section className="w-full py-10 sm:py-14 lg:py-16">
      <PageIntro
        description="Поки що це лише приклади того, як виглядатиме спільний список. Дані не зберігаються."
        eyebrow="Спільний список"
        title="Покупки"
      />

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex w-fit items-center rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-950">
          Демонстраційні записи — приклад
        </p>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-amber-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-900 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none"
          href="/add"
        >
          Додати запис
        </Link>
      </div>

      <ul className="mt-5 grid gap-4 lg:grid-cols-3" aria-label="Демонстраційні записи">
        {demoItems.map((item) => (
          <li className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm" key={item.title}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-stone-500">{item.type}</p>
                <h2 className="mt-1 text-lg font-semibold text-stone-950">{item.title}</h2>
              </div>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">Приклад</span>
            </div>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-4 border-t border-stone-100 pt-3">
                <dt className="text-stone-500">Кількість</dt>
                <dd className="text-right font-medium text-stone-800">{item.details}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-stone-500">Примітка</dt>
                <dd className="text-right font-medium text-stone-800">{item.note}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
