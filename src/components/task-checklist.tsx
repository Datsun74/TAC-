"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import type { TaskChecklistItem } from "@/types/task";

type TaskChecklistProps = Readonly<{
  currentUserId: string;
  currentUserName: string;
  initialItems: readonly TaskChecklistItem[];
  setupError: string | null;
  taskId: string;
}>;

function mapChecklistItem(item: {
  id: string;
  title: string;
  is_completed: boolean;
  sort_order: number;
  created_at: string;
  completed_by_name: string | null;
  completed_at: string | null;
}): TaskChecklistItem {
  return {
    id: item.id,
    title: item.title,
    isCompleted: item.is_completed,
    sortOrder: item.sort_order,
    createdAt: item.created_at,
    completedByName: item.completed_by_name,
    completedAt: item.completed_at,
  };
}

export function TaskChecklist({ currentUserId, currentUserName, initialItems, setupError, taskId }: TaskChecklistProps) {
  const router = useRouter();
  const [items, setItems] = useState<readonly TaskChecklistItem[]>(initialItems);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [error, setError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  const completedCount = useMemo(() => items.filter((item) => item.isCompleted).length, [items]);
  const progress = items.length === 0 ? 0 : Math.round((completedCount / items.length) * 100);
  const featureAvailable = setupError === null;

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = newItemTitle.trim();

    if (title.length === 0) {
      setError("Напишіть короткий крок для цієї задачі.");
      return;
    }

    if (title.length > 240) {
      setError("Один крок може містити до 240 символів.");
      return;
    }

    setError("");
    setIsAdding(true);

    const nextSortOrder = items.reduce((maximum, item) => Math.max(maximum, item.sortOrder), -1) + 1;
    const { data, error: insertError } = await createClient()
      .from("task_checklist_items")
      .insert({
        task_id: taskId,
        title,
        created_by: currentUserId,
        sort_order: nextSortOrder,
      })
      .select("id, title, is_completed, sort_order, created_at, completed_by_name, completed_at")
      .single();

    if (insertError || !data) {
      setError("Не вдалося додати крок. Спробуйте ще раз.");
      setIsAdding(false);
      return;
    }

    setItems((current) => [...current, mapChecklistItem(data)]);
    setNewItemTitle("");
    setIsAdding(false);
    router.refresh();
  }

  async function toggleItem(item: TaskChecklistItem) {
    const nextIsCompleted = !item.isCompleted;
    const changedAt = new Date().toISOString();
    const optimisticItem: TaskChecklistItem = {
      ...item,
      isCompleted: nextIsCompleted,
      completedByName: nextIsCompleted ? currentUserName : null,
      completedAt: nextIsCompleted ? changedAt : null,
    };

    setError("");
    setUpdatingItemId(item.id);
    setItems((current) => current.map((value) => value.id === item.id ? optimisticItem : value));

    const { error: updateError } = await createClient()
      .from("task_checklist_items")
      .update({
        is_completed: nextIsCompleted,
        completed_by_name: nextIsCompleted ? currentUserName : null,
        completed_at: nextIsCompleted ? changedAt : null,
      })
      .eq("id", item.id)
      .eq("task_id", taskId);

    if (updateError) {
      setItems((current) => current.map((value) => value.id === item.id ? item : value));
      setError("Не вдалося оновити крок. Спробуйте ще раз.");
    } else {
      router.refresh();
    }

    setUpdatingItemId(null);
  }

  return (
    <section className="mt-8 max-w-3xl rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8" aria-labelledby="task-checklist-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">План дій</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-950" id="task-checklist-heading">Кроки задачі</h2>
          <p className="mt-1 text-sm text-stone-600">{items.length === 0 ? "Розбийте велику справу на прості кроки." : "Виконано " + completedCount + " з " + items.length + " кроків."}</p>
        </div>
        {items.length > 0 ? <span className="rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-950">{progress}%</span> : null}
      </div>

      {items.length > 0 ? (
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-stone-100" aria-label={"Виконано " + progress + "%"} role="progressbar" aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress}>
          <div className="h-full rounded-full bg-emerald-700 transition-[width]" style={{ width: progress + "%" }} />
        </div>
      ) : null}

      {setupError ? <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900" role="status">{setupError}</p> : null}
      {error ? <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-800" role="alert">{error}</p> : null}

      {items.length > 0 ? (
        <ul className="mt-5 divide-y divide-stone-100 rounded-2xl border border-stone-200">
          {items.map((item) => (
            <li className="flex items-start gap-3 px-4 py-3" key={item.id}>
              <input
                aria-label={item.isCompleted ? "Позначити крок невиконаним: " + item.title : "Позначити крок виконаним: " + item.title}
                checked={item.isCompleted}
                className="mt-1 size-4 shrink-0 accent-emerald-700"
                disabled={!featureAvailable || updatingItemId === item.id}
                onChange={() => void toggleItem(item)}
                type="checkbox"
              />
              <div className="min-w-0">
                <p className={"text-sm leading-6 " + (item.isCompleted ? "text-stone-400 line-through" : "font-medium text-stone-800")}>{item.title}</p>
                {item.isCompleted && item.completedByName ? <p className="mt-1 text-xs text-stone-500">Виконав(ла): {item.completedByName}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={addItem}>
        <label className="sr-only" htmlFor="task-checklist-new-item">Новий крок</label>
        <input
          className="min-h-11 min-w-0 flex-1 rounded-2xl border border-stone-300 bg-white px-4 text-sm text-stone-950 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-stone-100"
          disabled={!featureAvailable || isAdding}
          id="task-checklist-new-item"
          maxLength={240}
          onChange={(event) => { setNewItemTitle(event.target.value); setError(""); }}
          placeholder="Наприклад, зібрати ціни від постачальників"
          value={newItemTitle}
        />
        <button className="min-h-11 rounded-full bg-amber-800 px-5 text-sm font-semibold text-white transition-colors hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-60" disabled={!featureAvailable || isAdding} type="submit">
          {isAdding ? "Додаємо…" : "Додати крок"}
        </button>
      </form>
    </section>
  );
}
