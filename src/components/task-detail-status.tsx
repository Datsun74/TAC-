"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { taskStatusLabels } from "@/lib/task-options";
import type { TaskStatus } from "@/types/task";

type TaskDetailStatusProps = Readonly<{
  memberName: string;
  postponedUntil: string | null;
  status: TaskStatus;
  taskId: string;
}>;

const actionClass = "inline-flex min-h-10 items-center justify-center rounded-full border px-4 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60";

function currentDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function oneMonthFromNow() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(1);
  date.setMonth(date.getMonth() + 1);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function updateValues(status: TaskStatus, memberName: string, postponedUntil?: string) {
  const changedAt = new Date().toISOString();
  if (status === "completed") return { status, postponed_until: null, completed_by: memberName, completed_at: changedAt, rejected_by: null, rejected_at: null };
  if (status === "rejected") return { status, postponed_until: null, completed_by: null, completed_at: null, rejected_by: memberName, rejected_at: changedAt };
  if (status === "postponed") return { status, postponed_until: postponedUntil ?? oneMonthFromNow(), completed_by: null, completed_at: null, rejected_by: null, rejected_at: null };
  return { status, postponed_until: null, completed_by: null, completed_at: null, rejected_by: null, rejected_at: null };
}

export function TaskDetailStatus({ memberName, postponedUntil, status, taskId }: TaskDetailStatusProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isPostponing, setIsPostponing] = useState(false);
  const [postponeDate, setPostponeDate] = useState(postponedUntil ?? oneMonthFromNow());
  const [error, setError] = useState("");

  async function changeStatus(nextStatus: TaskStatus, date?: string) {
    const values = updateValues(nextStatus, memberName, date);
    setError("");
    setIsUpdating(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.from("tasks").update(values).eq("id", taskId);

    if (updateError) {
      setError("Не вдалося змінити стан задачі. Оновіть сторінку й спробуйте ще раз.");
      setIsUpdating(false);
      return;
    }

    await supabase.from("task_activity_events").insert({
      task_id: taskId,
      event_type: "status_changed",
      actor_name: memberName,
      previous_status: status,
      next_status: nextStatus,
    });
    setIsUpdating(false);
    setIsPostponing(false);
    router.refresh();
  }

  const primaryAction = status === "active"
    ? <button className={`${actionClass} border-amber-800 text-amber-900 hover:bg-amber-50`} disabled={isUpdating} onClick={() => void changeStatus("in_work")} type="button">У роботу</button>
    : status === "in_work"
      ? <button className={`${actionClass} border-sky-700 text-sky-800 hover:bg-sky-50`} disabled={isUpdating} onClick={() => void changeStatus("in_progress")} type="button">У процесі</button>
      : status === "in_progress"
        ? <button className={`${actionClass} border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800`} disabled={isUpdating} onClick={() => void changeStatus("completed")} type="button">Виконано</button>
        : status === "postponed"
          ? <button className={`${actionClass} border-amber-800 text-amber-900 hover:bg-amber-50`} disabled={isUpdating} onClick={() => void changeStatus("active")} type="button">Активувати</button>
          : null;

  return (
    <section className="mt-7 border-t border-stone-100 pt-5" aria-label="Керування станом задачі">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-stone-950">Стан задачі</h2><p className="mt-1 text-sm text-stone-600">Зараз: {taskStatusLabels[status]}.</p></div><div className="flex flex-wrap gap-2">{primaryAction}</div></div>
      {status === "active" ? <div className="mt-4 flex flex-wrap gap-2"><button className={`${actionClass} border-stone-300 text-stone-700 hover:bg-stone-50`} disabled={isUpdating} onClick={() => setIsPostponing(true)} type="button">Відкласти</button><button className={`${actionClass} border-transparent px-3 text-stone-600 hover:bg-stone-100`} disabled={isUpdating} onClick={() => void changeStatus("rejected")} type="button">Відхилити</button></div> : null}
      {status === "in_work" ? <div className="mt-4 flex flex-wrap gap-2"><button className={`${actionClass} border-stone-300 text-stone-700 hover:bg-stone-50`} disabled={isUpdating} onClick={() => setIsPostponing(true)} type="button">Відкласти</button><button className={`${actionClass} border-transparent px-3 text-stone-600 hover:bg-stone-100`} disabled={isUpdating} onClick={() => void changeStatus("active")} type="button">У план</button></div> : null}
      {status === "in_progress" ? <div className="mt-4 flex flex-wrap gap-2"><button className={`${actionClass} border-stone-300 text-stone-700 hover:bg-stone-50`} disabled={isUpdating} onClick={() => setIsPostponing(true)} type="button">Відкласти</button><button className={`${actionClass} border-transparent px-3 text-stone-600 hover:bg-stone-100`} disabled={isUpdating} onClick={() => void changeStatus("in_work")} type="button">Назад</button></div> : null}
      {isPostponing ? <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl bg-amber-50 p-3"><label className="text-sm font-semibold text-amber-950" htmlFor="task-detail-postpone-date">Відкласти до<input className="mt-2 block min-h-10 rounded-xl border border-amber-300 bg-white px-3 text-sm text-stone-950 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200" id="task-detail-postpone-date" min={currentDate()} onChange={(event) => setPostponeDate(event.target.value)} type="date" value={postponeDate} /></label><button className={`${actionClass} border-amber-800 bg-amber-800 text-white hover:bg-amber-900`} disabled={isUpdating || !postponeDate} onClick={() => void changeStatus("postponed", postponeDate)} type="button">Підтвердити</button><button className={`${actionClass} border-transparent px-3 text-stone-600 hover:bg-amber-100`} disabled={isUpdating} onClick={() => setIsPostponing(false)} type="button">Скасувати</button></div> : null}
      {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm leading-6 text-red-800" role="alert">{error}</p> : null}
    </section>
  );
}
