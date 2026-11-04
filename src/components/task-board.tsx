"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { readLocalTestTasks, writeLocalTestTasks } from "@/lib/local-test-tasks";
import { formatTaskDate, taskAreaLabels, taskAreaOptions, taskHorizonLabels, taskHorizonOptions, taskStatusLabels } from "@/lib/task-options";
import { createClient } from "@/lib/supabase/client";
import type { Task, TaskArea, TaskHorizon, TaskStatus } from "@/types/task";

type TaskBoardProps = Readonly<{
  tasks: readonly Task[];
  memberName: string;
  testMode: boolean;
  view: "today" | "list" | "history";
}>;

type UpdateKind = TaskStatus;

const taskControlClass = "inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold leading-4 transition-colors disabled:cursor-wait disabled:opacity-60";
const horizonOrder: Record<TaskHorizon, number> = { tactical: 0, operational: 1, strategic: 2 };
const areaOrder: Record<TaskArea, number> = { work: 0, family: 1, personal: 2 };

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

function toggleChoice<T extends string>(current: readonly T[], choice: T) {
  return current.includes(choice) ? current.filter((item) => item !== choice) : [...current, choice];
}

function nextTask(task: Task, kind: UpdateKind, memberName: string, postponedUntil?: string): Task {
  const changedAt = new Date().toISOString();

  if (kind === "completed") {
    return { ...task, status: "completed", postponedUntil: null, completedBy: memberName, completedAt: changedAt, rejectedBy: null, rejectedAt: null };
  }

  if (kind === "rejected") {
    return { ...task, status: "rejected", postponedUntil: null, completedBy: null, completedAt: null, rejectedBy: memberName, rejectedAt: changedAt };
  }

  if (kind === "postponed") {
    return { ...task, status: "postponed", postponedUntil: postponedUntil || oneMonthFromNow(), completedBy: null, completedAt: null, rejectedBy: null, rejectedAt: null };
  }

  return { ...task, status: kind, postponedUntil: null, completedBy: null, completedAt: null, rejectedBy: null, rejectedAt: null };
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
  if (view === "history") return task.status === "completed" || task.status === "rejected";
  if (view === "list") return task.status === "active" || task.status === "in_work" || task.status === "in_progress" || task.status === "postponed";
  if (task.status === "postponed") return task.postponedUntil !== null && task.postponedUntil <= currentDate();

  return (task.status === "active" || task.status === "in_work" || task.status === "in_progress")
    && (task.dueDate === null || task.dueDate <= currentDate());
}

function emptyMessage(view: TaskBoardProps["view"], filtersApplied: boolean) {
  if (filtersApplied) return "За обраними фільтрами задач немає.";
  if (view === "today") return "На сьогодні активних задач немає.";
  if (view === "history") return "Тут з’являться виконані та відхилені задачі.";
  return "Активних, виконуваних або відкладених задач поки немає.";
}

function participantLabel(task: Task) {
  return Array.from(new Set([task.createdByName, ...task.participants.map((participant) => participant.name)])).join(", ");
}

function deadlineLabel(task: Task) {
  if (task.status === "postponed" && task.postponedUntil) return `До ${formatTaskDate(task.postponedUntil)}`;
  return task.dueDate ? formatTaskDate(task.dueDate) : "Без дати";
}

function statusClass(status: TaskStatus) {
  if (status === "completed") return "bg-emerald-100 text-emerald-900";
  if (status === "rejected") return "bg-red-50 text-red-800";
  if (status === "postponed") return "bg-amber-100 text-amber-950";
  if (status === "in_progress") return "bg-sky-100 text-sky-900";
  if (status === "in_work") return "bg-violet-100 text-violet-900";
  return "bg-stone-100 text-stone-700";
}

type TaskActionsProps = Readonly<{
  task: Task;
  view: TaskBoardProps["view"];
  isUpdating: boolean;
  onUpdate: (task: Task, kind: UpdateKind) => void;
  onStartPostponing: (task: Task) => void;
}>;

