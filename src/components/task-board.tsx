"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useSyncExternalStore } from "react";
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

function participantLabel(task: Task) {
  return Array.from(new Set([task.createdByName, ...task.participants.map((participant) => participant.name)])).join(", ");
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
        <div className="mt-6 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[76rem] w-full border-collapse text-left text-sm">
              <caption className="sr-only">Список задач</caption>
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-600">
                <tr>
                  <th className="min-w-72 px-5 py-3 font-semibold" scope="col">Задача</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Напрям</th>
                  <th className="px-4 py-3 font-semibold" scope="col">Планування</th>
                  <th className="min-w-44 px-4 py-3 font-semibold" scope="col">Учасники</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold" scope="col">Строк</th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold" scope="col">Стан</th>
                  <th className="px-4 py-3 font-semibold"><span className="sr-only">Дії</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleTasks.map((task) => (
                  <Fragment key={task.id}>
                    <tr className="border-t border-stone-100 align-top transition-colors hover:bg-stone-50/80">
                      <th className="px-5 py-4 font-semibold text-stone-950" scope="row">
                        {testMode ? task.title : <Link className="hover:text-amber-800 hover:underline" href={`/tasks/${task.id}`}>{task.title}</Link>}
                        {task.goal ? <p className="mt-1 max-w-xl font-normal leading-5 text-stone-600">{task.goal}</p> : null}
                        <p className="mt-2 text-xs font-normal text-stone-500">{task.scopeName}</p>
                      </th>
                      <td className="whitespace-nowrap px-4 py-4 text-stone-800">{taskAreaLabels[task.area]}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-stone-800">{taskHorizonLabels[task.horizon]}</td>
                      <td className="px-4 py-4 leading-5 text-stone-800">{participantLabel(task)}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-stone-800">
                        {task.status === "postponed" && task.postponedUntil ? `До ${formatTaskDate(task.postponedUntil)}` : task.dueDate ? formatTaskDate(task.dueDate) : "Без дати"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4"><span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (task.status === "completed" ? "bg-emerald-100 text-emerald-900" : task.status === "rejected" ? "bg-red-50 text-red-800" : task.status === "postponed" ? "bg-amber-100 text-amber-950" : task.status === "in_progress" ? "bg-sky-100 text-sky-900" : "bg-stone-100 text-stone-700")}>{taskStatusLabels[task.status]}</span></td>
                      <td className="px-4 py-3">
                        {view !== "history" ? (
                          <div className="flex min-w-max flex-wrap gap-2">
                            {task.status === "active" ? (
                              <>
                                <button className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full border border-amber-800 px-3 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-50 disabled:cursor-wait disabled:opacity-60" disabled={isUpdating === task.id} onClick={() => void updateStatus(task, "in_progress")} type="button">В роботу</button>
                                <button className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full bg-emerald-700 px-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60" disabled={isUpdating === task.id} onClick={() => void updateStatus(task, "completed")} type="button">Виконано</button>
                                <button className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full border border-stone-300 px-3 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-wait disabled:opacity-60" disabled={isUpdating === task.id} onClick={() => startPostponing(task)} type="button">Відкласти</button>
                                <button className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full px-2 text-sm font-semibold text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 disabled:cursor-wait disabled:opacity-60" disabled={isUpdating === task.id} onClick={() => void updateStatus(task, "rejected")} type="button">Відхилити</button>
                              </>
                            ) : task.status === "in_progress" ? (
                              <>
                                <button className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full bg-emerald-700 px-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60" disabled={isUpdating === task.id} onClick={() => void updateStatus(task, "completed")} type="button">Виконано</button>
                                <button className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full border border-stone-300 px-3 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-wait disabled:opacity-60" disabled={isUpdating === task.id} onClick={() => startPostponing(task)} type="button">Відкласти</button>
                                <button className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full px-2 text-sm font-semibold text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 disabled:cursor-wait disabled:opacity-60" disabled={isUpdating === task.id} onClick={() => void updateStatus(task, "active")} type="button">У план</button>
                              </>
                            ) : (
                              <button className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full border border-amber-800 px-3 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-50 disabled:cursor-wait disabled:opacity-60" disabled={isUpdating === task.id} onClick={() => void updateStatus(task, "active")} type="button">Активувати</button>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                    {postponingTaskId === task.id ? (
                      <tr className="border-t border-amber-100 bg-amber-50">
                        <td className="px-5 py-4" colSpan={7}>
                          <div className="flex flex-wrap items-end gap-3">
                            <div>
                              <label className="block text-sm font-semibold text-amber-950" htmlFor={`postpone-${task.id}`}>Відкласти до дати</label>
                              <input className="mt-2 min-h-11 rounded-xl border border-amber-300 bg-white px-3 text-sm font-semibold text-stone-900 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200" id={`postpone-${task.id}`} min={currentDate()} onChange={(event) => setPostponeDate(event.target.value)} type="date" value={postponeDate} />
                            </div>
                            <button className="min-h-11 rounded-full bg-amber-800 px-4 text-sm font-semibold text-white hover:bg-amber-900 disabled:cursor-wait disabled:opacity-60" disabled={isUpdating === task.id || !postponeDate} onClick={() => void updateStatus(task, "postponed", postponeDate)} type="button">Підтвердити</button>
                            <button className="min-h-11 rounded-full px-3 text-sm font-semibold text-stone-600 hover:bg-amber-100" disabled={isUpdating === task.id} onClick={() => setPostponingTaskId(null)} type="button">Скасувати</button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
