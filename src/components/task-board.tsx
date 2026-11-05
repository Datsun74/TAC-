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
  projectId?: string;
}>;

type UpdateKind = TaskStatus;

const taskControlClass = "inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-semibold leading-4 transition-colors disabled:cursor-wait disabled:opacity-60";
const horizonOrder: Record<TaskHorizon, number> = { strategic: 0, operational: 1, tactical: 2 };

type ReportRow = Readonly<{
  task: Task;
  showAuthor: boolean;
  showHorizon: boolean;
  showContainer: boolean;
  showExecutor: boolean;
}>;

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

function reportTitle(view: TaskBoardProps["view"]) {
  if (view === "today") return "Задачі на сьогодні";
  if (view === "history") return "Історія задач";
  return "Усі активні задачі";
}

function participantLabel(task: Task) {
  return Array.from(new Set([task.createdByName, ...task.participants.map((participant) => participant.name)])).join(", ");
}

function containerLabel(task: Task) {
  return task.projectName ? `Проєкт: ${task.projectName}` : `Простір: ${task.scopeName}`;
}

function taskMatchesSearch(task: Task, search: string) {
  const query = search.trim().toLocaleLowerCase("uk-UA");
  if (!query) return true;
  return [task.title, task.goal, task.scopeName, task.projectName, task.createdByName, ...task.participants.map((participant) => participant.name)]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLocaleLowerCase("uk-UA").includes(query));
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

