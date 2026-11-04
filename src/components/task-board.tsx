"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { readLocalTestTasks, writeLocalTestTasks } from "@/lib/local-test-tasks";
import { formatTaskDate, taskAreaLabels, taskHorizonLabels, taskStatusLabels } from "@/lib/task-options";
import { createClient } from "@/lib/supabase/client";
import type { Task, TaskArea } from "@/types/task";

type TaskBoardProps = Readonly<{
  tasks: readonly Task[];
  memberName: string;
  testMode: boolean;
  view: "today" | "list" | "history";
}>;

type UpdateKind = "active" | "in_progress" | "completed" | "rejected" | "postponed";

function subscribeToLocalTasks() {
  return () => {};
}

function currentDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return date.getFullYear() + "-" + month + "-" + day;
}

function oneMonthFromNow() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(1);
  date.setMonth(date.getMonth() + 1);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return date.getFullYear() + "-" + month + "-" + day;
}

function nextTask(task: Task, kind: UpdateKind, memberName: string, postponedUntil?: string): Task {
  const changedAt = new Date().toISOString();

  if (kind === "completed") {
    return {
      ...task,
      status: "completed",
      postponedUntil: null,
      completedBy: memberName,
      completedAt: changedAt,
      rejectedBy: null,
      rejectedAt: null,
    };
  }

  if (kind === "rejected") {
    return {
      ...task,
      status: "rejected",
      postponedUntil: null,
      completedBy: null,
      completedAt: null,
      rejectedBy: memberName,
      rejectedAt: changedAt,
    };
  }

  if (kind === "postponed") {
    return {
      ...task,
      status: "postponed",
      postponedUntil: postponedUntil || oneMonthFromNow(),
      completedBy: null,
      completedAt: null,
      rejectedBy: null,
      rejectedAt: null,
    };
  }

  if (kind === "in_progress") {
    return {
      ...task,
      status: "in_progress",
      postponedUntil: null,
      completedBy: null,
      completedAt: null,
      rejectedBy: null,
      rejectedAt: null,
    };
  }

  return {
    ...task,
    status: "active",
    postponedUntil: null,
    completedBy: null,
    completedAt: null,
    rejectedBy: null,
    rejectedAt: null,
  };
}

function taskUpdate(task: Task) {
  return {
    status: task.status,
    postponed_until: task.postponedUntil,
    completed_by: task.completedBy,
    completed_at: task.completedAt,
    rejected_by: task.rejectedBy,
    rejected_at: task.rejectedAt,
  };
}

function isInCurrentView(task: Task, view: TaskBoardProps["view"]) {
  if (view === "history") {
    return task.status === "completed" || task.status === "rejected";
  }

  if (view === "list") {
    return task.status === "active" || task.status === "in_progress" || task.status === "postponed";
  }

  if (task.status === "postponed") {
    return task.postponedUntil !== null && task.postponedUntil <= currentDate();
  }

  // A task without a date is still part of today's review. Otherwise it is
  // too easy to create an important task and lose it from view immediately.
  return (task.status === "active" || task.status === "in_progress")
    && (task.dueDate === null || task.dueDate <= currentDate());
}

function emptyMessage(view: TaskBoardProps["view"]) {
  if (view === "today") {
    return "На сьогодні активних задач немає.";
  }

  if (view === "history") {
    return "Тут з’являться виконані та відхилені задачі.";
  }

  return "Активних, виконуваних або відкладених задач поки немає.";
}

