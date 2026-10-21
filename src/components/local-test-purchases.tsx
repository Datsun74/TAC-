"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { readLocalTestShoppingItems } from "@/lib/local-test-shopping-items";
import type { ShoppingItem } from "@/lib/shopping-item-types";
import { shoppingCategoryLabels, shoppingCategoryOptions } from "@/lib/shopping-categories";

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeZone: "Europe/Kyiv" }).format(new Date(value));
}

function LocalTestItemCard({ item }: Readonly<{ item: ShoppingItem }>) {
  return (
    <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-sm font-medium text-stone-500">{item.storeSection}</p>
      <h3 className="mt-1 text-xl font-semibold text-stone-950">{item.title}</h3>
      <dl className="mt-6 grid gap-3 border-t border-stone-100 pt-4 text-sm sm:grid-cols-2">
        <div><dt className="text-stone-500">Кількість</dt><dd className="mt-1 font-medium text-stone-800">{item.quantity}</dd></div>
        <div><dt className="text-stone-500">Хто замовив</dt><dd className="mt-1 font-medium text-stone-800">{item.requestedBy}</dd></div>
        {item.features ? <div className="sm:col-span-2"><dt className="text-stone-500">Особливості</dt><dd className="mt-1 font-medium text-stone-800">{item.features}</dd></div> : null}
        <div className="sm:col-span-2"><dt className="text-stone-500">Створено</dt><dd className="mt-1 font-medium text-stone-800">{formatCreatedAt(item.createdAt)}</dd></div>
      </dl>
    </article>
  );
}

export function LocalTestPurchases() {
  const [items, setItems] = useState<ShoppingItem[] | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setItems(readLocalTestShoppingItems().filter((item) => item.status === "active")), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (items === null) {
    return <p className="mt-8 text-sm text-stone-500">Завантажуємо тестові записи…</p>;
  }

  if (items.length === 0) {
    return <div className="mt-5 max-w-2xl"><EmptyState actionHref="/add" actionLabel="Додати першу покупку" description="У цьому браузері ще немає активних тестових записів." icon="+" title="Тестовий список порожній" /></div>;
  }

  return (
    <div className="mt-8 space-y-10">
      {shoppingCategoryOptions.map((category) => {
        const categoryItems = items.filter((item) => item.category === category.value);
        if (categoryItems.length === 0) return null;
        return (
          <section key={category.value} aria-labelledby={`local-category-${category.value}`}>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-2xl font-semibold tracking-tight text-stone-950" id={`local-category-${category.value}`}>{shoppingCategoryLabels[category.value]}</h2>
              <p className="text-sm text-stone-500">{categoryItems.length} шт.</p>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">{categoryItems.map((item) => <LocalTestItemCard item={item} key={item.id} />)}</div>
          </section>
        );
      })}
    </div>
  );
}