export function TaskBoard({ tasks, memberName, testMode, view, projectId }: TaskBoardProps) {
  const router = useRouter();
  const localTasks = useSyncExternalStore(subscribeToLocalTasks, () => (testMode ? readLocalTestTasks() : tasks), () => tasks);
  const [overriddenItems, setOverriddenItems] = useState<readonly Task[] | null>(null);
  const [selectedAreas, setSelectedAreas] = useState<readonly TaskArea[]>([]);
  const [selectedHorizons, setSelectedHorizons] = useState<readonly TaskHorizon[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<readonly string[]>([]);
  const [selectedExecutors, setSelectedExecutors] = useState<readonly string[]>([]);
  const [selectedContainers, setSelectedContainers] = useState<readonly string[]>([]);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [postponingTaskId, setPostponingTaskId] = useState<string | null>(null);
  const [postponeDate, setPostponeDate] = useState("");
  const [error, setError] = useState("");
  const items = overriddenItems ?? localTasks;
  const filtersApplied = Boolean(search.trim()) || selectedAreas.length > 0 || selectedHorizons.length > 0 || selectedAuthors.length > 0 || selectedExecutors.length > 0 || selectedContainers.length > 0;

  const authorOptions = useMemo(() => Array.from(new Set(items.filter((task) => isInCurrentView(task, view)).map((task) => task.createdByName))).sort((left, right) => left.localeCompare(right, "uk")), [items, view]);
  const executorOptions = useMemo(() => Array.from(new Set(items.filter((task) => isInCurrentView(task, view)).map(participantLabel))).sort((left, right) => left.localeCompare(right, "uk")), [items, view]);
  const containerOptions = useMemo(() => Array.from(new Set(items.filter((task) => isInCurrentView(task, view)).map(containerLabel))).sort((left, right) => left.localeCompare(right, "uk")), [items, view]);

  const visibleTasks = useMemo(() => {
    return items
      .filter((task) => isInCurrentView(task, view))
      .filter((task) => !projectId || task.projectId === projectId)
      .filter((task) => taskMatchesSearch(task, search))
      .filter((task) => selectedAreas.length === 0 || selectedAreas.includes(task.area))
      .filter((task) => selectedHorizons.length === 0 || selectedHorizons.includes(task.horizon))
      .filter((task) => selectedAuthors.length === 0 || selectedAuthors.includes(task.createdByName))
      .filter((task) => selectedExecutors.length === 0 || selectedExecutors.includes(participantLabel(task)))
      .filter((task) => selectedContainers.length === 0 || selectedContainers.includes(containerLabel(task)))
      .sort((left, right) => {
        const authorDifference = left.createdByName.localeCompare(right.createdByName, "uk");
        if (authorDifference !== 0) return authorDifference;
        const horizonDifference = horizonOrder[left.horizon] - horizonOrder[right.horizon];
        if (horizonDifference !== 0) return horizonDifference;
        const containerDifference = containerLabel(left).localeCompare(containerLabel(right), "uk");
        if (containerDifference !== 0) return containerDifference;
        const executorDifference = participantLabel(left).localeCompare(participantLabel(right), "uk");
        if (executorDifference !== 0) return executorDifference;
        return left.title.localeCompare(right.title, "uk") || (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31");
      });
  }, [items, projectId, search, selectedAreas, selectedHorizons, selectedAuthors, selectedExecutors, selectedContainers, view]);

  const reportRows = useMemo<readonly ReportRow[]>(() => visibleTasks.map((task, index) => {
    const previous = visibleTasks[index - 1];
    const authorChanged = !previous || previous.createdByName !== task.createdByName;
    const horizonChanged = authorChanged || previous.horizon !== task.horizon;
    const containerChanged = horizonChanged || !previous || containerLabel(previous) !== containerLabel(task);
    const executorChanged = containerChanged || !previous || participantLabel(previous) !== participantLabel(task);
    return { task, showAuthor: authorChanged, showHorizon: horizonChanged, showContainer: containerChanged, showExecutor: executorChanged };
  }), [visibleTasks]);

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
      <section className="task-print-heading">
        <h1>Задачник — {reportTitle(view)}</h1>
        <p>{filtersApplied ? "Звіт сформовано за вибраними фільтрами." : "Звіт без додаткових фільтрів."} Усього задач: {visibleTasks.length}.</p>
      </section>

      <section className="task-print-control mt-8 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm" aria-label="Керування списком задач">
        <div className="flex flex-wrap items-center gap-2">
          <label className="min-w-[13rem] flex-1 sm:max-w-sm"><span className="sr-only">Пошук задач</span><input className="min-h-10 w-full rounded-full border border-stone-300 bg-white px-4 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-amber-700 focus:ring-2 focus:ring-amber-100" onChange={(event) => setSearch(event.target.value)} placeholder="Пошук задач, проєктів, людей…" type="search" value={search} /></label>
          <button aria-expanded={filtersOpen} className="min-h-10 rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50" onClick={() => setFiltersOpen((open) => !open)} type="button">Фільтри{filtersApplied ? ` (${selectedAreas.length + selectedHorizons.length + selectedAuthors.length + selectedExecutors.length + selectedContainers.length + (search.trim() ? 1 : 0)})` : ""}</button>
          {filtersApplied ? <button className="min-h-10 rounded-full px-3 text-sm font-semibold text-stone-600 hover:bg-stone-100" onClick={() => { setSearch(""); setSelectedAreas([]); setSelectedHorizons([]); setSelectedAuthors([]); setSelectedExecutors([]); setSelectedContainers([]); }} type="button">Очистити</button> : null}
          <button className="min-h-10 rounded-full border border-amber-800 px-4 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-50" onClick={() => window.print()} type="button">Друк / PDF</button>
          <p className="basis-full text-xs leading-5 text-stone-500 sm:ml-2 sm:basis-auto">Порядок звіту: автор → стратегічні / оперативні / тактичні → простір або проєкт → виконавець → задача → статус.</p>
        </div>

        {filtersOpen ? (
          <div className="mt-4 grid gap-5 border-t border-stone-100 pt-4 sm:grid-cols-2 xl:grid-cols-3">
            <fieldset>
              <legend className="text-sm font-semibold text-stone-950">Рівень планування</legend>
              <p className="mt-1 text-xs leading-5 text-stone-500">Позначте один або кілька рівнів. Без позначок — усі.</p>
              <div className="mt-3 space-y-2">
                {taskHorizonOptions.map((option) => <label className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-stone-800 hover:bg-stone-50" key={option.value}><input checked={selectedHorizons.includes(option.value)} className="size-4 accent-amber-800" onChange={() => setSelectedHorizons((current) => toggleChoice(current, option.value))} type="checkbox" /><span>{option.label} <span className="text-stone-500">— {option.hint}</span></span></label>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold text-stone-950">Автор</legend>
              <p className="mt-1 text-xs leading-5 text-stone-500">Хто створив задачу.</p>
              <div className="mt-3 space-y-2">
                {authorOptions.map((author) => <label className="flex min-h-9 items-center gap-3 rounded-xl px-3 text-sm text-stone-800 hover:bg-stone-50" key={author}><input checked={selectedAuthors.includes(author)} className="size-4 accent-amber-800" onChange={() => setSelectedAuthors((current) => toggleChoice(current, author))} type="checkbox" /><span>{author}</span></label>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold text-stone-950">Виконавець</legend>
              <p className="mt-1 text-xs leading-5 text-stone-500">Автор і всі запрошені учасники задачі.</p>
              <div className="mt-3 space-y-2">
                {executorOptions.map((executor) => <label className="flex min-h-9 items-center gap-3 rounded-xl px-3 text-sm text-stone-800 hover:bg-stone-50" key={executor}><input checked={selectedExecutors.includes(executor)} className="size-4 accent-amber-800" onChange={() => setSelectedExecutors((current) => toggleChoice(current, executor))} type="checkbox" /><span>{executor}</span></label>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold text-stone-950">Простір / проєкт</legend>
              <p className="mt-1 text-xs leading-5 text-stone-500">Можна поєднати кілька постійних просторів і проєктів.</p>
              <div className="mt-3 space-y-2">
                {containerOptions.map((container) => <label className="flex min-h-9 items-center gap-3 rounded-xl px-3 text-sm text-stone-800 hover:bg-stone-50" key={container}><input checked={selectedContainers.includes(container)} className="size-4 accent-amber-800" onChange={() => setSelectedContainers((current) => toggleChoice(current, container))} type="checkbox" /><span>{container}</span></label>)}
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
          <div className="task-list-print-cards mt-5 space-y-2 xl:hidden">
            {visibleTasks.map((task) => (
              <article className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm" key={task.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><h2 className="text-sm font-semibold leading-5 text-stone-950">{taskTitle(task)}</h2>{task.goal ? <p className="mt-0.5 text-xs leading-4 text-stone-600">{task.goal}</p> : null}</div>
                  <span className={"shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 " + statusClass(task.status)}>{taskStatusLabels[task.status]}</span>
                </div>
                <div className="mt-2 grid gap-0.5 text-xs leading-4 text-stone-700"><p><span className="font-medium text-stone-950">{taskHorizonLabels[task.horizon]}</span> · {taskAreaLabels[task.area]}</p><p>{containerLabel(task)}</p><p>Строк: {deadlineLabel(task)}</p><p className="text-stone-600">Учасники: {participantLabel(task)}</p></div>
                <div className="task-print-action mt-2.5 flex flex-wrap gap-1.5"><TaskActions isUpdating={isUpdating === task.id} onStartPostponing={startPostponing} onUpdate={(target, kind) => void updateStatus(target, kind)} task={task} view={view} /></div>
                {postponingTaskId === task.id ? <div className="mt-3 border-t border-amber-100 pt-3"><PostponeControls date={postponeDate} isUpdating={isUpdating === task.id} onCancel={() => setPostponingTaskId(null)} onChange={setPostponeDate} onConfirm={() => void updateStatus(task, "postponed", postponeDate)} task={task} /></div> : null}
              </article>
            ))}
          </div>

          <div className="task-list-table-wrapper mt-6 hidden overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm xl:block">
              <table className="task-list-table w-full table-fixed border-collapse text-left text-sm">
                <caption className="sr-only">Звіт задач, згрупований за автором, плануванням, простором або проєктом та виконавцем</caption>
                <colgroup><col className="w-[11%]" /><col className="w-[12%]" /><col className="w-[15%]" /><col className="w-[14%]" /><col className="w-[26%]" /><col className="w-[9%]" /><col className="w-[13%]" /></colgroup>
                <thead className="bg-stone-50 text-[11px] uppercase tracking-wide text-stone-600"><tr><th className="px-3 py-3 font-semibold" scope="col">Автор</th><th className="px-3 py-3 font-semibold" scope="col">Планування</th><th className="px-3 py-3 font-semibold" scope="col">Простір / проєкт</th><th className="px-3 py-3 font-semibold" scope="col">Виконавець</th><th className="px-3 py-3 font-semibold" scope="col">Назва / суть і коментар</th><th className="px-3 py-3 font-semibold" scope="col">Статус</th><th className="task-print-action px-3 py-3 font-semibold"><span className="sr-only">Дії</span></th></tr></thead>
                <tbody>
                  {reportRows.map((row) => {
                    const task = row.task;
                    return <Fragment key={task.id}>
                      {row.showAuthor ? <tr className="border-t border-stone-200 bg-stone-50/70"><th className="break-words px-3 py-2.5 font-semibold text-stone-950" scope="rowgroup">{task.createdByName}</th><td colSpan={6} /></tr> : null}
                      {row.showHorizon ? <tr className="border-t border-stone-100 bg-stone-50/40"><td /><th className="break-words px-3 py-2 text-sm font-semibold text-stone-800" scope="rowgroup">{taskHorizonLabels[task.horizon]}</th><td colSpan={5} /></tr> : null}
                      {row.showContainer ? <tr className="border-t border-stone-100"><td /><td /><th className="break-words px-3 py-2 text-sm font-semibold text-stone-800" scope="rowgroup">{containerLabel(task)}</th><td colSpan={4} /></tr> : null}
                      {row.showExecutor ? <tr className="border-t border-stone-100"><td /><td /><td /><th className="break-words px-3 py-2 text-sm font-semibold text-stone-800" scope="rowgroup">{participantLabel(task)}</th><td colSpan={3} /></tr> : null}
                      <tr className="border-t border-stone-100 align-top transition-colors hover:bg-stone-50/80"><td /><td /><td /><td /><th className="break-words px-3 py-2.5 font-semibold text-stone-950" scope="row">{taskTitle(task)}{task.projectName ? <p className="mt-1 text-xs font-semibold text-amber-800">Проєкт: {task.projectName}</p> : null}<p className="mt-1 text-xs font-normal text-stone-500">{taskAreaLabels[task.area]} · Строк: {deadlineLabel(task)}</p>{task.goal ? <p className="mt-1 font-normal leading-5 text-stone-600">{task.goal}</p> : null}</th><td className="px-3 py-2.5"><span className={"inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold " + statusClass(task.status)}>{taskStatusLabels[task.status]}</span></td><td className="task-print-action px-3 py-2"><div className="flex flex-col items-stretch gap-1"><TaskActions isUpdating={isUpdating === task.id} onStartPostponing={startPostponing} onUpdate={(target, kind) => void updateStatus(target, kind)} task={task} view={view} /></div></td></tr>
                      {postponingTaskId === task.id ? <tr className="border-t border-amber-100 bg-amber-50"><td className="px-5 py-4" colSpan={7}><PostponeControls date={postponeDate} isUpdating={isUpdating === task.id} onCancel={() => setPostponingTaskId(null)} onChange={setPostponeDate} onConfirm={() => void updateStatus(task, "postponed", postponeDate)} task={task} /></td></tr> : null}
                    </Fragment>;
                  })}
                </tbody>
              </table>
          </div>
        </>
      )}
    </>
  );
}