export function TaskBoard({ tasks, memberName, testMode, view }: TaskBoardProps) {
  const router = useRouter();
  const localTasks = useSyncExternalStore(
    subscribeToLocalTasks,
    () => (testMode ? readLocalTestTasks() : tasks),
    () => tasks,
  );
  const [overriddenItems, setOverriddenItems] = useState<readonly Task[] | null>(null);
  const [area, setArea] = useState<TaskArea | "all">("all");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [postponingTaskId, setPostponingTaskId] = useState<string | null>(null);
  const [postponeDate, setPostponeDate] = useState("");
  const [error, setError] = useState("");
  const items = overriddenItems ?? localTasks;

  const visibleTasks = useMemo(
    () => items.filter((task) => isInCurrentView(task, view) && (area === "all" || task.area === area)),
    [area, items, view],
  );

  async function updateStatus(task: Task, kind: UpdateKind, postponedUntil?: string) {
    const updatedTask = nextTask(task, kind, memberName, postponedUntil);
    const previousItems = items;
    const updatedItems = items.map((item) => (item.id === task.id ? updatedTask : item));

    setError("");
    setIsUpdating(task.id);
    setOverriddenItems(updatedItems);

    if (testMode) {
      writeLocalTestTasks(updatedItems);
      if (kind === "postponed") setPostponingTaskId(null);
      setIsUpdating(null);
      return;
    }

    const { error: updateError } = await createClient().from("tasks").update(taskUpdate(updatedTask)).eq("id", task.id);

    if (updateError) {
      setOverriddenItems(previousItems);
      setError("Не вдалося оновити задачу. Спробуйте ще раз.");
    } else {
      if (kind === "postponed") setPostponingTaskId(null);
      router.refresh();
    }

    setIsUpdating(null);
  }

  function startPostponing(task: Task) {
    setPostponingTaskId(task.id);
    setPostponeDate(task.postponedUntil ?? oneMonthFromNow());
  }

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-2" aria-label="Фільтр за напрямом">
        <button className={"min-h-10 rounded-full px-4 text-sm font-semibold transition-colors " + (area === "all" ? "bg-amber-800 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200")} onClick={() => setArea("all")} type="button">
          Усі
        </button>
        {(Object.keys(taskAreaLabels) as TaskArea[]).map((value) => (
          <button className={"min-h-10 rounded-full px-4 text-sm font-semibold transition-colors " + (area === value ? "bg-amber-800 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200")} key={value} onClick={() => setArea(value)} type="button">
            {taskAreaLabels[value]}
          </button>
        ))}
      </div>

      {error ? <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p> : null}

      {visibleTasks.length === 0 ? (
        <section className="mt-6 max-w-2xl rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center">
          <h2 className="text-lg font-semibold text-stone-900">{emptyMessage(view)}</h2>
          {view !== "history" ? <Link className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-amber-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-900" href="/tasks/add">Створити задачу</Link> : null}
        </section>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {visibleTasks.map((task) => (
            <article className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6" key={task.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-950">{taskAreaLabels[task.area]}</span>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-700">{taskHorizonLabels[task.horizon]}</span>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-700">{task.scopeName}</span>
                    {task.status !== "active" ? <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-700">{taskStatusLabels[task.status]}</span> : null}
                  </div>
                  {testMode ? (
                    <h2 className="mt-4 text-xl font-semibold tracking-tight text-stone-950">{task.title}</h2>
                  ) : (
                    <h2 className="mt-4 text-xl font-semibold tracking-tight text-stone-950"><Link className="hover:text-amber-800 hover:underline" href={"/tasks/" + task.id}>{task.title}</Link></h2>
                  )}
                </div>
                {task.dueDate ? <p className="shrink-0 text-right text-xs font-semibold text-stone-600">До<br />{formatTaskDate(task.dueDate)}</p> : null}
              </div>

              {task.goal ? <p className="mt-3 text-sm leading-6 text-stone-600">{task.goal}</p> : null}

              <dl className="mt-5 grid gap-3 border-t border-stone-100 pt-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-stone-500">Створив</dt>
                  <dd className="mt-1 font-medium text-stone-800">{task.createdByName}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">{task.participants.length > 0 ? "Учасники" : "Доступ"}</dt>
                  <dd className="mt-1 font-medium text-stone-800">{task.participants.length > 0 ? task.participants.map((participant) => participant.name).join(", ") : "Особиста задача"}</dd>
                </div>
                {task.status === "postponed" && task.postponedUntil ? <div className="sm:col-span-2"><dt className="text-stone-500">Відкладено до</dt><dd className="mt-1 font-medium text-stone-800">{formatTaskDate(task.postponedUntil)}</dd></div> : null}
                {task.status === "completed" && task.completedBy && task.completedAt ? <div className="sm:col-span-2"><dt className="text-stone-500">Виконав</dt><dd className="mt-1 font-medium text-stone-800">{task.completedBy}</dd></div> : null}
                {task.status === "rejected" && task.rejectedBy ? <div className="sm:col-span-2"><dt className="text-stone-500">Відхилив</dt><dd className="mt-1 font-medium text-stone-800">{task.rejectedBy}</dd></div> : null}
              </dl>

              {view !== "history" ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {task.status === "active" ? (
                    <>
                      <button className="min-h-10 rounded-full bg-amber-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-amber-900 disabled:cursor-wait disabled:opacity-60" disabled={isUpdating === task.id} onClick={() => void updateStatus(task, "in_progress")} type="button">Взяти в роботу</button>
                      <button className="min-h-10 rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60" disabled={isUpdating === task.id} onClick={() => void updateStatus(task, "completed")} type="button">Виконано</button>
                      <button className="min-h-10 rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-wait disabled:opacity-60" disabled={isUpdating === task.id} onClick={() => startPostponing(task)} type="button">Відкласти</button>
                      <button className="min-h-10 rounded-full px-3 text-sm font-semibold text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 disabled:cursor-wait disabled:opacity-60" disabled={isUpdating === task.id} onClick={() => void updateStatus(task, "rejected")} type="button">Відхилити</button>
                    </>
                  ) : task.status === "in_progress" ? (
                    <>
                      <button className="min-h-10 rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60" disabled={isUpdating === task.id} onClick={() => void updateStatus(task, "completed")} type="button">Виконано</button>
                      <button className="min-h-10 rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-wait disabled:opacity-60" disabled={isUpdating === task.id} onClick={() => startPostponing(task)} type="button">Відкласти</button>
                      <button className="min-h-10 rounded-full px-3 text-sm font-semibold text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 disabled:cursor-wait disabled:opacity-60" disabled={isUpdating === task.id} onClick={() => void updateStatus(task, "active")} type="button">Повернути в план</button>
                    </>
                  ) : (
                    <button className="min-h-10 rounded-full border border-amber-800 px-4 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-50 disabled:cursor-wait disabled:opacity-60" disabled={isUpdating === task.id} onClick={() => void updateStatus(task, "active")} type="button">Повернути в активні</button>
                  )}
                </div>
              ) : null}

              {postponingTaskId === task.id ? (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <label className="block text-sm font-semibold text-amber-950" htmlFor={`postpone-${task.id}`}>Відкласти до дати</label>
                  <p className="mt-1 text-sm text-amber-900">Задача зникне з активного списку, але залишиться у плані та повернеться до роботи у вибраний день.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <input className="min-h-11 rounded-xl border border-amber-300 bg-white px-3 text-sm font-semibold text-stone-900 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200" id={`postpone-${task.id}`} min={currentDate()} onChange={(event) => setPostponeDate(event.target.value)} type="date" value={postponeDate} />
                    <button className="min-h-11 rounded-full bg-amber-800 px-4 text-sm font-semibold text-white hover:bg-amber-900 disabled:cursor-wait disabled:opacity-60" disabled={isUpdating === task.id || !postponeDate} onClick={() => void updateStatus(task, "postponed", postponeDate)} type="button">Підтвердити</button>
                    <button className="min-h-11 rounded-full px-3 text-sm font-semibold text-stone-600 hover:bg-amber-100" disabled={isUpdating === task.id} onClick={() => setPostponingTaskId(null)} type="button">Скасувати</button>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
