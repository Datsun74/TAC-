"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { formatTaskDate } from "@/lib/task-options";
import type { Task } from "@/types/task";

type TaskExecutionProgressProps = Readonly<{
  embedded?: boolean;
  setupError: string | null;
  task: Pick<Task, "id" | "status" | "progressPercent" | "executionNote" | "executionUpdatedAt" | "plannedStartDate" | "dueDate">;
}>;

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Kyiv" }).format(new Date(value));
}

export function TaskExecutionProgress({ embedded = false, setupError, task }: TaskExecutionProgressProps) {
  const router = useRouter();
  const Heading = embedded ? "h4" : "h2";
  const completed = task.status === "completed";
  const initialProgress = completed ? 100 : task.progressPercent;
  const [isOpen, setIsOpen] = useState(false);
  const [progressPercent, setProgressPercent] = useState(String(initialProgress));
  const [executionNote, setExecutionNote] = useState(task.executionNote ?? "");
  const [plannedStartDate, setPlannedStartDate] = useState(task.plannedStartDate ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setProgressPercent(String(initialProgress));
    setExecutionNote(task.executionNote ?? "");
    setPlannedStartDate(task.plannedStartDate ?? "");
    setDueDate(task.dueDate ?? "");
    setError("");
    setIsOpen(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const progress = completed ? 100 : Number(progressPercent);
    const note = executionNote.trim();

    if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
      setError("Відсоток виконання має бути цілим числом від 0 до 100.");
      return;
    }
    if (note.length > 3000) {
      setError("Опис етапу або результату може містити до 3 000 символів.");
      return;
    }
    if (plannedStartDate && dueDate && plannedStartDate > dueDate) {
      setError("Плановий старт не може бути пізніше планового завершення.");
      return;
    }

    setError("");
    setIsSaving(true);
    const { error: updateError } = await createClient()
      .from("tasks")
      .update({
        progress_percent: progress,
        execution_note: note || null,
        execution_updated_at: new Date().toISOString(),
        planned_start_date: plannedStartDate || null,
        due_date: dueDate || null,
      })
      .eq("id", task.id);

    if (updateError) {
      setError(updateError.code === "42703" ? "Виконайте supabase/task-execution.sql у Supabase SQL Editor, а потім повторіть спробу." : "Не вдалося зберегти виконання або строки. Оновіть сторінку й спробуйте ще раз.");
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    setIsOpen(false);
    router.refresh();
  }

  const displayedProgress = completed ? 100 : task.progressPercent;
  const noteLabel = completed ? "Результат виконання" : "Поточний етап / що вже зроблено";

  return <section className={embedded ? "mt-5" : "mt-7 border-t border-stone-100 pt-5"} aria-labelledby="task-execution-heading">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><Heading className="text-base font-semibold text-stone-950" id="task-execution-heading">Виконання та строки</Heading><p className="mt-1 text-sm text-stone-600">Зафіксуйте прогрес, поточний етап і за потреби перенесіть план.</p></div>
      {!isOpen ? <button className="inline-flex min-h-10 items-center justify-center rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50" onClick={() => setIsOpen(true)} type="button">Оновити / перенести</button> : null}
    </div>

    {setupError ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-950">{setupError}</p> : <>
      <div className="mt-4 rounded-2xl bg-stone-50 p-4">
        <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-stone-900">Готовність</p><p className="text-lg font-semibold text-stone-950">{displayedProgress}%</p></div>
        <div aria-label={`Виконано ${displayedProgress}%`} className="mt-2 h-2.5 overflow-hidden rounded-full bg-stone-200"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${displayedProgress}%` }} /></div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">{task.executionNote || (completed ? "Результат виконання ще не описано." : "Етап виконання ще не описано.")}</p>
        <p className="mt-2 text-xs text-stone-500">{task.executionUpdatedAt ? `Оновлено: ${formatUpdatedAt(task.executionUpdatedAt)}` : "Прогрес ще не оновлювали."} · План: {task.plannedStartDate ? formatTaskDate(task.plannedStartDate) : "без старту"} — {task.dueDate ? formatTaskDate(task.dueDate) : "без завершення"}</p>
      </div>

      {isOpen ? <form className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4" noValidate onSubmit={save}>
        <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <div><label className="block text-sm font-semibold text-stone-900" htmlFor="task-progress-percent">Виконано, %</label><input className="mt-2 min-h-10 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100 disabled:bg-stone-100" disabled={completed} id="task-progress-percent" max="100" min="0" onChange={(event) => setProgressPercent(event.target.value)} step="1" type="number" value={completed ? "100" : progressPercent} /></div>
          <div><label className="block text-sm font-semibold text-stone-900" htmlFor="task-execution-note">{noteLabel}</label><textarea className="mt-2 min-h-24 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-950 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100" id="task-execution-note" maxLength={3000} onChange={(event) => setExecutionNote(event.target.value)} placeholder={completed ? "Що саме виконано, де результат?" : "Наприклад: зібрано ціни, очікуємо відповідь майстра."} rows={3} value={executionNote} /></div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><label className="block text-sm font-semibold text-stone-900" htmlFor="task-progress-start">Плановий старт</label><input className="mt-2 min-h-10 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100" id="task-progress-start" onChange={(event) => setPlannedStartDate(event.target.value)} type="date" value={plannedStartDate} /></div><div><label className="block text-sm font-semibold text-stone-900" htmlFor="task-progress-finish">Планове завершення</label><input className="mt-2 min-h-10 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-950 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100" id="task-progress-finish" onChange={(event) => setDueDate(event.target.value)} type="date" value={dueDate} /></div></div>
        {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm leading-6 text-red-800" role="alert">{error}</p> : null}
        <div className="mt-5 flex flex-wrap gap-3"><button className="min-h-10 rounded-full bg-amber-800 px-4 text-sm font-semibold text-white hover:bg-amber-900 disabled:cursor-wait disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Зберігаємо…" : "Зберегти"}</button><button className="min-h-10 rounded-full px-3 text-sm font-semibold text-stone-600 hover:bg-amber-100" disabled={isSaving} onClick={reset} type="button">Скасувати</button></div>
      </form> : null}
    </>}
  </section>;
}
