"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type DragEvent, useMemo, useState, useSyncExternalStore } from "react";

import { TaskStickyNotes } from "@/components/task-sticky-notes";
import { readLocalTestTasks, writeLocalTestTasks } from "@/lib/local-test-tasks";
import { createClient } from "@/lib/supabase/client";
import { taskAreaLabels, taskHorizonLabels, taskStatusLabels } from "@/lib/task-options";
import type { Task } from "@/types/task";

type TaskDailyPlanBoardProps = Readonly<{
  tasks: readonly Task[];
  memberName: string;
  testMode: boolean;
}>;

type DailyColumn = "today" | "tomorrow";

const hours = Array.from({ length: 13 }, (_, index) => index + 8);

function subscribeToLocalTasks() {
  return () => {};
}

function dateForOffset(days: number) {
  const value = new Date();
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function peopleForTask(task: Task) {
  return Array.from(new Set([task.assigneeName ?? task.createdByName, ...task.participants.map((participant) => participant.name)])).join(", ");
}

function planLabel(task: Task, today: string, tomorrow: string) {
  if (!task.dailyPlanDate || task.dailyPlanHour === null) return "Не запланована на день";
  const day = task.dailyPlanDate === today ? "Сьогодні" : task.dailyPlanDate === tomorrow ? "Завтра" : task.dailyPlanDate;
  return `${day} · ${hourLabel(task.dailyPlanHour)}`;
}

function planErrorMessage() {
  return "Не вдалося оновити денний план. Перевірте, чи виконано файл supabase/task-daily-plan.sql у Supabase SQL Editor.";
}

function CompactTaskCard({ task, today, tomorrow, testMode, onStart, onClear, onComplete, draggable, onDragEnd, onDragStart }: Readonly<{
  task: Task;
  today: string;
  tomorrow: string;
  testMode: boolean;
  onStart?: () => void;
  onClear?: () => void;
  onComplete?: () => void;
  draggable?: boolean;
  onDragEnd?: () => void;
  onDragStart?: (event: DragEvent<HTMLElement>) => void;
}>) {
  const title = testMode
    ? task.title
    : <Link className="font-semibold text-stone-950 hover:text-amber-800 hover:underline" draggable={false} href={`/tasks/${task.id}`}>{task.title}</Link>;

  return (
    <article aria-label={`Задача: ${task.title}`} className="rounded-lg border border-stone-200 bg-white px-2.5 py-2 shadow-sm" draggable={draggable} onDragEnd={onDragEnd} onDragStart={onDragStart}>
      <div className={draggable ? "cursor-grab active:cursor-grabbing" : ""}>
        <h3 className="break-words text-xs leading-4">{title}</h3>
        <p className="mt-1 truncate text-[10px] leading-4 text-stone-500" title={peopleForTask(task)}>{task.projectName ? `Проєкт · ${task.projectName}` : `${taskAreaLabels[task.area]} · ${taskHorizonLabels[task.horizon]}`}</p>
        {task.dailyPlanDate ? <p className="text-[10px] leading-4 text-stone-500">{planLabel(task, today, tomorrow)}</p> : null}
      </div>
      {onStart || onClear || onComplete ? <div className="mt-2 flex flex-wrap gap-1">
        {onStart ? <button className="rounded-md bg-sky-700 px-2 py-1 text-[10px] font-semibold text-white hover:bg-sky-800" onClick={onStart} type="button">Взяти у процес</button> : null}
        {onComplete ? <button className="rounded-md bg-emerald-700 px-2 py-1 text-[10px] font-semibold text-white hover:bg-emerald-800" onClick={onComplete} type="button">✓ Виконано</button> : null}
        {onClear ? <button className="rounded-md border border-stone-300 px-2 py-1 text-[10px] font-semibold text-stone-700 hover:bg-stone-50" onClick={onClear} type="button">Зняти</button> : null}
      </div> : null}
    </article>
  );
}

function DeadlineTaskCard({ task, testMode }: Readonly<{ task: Task; testMode: boolean }>) {
  const title = testMode
    ? task.title
    : <Link className="font-semibold text-stone-950 hover:text-amber-800 hover:underline" href={`/tasks/${task.id}`}>{task.title}</Link>;

  return <article className="rounded-lg border border-white/80 bg-white/85 px-2.5 py-2 shadow-sm">
    <div className="flex items-start justify-between gap-2"><h3 className="min-w-0 break-words text-xs leading-4">{title}</h3><span className="shrink-0 rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-stone-700">{taskStatusLabels[task.status]}</span></div>
    <p className="mt-1 truncate text-[10px] leading-4 text-stone-600">{task.projectName ? `Проєкт · ${task.projectName}` : `${taskAreaLabels[task.area]} · ${taskHorizonLabels[task.horizon]}`}</p>
  </article>;
}

export function TaskDailyPlanBoard({ tasks, memberName, testMode }: TaskDailyPlanBoardProps) {
  const router = useRouter();
  const localTasks = useSyncExternalStore(subscribeToLocalTasks, () => (testMode ? readLocalTestTasks() : tasks), () => tasks);
  const [overriddenItems, setOverriddenItems] = useState<readonly Task[] | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const items = overriddenItems ?? localTasks;
  const today = dateForOffset(0);
  const tomorrow = dateForOffset(1);

  const inProgressTasks = useMemo(() => items
    .filter((task) => task.status === "in_progress")
    .sort((left, right) => (left.dailyPlanDate ?? "9999-12-31").localeCompare(right.dailyPlanDate ?? "9999-12-31") || (left.dailyPlanHour ?? 99) - (right.dailyPlanHour ?? 99) || left.title.localeCompare(right.title, "uk")), [items]);
  const todayCompletedTasks = useMemo(() => items
    .filter((task) => task.status === "completed" && task.dailyPlanDate === today && task.dailyPlanHour !== null)
    .sort((left, right) => (left.dailyPlanHour ?? 99) - (right.dailyPlanHour ?? 99) || left.title.localeCompare(right.title, "uk")), [items, today]);
  const plannedStartTasks = useMemo(() => items
    .filter((task) => (task.status === "active" || task.status === "in_work") && task.plannedStartDate !== null && task.plannedStartDate <= today)
    .sort((left, right) => (left.plannedStartDate ?? "9999-12-31").localeCompare(right.plannedStartDate ?? "9999-12-31") || left.title.localeCompare(right.title, "uk")), [items, today]);
  const dueTodayTasks = useMemo(() => items
    .filter((task) => (task.status === "active" || task.status === "in_work" || task.status === "in_progress") && task.dueDate === today)
    .sort((left, right) => left.title.localeCompare(right.title, "uk")), [items, today]);
  const dueTomorrowTasks = useMemo(() => items
    .filter((task) => (task.status === "active" || task.status === "in_work" || task.status === "in_progress") && task.dueDate === tomorrow)
    .sort((left, right) => left.title.localeCompare(right.title, "uk")), [items, tomorrow]);

  function startDragging(event: DragEvent<HTMLElement>, task: Task) {
    if (task.status !== "in_progress") return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
    setError("");
    setDraggedTaskId(task.id);
  }

  function stopDragging() {
    setDraggedTaskId(null);
    setDropTarget(null);
  }

  async function saveItems(previousItems: readonly Task[], nextItems: readonly Task[], taskId: string, fields: Record<string, string | number | null>, activity?: Readonly<{ previousStatus: Task["status"]; nextStatus: Task["status"] }>) {
    setOverriddenItems(nextItems);
    setPendingTaskId(taskId);
    setError("");

    if (testMode) {
      writeLocalTestTasks(nextItems);
      setPendingTaskId(null);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.from("tasks").update(fields).eq("id", taskId);
    if (updateError) {
      setOverriddenItems(previousItems);
      setError(planErrorMessage());
      setPendingTaskId(null);
      return;
    }

    if (activity) {
      await supabase.from("task_activity_events").insert({
        task_id: taskId,
        event_type: "status_changed",
        actor_name: memberName,
        previous_status: activity.previousStatus,
        next_status: activity.nextStatus,
      });
    }
    setPendingTaskId(null);
    router.refresh();
  }

  async function scheduleTask(taskId: string, planDate: string, planHour: number) {
    const task = items.find((item) => item.id === taskId);
    if (!task || task.status !== "in_progress" || planHour < 8 || planHour > 20) return;
    const previousItems = items;
    const nextItems = items.map((item) => item.id === taskId ? { ...item, dailyPlanDate: planDate, dailyPlanHour: planHour } : item);
    await saveItems(previousItems, nextItems, taskId, { daily_plan_date: planDate, daily_plan_hour: planHour });
  }

  async function startPlannedTask(taskId: string) {
    const task = items.find((item) => item.id === taskId);
    if (!task || (task.status !== "active" && task.status !== "in_work")) return;
    const changedAt = new Date().toISOString();
    const startedTask: Task = {
      ...task,
      status: "in_progress",
      dailyPlanDate: null,
      dailyPlanHour: null,
      postponedUntil: null,
      completedBy: null,
      completedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      actualStartedAt: task.actualStartedAt ?? changedAt,
    };
    const previousItems = items;
    const nextItems = items.map((item) => item.id === taskId ? startedTask : item);
    await saveItems(previousItems, nextItems, taskId, {
      status: "in_progress",
      postponed_until: null,
      completed_by: null,
      completed_at: null,
      rejected_by: null,
      rejected_at: null,
      actual_started_at: startedTask.actualStartedAt,
      daily_plan_date: null,
      daily_plan_hour: null,
    }, { previousStatus: task.status, nextStatus: "in_progress" });
  }

  async function clearPlan(taskId: string) {
    const task = items.find((item) => item.id === taskId);
    if (!task || task.status !== "in_progress") return;
    const previousItems = items;
    const nextItems = items.map((item) => item.id === taskId ? { ...item, dailyPlanDate: null, dailyPlanHour: null } : item);
    await saveItems(previousItems, nextItems, taskId, { daily_plan_date: null, daily_plan_hour: null });
  }

  async function completeTask(taskId: string) {
    const task = items.find((item) => item.id === taskId);
    if (!task || task.status !== "in_progress" || task.dailyPlanDate === null || task.dailyPlanHour === null) return;
    const changedAt = new Date().toISOString();
    const completedTask: Task = {
      ...task,
      status: "completed",
      dailyPlanDate: today,
      postponedUntil: null,
      completedBy: memberName,
      completedAt: changedAt,
      rejectedBy: null,
      rejectedAt: null,
      actualStartedAt: task.actualStartedAt ?? changedAt,
    };
    const previousItems = items;
    const nextItems = items.map((item) => item.id === taskId ? completedTask : item);
    await saveItems(previousItems, nextItems, taskId, {
      status: "completed",
      postponed_until: null,
      completed_by: memberName,
      completed_at: changedAt,
      rejected_by: null,
      rejected_at: null,
      actual_started_at: completedTask.actualStartedAt,
      daily_plan_date: today,
      daily_plan_hour: completedTask.dailyPlanHour,
    }, { previousStatus: task.status, nextStatus: "completed" });
  }

  function allowDrop(event: DragEvent<HTMLElement>, planDate: string, planHour: number) {
    const task = items.find((item) => item.id === draggedTaskId);
    if (!task || task.status !== "in_progress" || planHour < 8 || planHour > 20) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTarget(`${planDate}-${planHour}`);
  }

  function dropTask(event: DragEvent<HTMLElement>, planDate: string, planHour: number) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
    stopDragging();
    if (taskId) void scheduleTask(taskId, planDate, planHour);
  }

  function cardsFor(planDate: string, planHour: number, completed = false) {
    const source = completed ? todayCompletedTasks : inProgressTasks;
    return source.filter((task) => task.dailyPlanDate === planDate && task.dailyPlanHour === planHour);
  }

  function renderSlot(planDate: string, planHour: number, column: DailyColumn | "completed", rowStart: number) {
    const scheduledTasks = cardsFor(planDate, planHour, column === "completed");
    const targetKey = `${planDate}-${planHour}`;
    const canDrop = column !== "completed";
    const isCurrentTarget = dropTarget === targetKey;
    return (
      <section className={`min-h-[4.6rem] border-l border-t border-stone-200 p-1.5 ${column === "today" ? "bg-amber-50/40" : column === "tomorrow" ? "bg-sky-50/30" : "bg-emerald-50/30"} ${isCurrentTarget ? "ring-2 ring-inset ring-amber-700" : ""}`} key={`${column}-${planHour}`} onDragOver={canDrop ? (event) => allowDrop(event, planDate, planHour) : undefined} onDrop={canDrop ? (event) => dropTask(event, planDate, planHour) : undefined} style={{ gridColumnStart: column === "today" ? 3 : column === "tomorrow" ? 4 : 5, gridRowStart: rowStart }}>
        <div className="space-y-1">
          {scheduledTasks.map((task) => <CompactTaskCard draggable={task.status === "in_progress" && pendingTaskId !== task.id} key={task.id} onClear={task.status === "in_progress" ? () => void clearPlan(task.id) : undefined} onComplete={task.status === "in_progress" ? () => void completeTask(task.id) : undefined} onDragEnd={stopDragging} onDragStart={(event) => startDragging(event, task)} task={task} testMode={testMode} today={today} tomorrow={tomorrow} />)}
          {scheduledTasks.length === 0 && canDrop ? <p className="px-1 py-2 text-[10px] text-stone-400">{isCurrentTarget ? "Відпустіть задачу" : ""}</p> : null}
        </div>
      </section>
    );
  }

  function renderMobileSchedule(column: DailyColumn) {
    const planDate = column === "today" ? today : tomorrow;
    const visible = inProgressTasks.filter((task) => task.dailyPlanDate === planDate && task.dailyPlanHour !== null);
    return <section className={`rounded-2xl border p-3 ${column === "today" ? "border-amber-200 bg-amber-50/60" : "border-sky-200 bg-sky-50/60"}`}>
      <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-stone-950">{column === "today" ? "Сьогодні" : "Завтра"}</h2><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-stone-700">{visible.length}</span></div>
      <div className="mt-3 space-y-2">
        {visible.map((task) => <div className="flex gap-2" key={task.id}><p className="w-10 shrink-0 pt-1 text-xs font-semibold text-stone-500">{hourLabel(task.dailyPlanHour as number)}</p><div className="min-w-0 flex-1"><CompactTaskCard draggable={pendingTaskId !== task.id} onClear={() => void clearPlan(task.id)} onComplete={() => void completeTask(task.id)} onDragEnd={stopDragging} onDragStart={(event) => startDragging(event, task)} task={task} testMode={testMode} today={today} tomorrow={tomorrow} /></div></div>)}
        {visible.length === 0 ? <p className="rounded-xl bg-white/80 px-3 py-3 text-xs leading-5 text-stone-500">Перетягніть сюди задачу зі списку «У процесі» на великому екрані.</p> : null}
      </div>
    </section>;
  }

  return (
    <div className="mt-8 xl:grid xl:grid-cols-[minmax(0,1fr)_18rem] xl:items-start xl:gap-4">
      <div className="min-w-0">
      <section className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-sm font-semibold text-stone-950">Денний план не змінює Канбан</p>
        <p className="mt-1 text-xs leading-5 text-stone-600">Спершу переведіть задачу в загальний стан «У процесі». Потім перетягніть її в годину «Сьогодні» або «Завтра». Задача лишиться у Канбані й на Ганті, а виконання змінить її основний стан для всієї системи.</p>
      </section>
      {error ? <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-800" role="alert">{error}</p> : null}
      <section className="mt-4 grid gap-3 md:grid-cols-2" aria-label="Найближчі строки задач">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3"><div className="flex items-center justify-between gap-2"><div><h2 className="text-sm font-bold text-stone-950">Строк сьогодні</h2><p className="mt-0.5 text-[11px] text-stone-600">{today}</p></div><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-amber-900">{dueTodayTasks.length}</span></div><div className="mt-3 space-y-2">{dueTodayTasks.map((task) => <DeadlineTaskCard key={task.id} task={task} testMode={testMode} />)}{dueTodayTasks.length === 0 ? <p className="rounded-xl bg-white/80 px-3 py-3 text-xs leading-5 text-stone-500">На сьогодні строків немає.</p> : null}</div></div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-3"><div className="flex items-center justify-between gap-2"><div><h2 className="text-sm font-bold text-stone-950">Строк завтра</h2><p className="mt-0.5 text-[11px] text-stone-600">{tomorrow}</p></div><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-sky-900">{dueTomorrowTasks.length}</span></div><div className="mt-3 space-y-2">{dueTomorrowTasks.map((task) => <DeadlineTaskCard key={task.id} task={task} testMode={testMode} />)}{dueTomorrowTasks.length === 0 ? <p className="rounded-xl bg-white/80 px-3 py-3 text-xs leading-5 text-stone-500">На завтра строків немає.</p> : null}</div></div>
      </section>
      {plannedStartTasks.length > 0 ? <section className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/70 p-3" aria-label="Задачі, для яких настав плановий старт"><div className="flex flex-wrap items-baseline justify-between gap-2"><div><h2 className="text-sm font-bold text-stone-950">Настав плановий старт</h2><p className="mt-1 text-xs leading-5 text-stone-600">Ці задачі вже мають початися за планом. Натисніть «Взяти у процес», після чого вони з’являться у першій колонці.</p></div><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-stone-700">{plannedStartTasks.length}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{plannedStartTasks.map((task) => <CompactTaskCard key={task.id} onStart={() => void startPlannedTask(task.id)} task={task} testMode={testMode} today={today} tomorrow={tomorrow} />)}</div></section> : null}

      <div className="mt-6 grid gap-3 lg:hidden">
        <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-3">
          <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-stone-950">У процесі</h2><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-stone-700">{inProgressTasks.length}</span></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{inProgressTasks.map((task) => <div className="rounded-xl border border-stone-200 bg-white p-2" key={task.id}>
            <CompactTaskCard draggable={pendingTaskId !== task.id} onDragEnd={stopDragging} onDragStart={(event) => startDragging(event, task)} task={task} testMode={testMode} today={today} tomorrow={tomorrow} />
            <label className="mt-2 block"><span className="sr-only">Запланувати задачу «{task.title}»</span><select className="min-h-8 w-full rounded-lg border border-stone-300 bg-white px-2 text-xs text-stone-800" defaultValue="" disabled={pendingTaskId === task.id} onChange={(event) => {
              if (!event.target.value) return;
              const [planDate, hourValue] = event.target.value.split("|");
              void scheduleTask(task.id, planDate, Number(hourValue));
              event.target.value = "";
            }}><option value="">Запланувати на…</option>{[today, tomorrow].flatMap((planDate) => hours.map((hour) => <option key={`${planDate}-${hour}`} value={`${planDate}|${hour}`}>{planDate === today ? "Сьогодні" : "Завтра"} · {hourLabel(hour)}</option>))}</select></label>
          </div>)}</div>
          {inProgressTasks.length === 0 ? <p className="mt-3 rounded-xl bg-white/80 px-3 py-3 text-xs leading-5 text-stone-500">У загальному Канбані переведіть потрібну задачу в «У процесі» — після цього її можна запланувати тут.</p> : null}
        </section>
        {renderMobileSchedule("today")}
        {renderMobileSchedule("tomorrow")}
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-stone-950">Виконано сьогодні</h2><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-stone-700">{todayCompletedTasks.length}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{todayCompletedTasks.map((task) => <CompactTaskCard key={task.id} task={task} testMode={testMode} today={today} tomorrow={tomorrow} />)}</div></section>
      </div>

      <section className="mt-6 hidden overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm lg:block" aria-label="Щоденна дошка задач за годинами">
        <div className="grid" style={{ gridTemplateColumns: "3.5rem minmax(11rem, 1.35fr) repeat(3, minmax(10rem, 1fr))", gridTemplateRows: "auto repeat(13, minmax(4.6rem, auto))" }}>
          <div className="border-b border-stone-200 bg-stone-50 px-2 py-3 text-center text-xs font-semibold text-stone-500">Час</div>
          <div className="border-b border-l border-stone-200 bg-sky-50 px-3 py-3"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-stone-950">У процесі</h2><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-stone-700">{inProgressTasks.length}</span></div><p className="mt-1 text-[10px] text-stone-600">Повний список; задача не зникає після планування.</p></div>
          <div className="border-b border-l border-stone-200 bg-amber-50 px-3 py-3"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-stone-950">Сьогодні</h2><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-stone-700">{inProgressTasks.filter((task) => task.dailyPlanDate === today).length}</span></div><p className="mt-1 text-[10px] text-stone-600">{today}</p></div>
          <div className="border-b border-l border-stone-200 bg-sky-50 px-3 py-3"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-stone-950">Завтра</h2><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-stone-700">{inProgressTasks.filter((task) => task.dailyPlanDate === tomorrow).length}</span></div><p className="mt-1 text-[10px] text-stone-600">{tomorrow}</p></div>
          <div className="border-b border-l border-stone-200 bg-emerald-50 px-3 py-3"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-stone-950">Виконано</h2><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-stone-700">{todayCompletedTasks.length}</span></div><p className="mt-1 text-[10px] text-stone-600">Виконані сьогодні</p></div>

          {hours.map((hour, index) => <div className="border-t border-stone-200 bg-stone-50 px-2 pt-2 text-center text-xs font-semibold text-stone-500" key={hour} style={{ gridColumnStart: 1, gridRowStart: index + 2 }}>{hourLabel(hour)}</div>)}
          <section className="row-span-13 min-h-0 border-l border-stone-200 bg-sky-50/20 p-2" style={{ gridColumnStart: 2, gridRowStart: 2 }}>
            <div className="space-y-2">
              {inProgressTasks.map((task) => <CompactTaskCard draggable={pendingTaskId !== task.id} key={task.id} onDragEnd={stopDragging} onDragStart={(event) => startDragging(event, task)} task={task} testMode={testMode} today={today} tomorrow={tomorrow} />)}
              {inProgressTasks.length === 0 ? <p className="rounded-xl bg-white px-3 py-3 text-xs leading-5 text-stone-500">Переведіть задачу в «У процесі» на загальному Канбані, і вона з’явиться тут.</p> : null}
            </div>
          </section>
          {hours.map((hour, index) => renderSlot(today, hour, "today", index + 2))}
          {hours.map((hour, index) => renderSlot(tomorrow, hour, "tomorrow", index + 2))}
          {hours.map((hour, index) => renderSlot(today, hour, "completed", index + 2))}
        </div>
      </section>
      </div>
      <div className="mt-4 xl:mt-0"><TaskStickyNotes /></div>
    </div>
  );
}