function TaskActions({ task, view, isUpdating, onUpdate, onStartPostponing }: TaskActionsProps) {
  if (view === "history") return null;

  const postponeButton = <button className={taskControlClass + " border-stone-300 text-stone-700 hover:bg-stone-50"} disabled={isUpdating} onClick={() => onStartPostponing(task)} type="button">Відкласти</button>;
  const rejectButton = <button className={taskControlClass + " border-transparent px-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800"} disabled={isUpdating} onClick={() => onUpdate(task, "rejected")} type="button">Відхилити</button>;

  if (task.status === "active") {
    return <><button className={taskControlClass + " border-amber-800 text-amber-900 hover:bg-amber-50"} disabled={isUpdating} onClick={() => onUpdate(task, "in_work")} type="button">У роботу</button>{postponeButton}{rejectButton}</>;
  }

  if (task.status === "in_work") {
    return <><button className={taskControlClass + " border-sky-700 text-sky-800 hover:bg-sky-50"} disabled={isUpdating} onClick={() => onUpdate(task, "in_progress")} type="button">В процесі</button>{postponeButton}<button className={taskControlClass + " border-transparent px-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800"} disabled={isUpdating} onClick={() => onUpdate(task, "active")} type="button">У план</button></>;
  }

  if (task.status === "in_progress") {
    return <><button className={taskControlClass + " border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800"} disabled={isUpdating} onClick={() => onUpdate(task, "completed")} type="button">Виконано</button>{postponeButton}<button className={taskControlClass + " border-transparent px-2 text-stone-500 hover:bg-stone-100 hover:text-stone-800"} disabled={isUpdating} onClick={() => onUpdate(task, "in_work")} type="button">Назад</button></>;
  }

  return <button className={taskControlClass + " border-amber-800 text-amber-900 hover:bg-amber-50"} disabled={isUpdating} onClick={() => onUpdate(task, "active")} type="button">Активувати</button>;
}

type PostponeControlsProps = Readonly<{
  task: Task;
  date: string;
  isUpdating: boolean;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}>;

function PostponeControls({ task, date, isUpdating, onChange, onConfirm, onCancel }: PostponeControlsProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-sm font-semibold text-amber-950" htmlFor={`postpone-${task.id}`}>Відкласти до дати</label>
        <input className="mt-2 min-h-11 rounded-xl border border-amber-300 bg-white px-3 text-sm font-semibold text-stone-900 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-200" id={`postpone-${task.id}`} min={currentDate()} onChange={(event) => onChange(event.target.value)} type="date" value={date} />
      </div>
      <button className="min-h-11 rounded-full bg-amber-800 px-4 text-sm font-semibold text-white hover:bg-amber-900 disabled:cursor-wait disabled:opacity-60" disabled={isUpdating || !date} onClick={onConfirm} type="button">Підтвердити</button>
      <button className="min-h-11 rounded-full px-3 text-sm font-semibold text-stone-600 hover:bg-amber-100" disabled={isUpdating} onClick={onCancel} type="button">Скасувати</button>
    </div>
  );
}

