"use client";

import { Fragment, useEffect, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { readLocalTestShoppingItems, writeLocalTestShoppingItems } from "@/lib/local-test-shopping-items";
import { shoppingCategoryLabels } from "@/lib/shopping-categories";
import type { ShoppingItem } from "@/lib/shopping-item-types";
import { createClient } from "@/lib/supabase/client";

type PurchasedHistoryProps = Readonly<{
  initialItems: ShoppingItem[];
  testMode: boolean;
}>;

function formatPurchaseDay(value: string | null) {
  if (!value) return "Дата не вказана";

  return new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Kyiv",
  }).format(new Date(value));
}

function formatPurchaseTime(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  }).format(new Date(value));
}

export function PurchasedHistory({ initialItems, testMode }: PurchasedHistoryProps) {
  const [items, setItems] = useState<ShoppingItem[] | null>(testMode ? null : initialItems);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!testMode) return;

    const timer = window.setTimeout(() => {
      setItems(readLocalTestShoppingItems().filter((item) => item.status === "purchased"));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [testMode]);

  async function restoreItem(item: ShoppingItem) {
    setPendingId(item.id);
    setErrorMessage("");

    try {
      if (testMode) {
        const updatedItems = readLocalTestShoppingItems().map((storedItem) =>
          storedItem.id === item.id
            ? { ...storedItem, status: "active" as const, purchasedBy: null, purchasedAt: null }
            : storedItem,
        );
        writeLocalTestShoppingItems(updatedItems);
      } else {
        const { error } = await createClient()
          .from("shopping_items")
          .update({ status: "active", purchased_by: null, purchased_at: null })
          .eq("id", item.id);

        if (error) throw error;
      }

      setItems((currentItems) => currentItems?.filter((currentItem) => currentItem.id !== item.id) ?? []);
    } catch {
      setErrorMessage("Не вдалося повернути покупку до активного списку. Спробуйте ще раз.");
    } finally {
      setPendingId(null);
    }
  }

  if (items === null) {
    return <p className="mt-8 text-sm text-stone-500">Завантажуємо історію…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="mt-8 max-w-2xl">
        <EmptyState
          actionHref="/shopping"
          actionLabel="Перейти до магазину"
          description="Тут з’являться покупки після того, як ви позначите їх придбаними."
          icon="✓"
          title="Ще немає куплених позицій"
        />
      </div>
    );
  }

  const orderedItems = [...items].sort((first, second) => {
    const firstTime = first.purchasedAt ? new Date(first.purchasedAt).getTime() : 0;
    const secondTime = second.purchasedAt ? new Date(second.purchasedAt).getTime() : 0;
    return secondTime - firstTime;
  });
  const itemsByDay = new Map<string, ShoppingItem[]>();

  orderedItems.forEach((item) => {
    const day = formatPurchaseDay(item.purchasedAt);
    itemsByDay.set(day, [...(itemsByDay.get(day) ?? []), item]);
  });

  return (
    <div className="mt-8">
      <p className="text-sm text-stone-600">Усього куплено: {items.length} шт. Новіші покупки — зверху.</p>
      {errorMessage ? (
        <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-6 space-y-8">
        {Array.from(itemsByDay.entries()).map(([day, dayItems]) => {
          const sectionNames = Array.from(new Set(dayItems.map((item) => item.storeSection))).sort((first, second) =>
            first.localeCompare(second, "uk-UA"),
          );

          return (
            <section key={day}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-stone-950">{day}</h2>
                <p className="text-sm text-stone-600">{dayItems.length} шт.</p>
              </div>

              <div className="mt-3 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-[61rem] w-full border-collapse text-left text-sm">
                    <caption className="sr-only">Покупки за {day}</caption>
                    <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-600">
                      <tr>
                        <th className="px-4 py-3 font-semibold" scope="col">Де куплено</th>
                        <th className="px-4 py-3 font-semibold" scope="col">Товар</th>
                        <th className="px-4 py-3 font-semibold" scope="col">Кількість</th>
                        <th className="px-4 py-3 font-semibold" scope="col">Особливості</th>
                        <th className="px-4 py-3 font-semibold" scope="col">Купив</th>
                        <th className="px-4 py-3 font-semibold" scope="col">Час</th>
                        <th className="px-4 py-3 font-semibold"><span className="sr-only">Дія</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionNames.map((section) => {
                        const sectionItems = dayItems
                          .filter((item) => item.storeSection === section)
                          .sort((first, second) => first.title.localeCompare(second.title, "uk-UA"));

                        return (
                          <Fragment key={section}>
                            <tr className="border-y border-amber-100 bg-amber-50 text-stone-900">
                              <th className="px-4 py-3 text-base font-semibold" colSpan={7} scope="colgroup">
                                {section}
                                <span className="ml-2 text-sm font-normal text-stone-600">
                                  {shoppingCategoryLabels[sectionItems[0].category]}
                                </span>
                              </th>
                            </tr>
                            {sectionItems.map((item) => (
                              <tr className="border-b border-stone-100 align-top last:border-b-0" key={item.id}>
                                <td className="whitespace-nowrap px-4 py-4 text-stone-700">
                                  {shoppingCategoryLabels[item.category]} · {item.storeSection}
                                </td>
                                <th className="px-4 py-4 font-semibold text-stone-950" scope="row">{item.title}</th>
                                <td className="px-4 py-4 text-stone-800">{item.quantity}</td>
                                <td className="max-w-56 px-4 py-4 text-stone-700">{item.features || "—"}</td>
                                <td className="px-4 py-4 text-stone-800">{item.purchasedBy ?? "—"}</td>
                                <td className="whitespace-nowrap px-4 py-4 text-stone-700">
                                  {formatPurchaseTime(item.purchasedAt)}
                                </td>
                                <td className="px-4 py-3">
                                  <button
                                    className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
                                    disabled={pendingId !== null}
                                    onClick={() => restoreItem(item)}
                                    type="button"
                                  >
                                    {pendingId === item.id ? "Повертаємо…" : "Повернути"}
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
            </section>
          );
        })}
      </div>
    </div>
  );
}
