"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { taskAreaOptions, taskHorizonOptions } from "@/lib/task-options";
import { createClient } from "@/lib/supabase/client";
import type { Task, TaskArea, TaskHorizon } from "@/types/task";

type TaskEditorProps = Readonly<{
  task: Pick<Task, "id" | "title" | "goal" | "area" | "horizon" | "dueDate">;
}>;

export function TaskEditor({ task }: TaskEditorProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [goal, setGoal] = useState(task.goal ?? "");
  const [area, setArea] = useState<TaskArea>(task.area);
  const [horizon, setHorizon] = useState<TaskHorizon>(task.horizon);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function cancelEditing() {
    setTitle(task.title);
    setGoal(task.goal ?? "");
    setArea(task.area);
    setHorizon(task.horizon);
    setDueDate(task.dueDate ?? "");
    setError("");
    setIsOpen(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTitle = title.trim();
    const normalizedGoal = goal.trim();

    if (normalizedTitle.length < 2) {
      setError("Суть задачі має містити щонайменше два символи.");
      return;
    }

    if (normalizedGoal.length > 5000) {
      setError("Кінцева мета може містити до 5 000 символів.");
      return;
    }

    setError("");
    setIsSaving(true);

    const { error: updateError } = await createClient()
      .from("tasks")
      .update({
        title: normalizedTitle,
        goal: normalizedGoal || null,
        area,
        horizon,
        due_date: dueDate || null,
      })
      .eq("id", task.id);

    if (updateError) {
      setError("Не вдалося зберегти зміни. Оновіть сторінку й спробуйте ще раз.");
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    setIsOpen(false);
    router.refresh();
  }

  if (!isOpen) {
    return (
      <button className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none" onClick={() => setIsOpen(true)} type="button">
        Редагувати задачу
      </button>
    );
  }

  return (
    <form className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5" onSubmit={save}>
      <h2 className="text-base font-semibold text-amber-950">Редагування задачі</h2>
      <p className="mt-1 text-sm leading-6 text-amber-900">Тут можна уточнити зміст і строк. Простір та учасників змінюватимемо окремо, щоб не втратити спільний доступ.</p>

      <div className="mt-5 grid gap-4">
        <div>
          <label className="block text-sm font-semibold text-stone-900" htmlFor="edit-task-title">Суть задачі</label>
          <input className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100" id="edit-task-title" maxLength={160} onChange={(event) => setTitle(event.target.value)} value={title} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-stone-900" htmlFor="edit-task-goal">Кінцева мета</label>
          <textarea className="mt-2 min-h-24 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100" id="edit-task-goal" maxLength={5000} onChange={(event) => setGoal(event.target.value)} rows={3} value={goal} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-semibold text-stone-900" htmlFor="edit-task-area">Напрям</label>
            <select className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100" id="edit-task-area" onChange={(event) => setArea(event.target.value as TaskArea)} value={area}>
              {taskAreaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-900" htmlFor="edit-task-horizon">Планування</label>
            <select className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100" id="edit-task-horizon" onChange={(event) => setHorizon(event.target.value as TaskHorizon)} value={horizon}>
              {taskHorizonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-900" htmlFor="edit-task-date">Бажана дата</label>
            <input className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100" id="edit-task-date" onChange={(event) => setDueDate(event.target.value)} type="date" value={dueDate} />
          </div>
        </div>
      </div>

      {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p> : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button className="min-h-11 rounded-full bg-amber-800 px-5 text-sm font-semibold text-white transition-colors hover:bg-amber-900 disabled:cursor-wait disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Зберігаємо…" : "Зберегти зміни"}</button>
        <button className="min-h-11 rounded-full px-4 text-sm font-semibold text-stone-600 hover:bg-amber-100" disabled={isSaving} onClick={cancelEditing} type="button">Скасувати</button>
      </div>
    </form>
  );
}
