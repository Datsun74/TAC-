"use client";

import { Fragment, useEffect, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { readLocalTestShoppingItems, writeLocalTestShoppingItems } from "@/lib/local-test-shopping-items";
import { shoppingCategoryLabels, shoppingCategoryOptions, type ShoppingCategory } from "@/lib/shopping-categories";
import type { ShoppingItem } from "@/lib/shopping-item-types";
import { createClient } from "@/lib/supabase/client";

type ShoppingTripProps = Readonly<{
  initialItems: ShoppingItem[];
  memberName: string;
  testMode: boolean;
}>;

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    dateStyle: "medium",
    timeZone: "Europe/Kyiv",
  }).format(new Date(value));
}

export function ShoppingTrip({ initialItems, memberName, testMode }: ShoppingTripProps) {
  const [items, setItems] = useState<ShoppingItem[] | null>(testMode ? null : initialItems);
  const [selectedCategory, setSelectedCategory] = useState<ShoppingCategory | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!testMode) return;

    const timer = window.setTimeout(() => {
      setItems(readLocalTestShoppingItems().filter((item) => item.status === "active"));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [testMode]);

  async function markPurchased(item: ShoppingItem) {
    setPendingId(item.id);
    setErrorMessage("");
    const purchasedAt = new Date().toISOString();

    try {
      if (testMode) {
        const updatedItems = readLocalTestShoppingItems().map((storedItem) =>
          storedItem.id === item.id
            ? { ...storedItem, status: "purchased" as const, purchasedBy: memberName, purchasedAt }
            : storedItem,
        );
        writeLocalTestShoppingItems(updatedItems);
      } else {
        const { error } = await createClient()
          .from("shopping_items")
          .update({ status: "purchased", purchased_by: memberName, purchased_at: purchasedAt })
          .eq("id", item.id);

        if (error) throw error;
      }

      setItems((currentItems) => currentItems?.filter((currentItem) => currentItem.id !== item.id) ?? []);
    } catch {
      setErrorMessage("Не вдалося позначити покупку. Спробуйте ще раз.");
    } finally {
      setPendingId(null);
    }
  }

  if (items === null) {
    return <p className="mt-8 text-sm text-stone-500">Завантажуємо список для магазину…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="mt-8 max-w-2xl">
        <EmptyState
          actionHref="/add"
          actionLabel="Додати покупку"
          description="Активних покупок немає. Коли додасте нову, вона з’явиться тут за своєю категорією."
          icon="✓"
          title="Усе потрібне вже куплено"
        />
      </div>
    );
  }

  if (!selectedCategory) {
    return (
      <div className="mt-8">
        <p className="text-sm text-stone-600">
          Залишилося купити: {items.length} шт. Оберіть категорію магазину.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {shoppingCategoryOptions.map((category) => {
            const count = items.filter((item) => item.category === category.value).length;

            return (
              <button
                className="min-h-28 rounded-3xl border border-stone-200 bg-white p-5 text-left shadow-sm transition hover:border-amber-300 hover:bg-amber-50 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                disabled={count === 0}
                key={category.value}
                onClick={() => setSelectedCategory(category.value)}
                type="button"
              >
                <span className="block text-lg font-semibold text-stone-950">{category.label}</span>
                <span className="mt-2 block text-sm text-stone-600">
                  {count === 0 ? "Немає активних покупок" : `${count} шт. у списку`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const categoryItems = items.filter((item) => item.category === selectedCategory);
  const sections = Array.from(new Set(categoryItems.map((item) => item.storeSection))).sort((first, second) =>
    first.localeCompare(second, "uk-UA"),
  );

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button
            className="text-sm font-semibold text-amber-800 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:outline-none"
            onClick={() => setSelectedCategory(null)}
            type="button"
          >
            ← Усі категорії
          </button>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-stone-950">
            {shoppingCategoryLabels[selectedCategory]}
          </h2>
          <p className="mt-1 text-sm text-stone-600">Залишилося у цій категорії: {categoryItems.length} шт.</p>
        </div>
      </div>

      {errorMessage ? (
        <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {categoryItems.length === 0 ? (
        <section className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
          <h3 className="text-lg font-semibold text-emerald-950">У цій категорії все куплено</h3>
          <p className="mt-2 text-sm text-emerald-800">
            Поверніться до категорій, щоб перейти до наступного відділу магазину.
          </p>
        </section>
      ) : (
        <div className="mt-7 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[52rem] w-full border-collapse text-left text-sm">
              <caption className="sr-only">Активні покупки категорії {shoppingCategoryLabels[selectedCategory]}</caption>
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-600">
                <tr>
                  <th className="px-4 py-3 font-semibold" scope="col">Товар</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Кількість</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Особливості</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Хто замовив</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Створено</th>
                  <th className="px-4 py-3 font-semibold"><span className="sr-only">Дія</span></th>
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => {
                  const sectionItems = categoryItems
                    .filter((item) => item.storeSection === section)
                    .sort((first, second) => first.title.localeCompare(second.title, "uk-UA"));

                  return (
                    <Fragment key={section}>
                      <tr className="border-y border-amber-100 bg-amber-50 text-stone-900">
                        <th className="px-4 py-3 text-base font-semibold" colSpan={6} scope="colgroup">
                          {section}
                          <span className="ml-2 text-sm font-normal text-stone-600">{sectionItems.length} шт.</span>
                        </th>
                      </tr>
                      {sectionItems.map((item) => (
                        <tr className="border-b border-stone-100 align-top last:border-b-0" key={item.id}>
                          <th className="px-4 py-4 font-semibold text-stone-950" scope="row">{item.title}</th>
                          <td className="px-4 py-4 text-stone-800">{item.quantity}</td>
                          <td className="max-w-56 px-4 py-4 text-stone-700">{item.features || "—"}</td>
                          <td className="px-4 py-4 text-stone-800">{item.requestedBy}</td>
                          <td className="whitespace-nowrap px-4 py-4 text-stone-700">{formatCreatedAt(item.createdAt)}</td>
                          <td className="px-4 py-3">
                            <button
                              className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
                              disabled={pendingId !== null}
                              onClick={() => markPurchased(item)}
                              type="button"
                            >
                              {pendingId === item.id ? "Позначаємо…" : "✓ Куплено"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