export function TaskBoard({ tasks, memberName, testMode, view }: TaskBoardProps) {
  const router = useRouter();
  const localTasks = useSyncExternalStore(subscribeToLocalTasks, () => (testMode ? readLocalTestTasks() : tasks), () => tasks);
  const [overriddenItems, setOverriddenItems] = useState<readonly Task[] | null>(null);
  const [selectedAreas, setSelectedAreas] = useState<readonly TaskArea[]>([]);
  const [selectedHorizons, setSelectedHorizons] = useState<readonly TaskHorizon[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [postponingTaskId, setPostponingTaskId] = useState<string | null>(null);
  const [postponeDate, setPostponeDate] = useState("");
  const [error, setError] = useState("");
  const items = overriddenItems ?? localTasks;
  const filtersApplied = selectedAreas.length > 0 || selectedHorizons.length > 0;

  const visibleTasks = useMemo(() => {
    return items
      .filter((task) => isInCurrentView(task, view))
      .filter((task) => selectedAreas.length === 0 || selectedAreas.includes(task.area))
      .filter((task) => selectedHorizons.length === 0 || selectedHorizons.includes(task.horizon))
      .sort((left, right) => {
        const horizonDifference = horizonOrder[left.horizon] - horizonOrder[right.horizon];
        if (horizonDifference !== 0) return horizonDifference;
        const areaDifference = areaOrder[left.area] - areaOrder[right.area];
        if (areaDifference !== 0) return areaDifference;
        return (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31") || left.createdAt.localeCompare(right.createdAt);
      });
  }, [items, selectedAreas, selectedHorizons, view]);

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
      setError("Не вдалося оновити задачу. Якщо новий стан «Взята в роботу» не зберігається, виконайте tasks-status-in-work.sql у Supabase.");
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

  function taskTitle(task: Task) {
    return testMode ? task.title : <Link className="hover:text-amber-800 hover:underline" href={`/tasks/${task.id}`}>{task.title}</Link>;
  }

  return (
    <>
      <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm" aria-label="Керування списком задач">
        <div className="flex flex-wrap items-center gap-2">
          <button aria-expanded={filtersOpen} className="min-h-10 rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50" onClick={() => setFiltersOpen((open) => !open)} type="button">Фільтри{filtersApplied ? ` (${selectedAreas.length + selectedHorizons.length})` : ""}</button>
          {filtersApplied ? <button className="min-h-10 rounded-full px-3 text-sm font-semibold text-stone-600 hover:bg-stone-100" onClick={() => { setSelectedAreas([]); setSelectedHorizons([]); }} type="button">Очистити</button> : null}
          <p className="basis-full text-xs leading-5 text-stone-500 sm:ml-2 sm:basis-auto">Порядок: тактичні → оперативні → стратегічні; у кожній групі: робота → сім’я → особисте.</p>
        </div>

        {filtersOpen ? (
          <div className="mt-4 grid gap-5 border-t border-stone-100 pt-4 sm:grid-cols-2">
            <fieldset>
              <legend className="text-sm font-semibold text-stone-950">Рівень планування</legend>
              <p className="mt-1 text-xs leading-5 text-stone-500">Позначте один або кілька рівнів. Без позначок — усі.</p>
              <div className="mt-3 space-y-2">
                {taskHorizonOptions.map((option) => <label className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-stone-800 hover:bg-stone-50" key={option.value}><input checked={selectedHorizons.includes(option.value)} className="size-4 accent-amber-800" onChange={() => setSelectedHorizons((current) => toggleChoice(current, option.value))} type="checkbox" /><span>{option.label} <span className="text-stone-500">— {option.hint}</span></span></label>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold text-stone-950">Напрям</legend>
              <p className="mt-1 text-xs leading-5 text-stone-500">Можна поєднати, наприклад, лише «Сім’я» з двома рівнями планування.</p>
              <div className="mt-3 space-y-2">
                {taskAreaOptions.map((option) => <label className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-stone-800 hover:bg-stone-50" key={option.value}><input checked={selectedAreas.includes(option.value)} className="size-4 accent-amber-800" onChange={() => setSelectedAreas((current) => toggleChoice(current, option.value))} type="checkbox" /><span>{option.label}</span></label>)}
              </div>
            </fieldset>
          </div>
        ) : null}
      </section>

      {error ? <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-800" role="alert">{error}</p> : null}

      {visibleTasks.length === 0 ? (
        <section className="mt-6 max-w-2xl rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center">
          <h2 className="text-lg font-semibold text-stone-900">{emptyMessage(view, filtersApplied)}</h2>
          {view !== "history" ? <Link className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-amber-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-900" href="/tasks/add">Створити задачу</Link> : null}
        </section>
      ) : (
        <>
          <div className="mt-5 space-y-2 xl:hidden">
            {visibleTasks.map((task) => (
              <article className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm" key={task.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><h2 className="text-sm font-semibold leading-5 text-stone-950">{taskTitle(task)}</h2>{task.goal ? <p className="mt-0.5 text-xs leading-4 text-stone-600">{task.goal}</p> : null}</div>
                  <span className={"shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 " + statusClass(task.status)}>{taskStatusLabels[task.status]}</span>
                </div>
                <div className="mt-2 grid gap-0.5 text-xs leading-4 text-stone-700"><p><span className="font-medium text-stone-950">{taskHorizonLabels[task.horizon]}</span> · {taskAreaLabels[task.area]}</p><p>Строк: {deadlineLabel(task)}</p><p className="text-stone-600">Учасники: {participantLabel(task)}</p></div>
                <div className="mt-2.5 flex flex-wrap gap-1.5"><TaskActions isUpdating={isUpdating === task.id} onStartPostponing={startPostponing} onUpdate={(target, kind) => void updateStatus(target, kind)} task={task} view={view} /></div>
                {postponingTaskId === task.id ? <div className="mt-3 border-t border-amber-100 pt-3"><PostponeControls date={postponeDate} isUpdating={isUpdating === task.id} onCancel={() => setPostponingTaskId(null)} onChange={setPostponeDate} onConfirm={() => void updateStatus(task, "postponed", postponeDate)} task={task} /></div> : null}
              </article>
            ))}
          </div>

          <div className="mt-6 hidden overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm xl:block">
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <caption className="sr-only">Список задач</caption>
                <colgroup><col className="w-[23%]" /><col className="w-[8%]" /><col className="w-[12%]" /><col className="w-[15%]" /><col className="w-[12%]" /><col className="w-[10%]" /><col className="w-[20%]" /></colgroup>
                <thead className="bg-stone-50 text-[11px] uppercase tracking-wide text-stone-600"><tr><th className="px-3 py-3 font-semibold" scope="col">Задача</th><th className="px-3 py-3 font-semibold" scope="col">Напрям</th><th className="px-3 py-3 font-semibold" scope="col">Планування</th><th className="px-3 py-3 font-semibold" scope="col">Учасники</th><th className="px-3 py-3 font-semibold" scope="col">Строк</th><th className="px-3 py-3 font-semibold" scope="col">Стан</th><th className="px-3 py-3 font-semibold"><span className="sr-only">Дії</span></th></tr></thead>
                <tbody>
                  {visibleTasks.map((task) => <Fragment key={task.id}><tr className="border-t border-stone-100 align-top transition-colors hover:bg-stone-50/80"><th className="break-words px-3 py-3 font-semibold text-stone-950" scope="row">{taskTitle(task)}{task.goal ? <p className="mt-0.5 font-normal leading-5 text-stone-600">{task.goal}</p> : null}<p className="mt-1 text-xs font-normal text-stone-500">{task.scopeName}</p></th><td className="break-words px-3 py-3 text-stone-800">{taskAreaLabels[task.area]}</td><td className="break-words px-3 py-3 text-stone-800">{taskHorizonLabels[task.horizon]}</td><td className="break-words px-3 py-3 leading-5 text-stone-800">{participantLabel(task)}</td><td className="break-words px-3 py-3 text-stone-800">{deadlineLabel(task)}</td><td className="px-3 py-3"><span className={"inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold " + statusClass(task.status)}>{taskStatusLabels[task.status]}</span></td><td className="px-3 py-2"><div className="flex flex-col items-stretch gap-1"><TaskActions isUpdating={isUpdating === task.id} onStartPostponing={startPostponing} onUpdate={(target, kind) => void updateStatus(target, kind)} task={task} view={view} /></div></td></tr>{postponingTaskId === task.id ? <tr className="border-t border-amber-100 bg-amber-50"><td className="px-5 py-4" colSpan={7}><PostponeControls date={postponeDate} isUpdating={isUpdating === task.id} onCancel={() => setPostponingTaskId(null)} onChange={setPostponeDate} onConfirm={() => void updateStatus(task, "postponed", postponeDate)} task={task} /></td></tr> : null}</Fragment>)}
                </tbody>
              </table>
          </div>
        </>
      )}
    </>
  );
}
