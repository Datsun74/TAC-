import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { FamilyAppShell } from "@/components/family-app-shell";
import { LocalTestPurchases } from "@/components/local-test-purchases";
import { PageIntro } from "@/components/page-intro";
import { getActiveShoppingItems } from "@/lib/shopping-items";
import { shoppingCategoryLabels, shoppingCategoryOptions } from "@/lib/shopping-categories";
import type { ShoppingItem } from "@/lib/shopping-item-types";
import { isLocalTestMode } from "@/lib/test-mode";

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "medium",
    timeZone: "Europe/Kyiv",
  }).format(new Date(value));
}

function ShoppingItemCard({ item }: Readonly<{ item: ShoppingItem }>) {
  return (
    <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-stone-500">{item.storeSection}</p>
          <h3 className="mt-1 text-xl font-semibold text-stone-950">{item.title}</h3>
        </div>
      </div>
      <dl className="mt-6 grid gap-3 border-t border-stone-100 pt-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-stone-500">Кількість</dt>
          <dd className="mt-1 font-medium text-stone-800">{item.quantity}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Хто замовив</dt>
          <dd className="mt-1 font-medium text-stone-800">{item.requestedBy}</dd>
        </div>
        {item.features ? (
          <div className="sm:col-span-2">
            <dt className="text-stone-500">Особливості</dt>
            <dd className="mt-1 font-medium text-stone-800">{item.features}</dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="text-stone-500">Створено</dt>
          <dd className="mt-1 font-medium text-stone-800">{formatCreatedAt(item.createdAt)}</dd>
        </div>
      </dl>
    </article>
  );
}

export default async function PurchasesPage() {
  const testMode = isLocalTestMode();
  const result = testMode ? null : await getActiveShoppingItems();

  return (
    <FamilyAppShell>
      <section className="w-full py-10 sm:py-14 lg:py-16">
        <PageIntro
          description="Тут зберігаються активні сімейні покупки. Вони згруповані так, щоб їх було легко знайти перед походом у магазин."
          eyebrow="Спільний список"
          title="Покупки"
        />

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-stone-600">
            {testMode ? "Тестові записи у цьому браузері" : result?.error ? "" : `Активних записів: ${result?.items.length}`}
          </p>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-amber-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-900 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none"
            href="/add"
          >
            Додати запис
          </Link>
        </div>

        {testMode ? (
          <LocalTestPurchases />
        ) : result?.error ? (
          <section className="mt-5 rounded-3xl border border-red-200 bg-red-50 px-6 py-8 text-center">
            <h2 className="text-lg font-semibold text-red-950">Список поки недоступний</h2>
            <p className="mt-2 text-sm leading-6 text-red-800">{result.error}</p>
          </section>
        ) : result && result.items.length === 0 ? (
          <div className="mt-5 max-w-2xl">
            <EmptyState
              actionHref="/add"
              actionLabel="Додати першу покупку"
              description="У списку ще немає активних записів. Додайте, наприклад, косметику або матеріали для будівництва."
              icon="+"
              title="Список покупок порожній"
            />
          </div>
        ) : result ? (
          <div className="mt-8 space-y-10">
            {shoppingCategoryOptions.map((category) => {
              const categoryItems = result.items.filter((item) => item.category === category.value);

              if (categoryItems.length === 0) {
                return null;
              }

              return (
                <section key={category.value} aria-labelledby={`category-${category.value}`}>
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="text-2xl font-semibold tracking-tight text-stone-950" id={`category-${category.value}`}>
                      {shoppingCategoryLabels[category.value]}
                    </h2>
                    <p className="text-sm text-stone-500">{categoryItems.length} шт.</p>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    {categoryItems.map((item) => (
                      <ShoppingItemCard item={item} key={item.id} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}
      </section>
    </FamilyAppShell>
  );
}
