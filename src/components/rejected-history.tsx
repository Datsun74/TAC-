"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/empty-state";
import { readLocalTestShoppingItems, writeLocalTestShoppingItems } from "@/lib/local-test-shopping-items";
import { shoppingCategoryLabels } from "@/lib/shopping-categories";
import type { ShoppingItem } from "@/lib/shopping-item-types";
import { createClient } from "@/lib/supabase/client";

type RejectedHistoryProps = Readonly<{
  initialItems: ShoppingItem[];
  familyId: string;
  testMode: boolean;
}>;

function formatRejectedAt(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Kyiv" }).format(new Date(value));
}

export function RejectedHistory({ initialItems, familyId, testMode }: RejectedHistoryProps) {
  const [items, setItems] = useState<ShoppingItem[] | null>(testMode ? null : initialItems);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!testMode) return;
    const timer = window.setTimeout(() => setItems(readLocalTestShoppingItems().filter((item) => item.status === "rejected")), 0);

    return () => window.clearTimeout(timer);
  }, [testMode]);

  async function restoreItem(item: ShoppingItem) {
    setPendingId(item.id);
    setErrorMessage("");

    try {
      if (testMode) {
        writeLocalTestShoppingItems(readLocalTestShoppingItems().map((storedItem) => storedItem.id === item.id ? { ...storedItem, status: "active" as const, purchasedBy: null, purchasedAt: null, rejectedBy: null, rejectedAt: null } : storedItem));
      } else {
        const { error } = await createClient().from("shopping_items").update({ status: "active", purchased_by: null, purchased_at: null, rejected_by: null, rejected_at: null }).eq("id", item.id).eq("family_id", familyId);
        if (error) throw error;
      }

      setItems((current) => current?.filter((storedItem) => storedItem.id !== item.id) ?? []);
    } catch {
      setErrorMessage("Не вдалося повернути покупку до активного списку. Спробуйте ще раз.");
    } finally {
      setPendingId(null);
    }
  }

  if (items === null) return <p className="mt-8 text-sm text-stone-500">Завантажуємо відхилені записи…</p>;

  if (items.length === 0) {
    return <div className="mt-8 max-w-2xl"><EmptyState actionHref="/shopping" actionLabel="Відкрити список покупок" description="Тут з’являться лише покупки, які ви відхилили. Їх завжди можна повернути до активного списку." icon="×" title="Відхилених покупок немає" /></div>;
  }

  const orderedItems = [...items].sort((first, second) => new Date(second.rejectedAt ?? 0).getTime() - new Date(first.rejectedAt ?? 0).getTime());

  return (
    <div className="mt-8">
      <p className="text-sm text-stone-600">Відхилено: {items.length} шт. Це не видалення — запис можна повернути в активний список.</p>
      {errorMessage ? <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">{errorMessage}</p> : null}
      <div className="mt-6 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-[58rem] w-full border-collapse text-left text-sm"><caption className="sr-only">Відхилені покупки</caption><thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-600"><tr><th className="px-4 py-3 font-semibold" scope="col">Товар</th><th className="px-4 py-3 font-semibold" scope="col">Категорія</th><th className="px-4 py-3 font-semibold" scope="col">Відділ</th><th className="px-4 py-3 font-semibold" scope="col">Хто відхилив</th><th className="px-4 py-3 font-semibold" scope="col">Дата</th><th className="px-4 py-3 font-semibold"><span className="sr-only">Дія</span></th></tr></thead><tbody>{orderedItems.map((item) => <tr className="border-b border-stone-100 last:border-b-0" key={item.id}><th className="px-4 py-4 font-semibold text-stone-950" scope="row">{item.title}</th><td className="px-4 py-4 text-stone-700">{shoppingCategoryLabels[item.category]}</td><td className="px-4 py-4 text-stone-700">{item.storeSection}</td><td className="px-4 py-4 text-stone-700">{item.rejectedBy ?? "—"}</td><td className="whitespace-nowrap px-4 py-4 text-stone-700">{formatRejectedAt(item.rejectedAt)}</td><td className="px-4 py-3"><button className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-800 transition hover:border-stone-400 hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60" disabled={pendingId !== null} onClick={() => restoreItem(item)} type="button">{pendingId === item.id ? "Повертаємо…" : "Повернути"}</button></td></tr>)}</tbody></table></div></div>
    </div>
  );
}
