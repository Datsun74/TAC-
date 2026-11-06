"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";

import { readLocalTestTasks } from "@/lib/local-test-tasks";
import { formatTaskDate, taskAreaLabels, taskHorizonLabels, taskStatusLabels } from "@/lib/task-options";
import type { Task, TaskStatus } from "@/types/task";

type TaskReviewProps = Readonly<{
  tasks: readonly Task[];
  testMode: boolean;
}>;

type ReviewSection = Readonly<{
  title: string;
  description: string;
  tone: "urgent" | "today" | "upcoming" | "quiet";
  tasks: readonly Task[];
}>;

const openStatuses: readonly TaskStatus[] = ["active", "in_work", "in_progress", "postponed"];

function subscribeToLocalTasks() {
  return () => {};
}

function dateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateOnly(date);
}

function planningDate(task: Task) {
  return task.status === "postponed" ? task.postponedUntil : task.dueDate;
}

function containerLabel(task: Task) {
  return task.projectName ? `Проєкт: ${task.projectName}` : `Простір: ${task.scopeName}`;
}

function statusClass(status: TaskStatus) {
  if (status === "completed") return "bg-emerald-100 text-emerald-900";
  if (status === "rejected") return "bg-red-50 text-red-800";
  if (status === "postponed") return "bg-amber-100 text-amber-950";
  if (status === "in_progress") return "bg-sky-100 text-sky-900";
  if (status === "in_work") return "bg-violet-100 text-violet-900";
  return "bg-stone-100 text-stone-700";
}

function CompactTaskRow({ task, testMode }: Readonly<{ task: Task; testMode: boolean }>) {
  const date = planningDate(task);
  const title = testMode
    ? <span className="text-sm font-semibold text-stone-950">{task.title}</span>
    : <Link className="text-sm font-semibold text-stone-950 hover:text-amber-800 hover:underline" href={`/tasks/${task.id}`}>{task.title}</Link>;

  return <li className="flex min-w-0 items-start gap-3 px-3 py-2.5 sm:px-4">
    <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ${statusClass(task.status)}`}>{taskStatusLabels[task.status]}</span>
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <div className="min-w-0 truncate">{title}</div>
        <p className="shrink-0 text-xs text-stone-600">{date ? formatTaskDate(date) : "Без строку"}</p>
      </div>
      <p className="mt-0.5 truncate text-xs leading-4 text-stone-500">{containerLabel(task)} · {taskAreaLabels[task.area]} · {taskHorizonLabels[task.horizon]}</p>
    </div>
  </li>;
}

function ReviewCard({ section, testMode }: Readonly<{ section: ReviewSection; testMode: boolean }>) {
  const borderClass = section.tone === "urgent"
    ? "border-red-200"
    : section.tone === "today"
      ? "border-amber-200"
      : section.tone === "upcoming"
        ? "border-sky-200"
        : "border-stone-200";
  const badgeClass = section.tone === "urgent"
    ? "bg-red-50 text-red-800"
    : section.tone === "today"
      ? "bg-amber-100 text-amber-950"
      : section.tone === "upcoming"
        ? "bg-sky-100 text-sky-900"
        : "bg-stone-100 text-stone-700";

  return <section className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${borderClass}`}>
    <div className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
      <div><h2 className="text-base font-semibold text-stone-950">{section.title}</h2><p className="mt-0.5 text-xs leading-5 text-stone-600">{section.description}</p></div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClass}`}>{section.tasks.length}</span>
    </div>
    {section.tasks.length === 0 ? <p className="border-t border-stone-100 px-4 py-3 text-sm text-stone-500 sm:px-5">Немає задач.</p> : <ul className="divide-y divide-stone-100 border-t border-stone-100">{section.tasks.map((task) => <CompactTaskRow key={task.id} task={task} testMode={testMode} />)}</ul>}
  </section>;
}

export function TaskReview({ tasks, testMode }: TaskReviewProps) {
  const localTasks = useSyncExternalStore(subscribeToLocalTasks, readLocalTestTasks, () => [] as Task[]);
  const items = testMode ? localTasks : tasks;
  const today = dateOnly(new Date());
  const weekEnd = addDays(today, 7);

  const openTasks = useMemo(() => items.filter((task) => openStatuses.includes(task.status)), [items]);
  const sections = useMemo<readonly ReviewSection[]>(() => {
    const overdue = openTasks.filter((task) => {
      const date = planningDate(task);
      return date !== null && date < today;
    });
    const dueToday = openTasks.filter((task) => planningDate(task) === today);
    const upcoming = openTasks.filter((task) => {
      const date = planningDate(task);
      return date !== null && date > today && date <= weekEnd;
    });
    const noDate = openTasks.filter((task) => planningDate(task) === null);
    const order = (left: Task, right: Task) => (planningDate(left) ?? "9999-12-31").localeCompare(planningDate(right) ?? "9999-12-31") || left.title.localeCompare(right.title, "uk");
    return [
      { title: "Потребують уваги", description: "Строк уже минув або відкладення завершилося.", tone: "urgent", tasks: overdue.sort(order) },
      { title: "На сьогодні", description: "Задачі з планом на сьогодні.", tone: "today", tasks: dueToday.sort(order) },
      { title: "Наступні 7 днів", description: "Підготуйтеся завчасно, щоб не втратити строки.", tone: "upcoming", tasks: upcoming.sort(order) },
      { title: "Без строку", description: "Задачі без визначеної дати — розставте пріоритети.", tone: "quiet", tasks: noDate.sort((left, right) => left.title.localeCompare(right.title, "uk")) },
    ];
  }, [openTasks, today, weekEnd]);

  const statusCounts = useMemo(() => ({
    active: openTasks.filter((task) => task.status === "active").length,
    inWork: openTasks.filter((task) => task.status === "in_work").length,
    inProgress: openTasks.filter((task) => task.status === "in_progress").length,
    postponed: openTasks.filter((task) => task.status === "postponed").length,
  }), [openTasks]);

  return <>
    <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Коротка картина по задачах">
      <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Активні</p><p className="mt-1 text-2xl font-semibold text-stone-950">{statusCounts.active}</p></div>
      <div className="rounded-2xl border border-violet-200 bg-violet-50/50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Взято в роботу</p><p className="mt-1 text-2xl font-semibold text-violet-950">{statusCounts.inWork}</p></div>
      <div className="rounded-2xl border border-sky-200 bg-sky-50/50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-sky-800">У процесі</p><p className="mt-1 text-2xl font-semibold text-sky-950">{statusCounts.inProgress}</p></div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Відкладені</p><p className="mt-1 text-2xl font-semibold text-amber-950">{statusCounts.postponed}</p></div>
    </section>

    <div className="mt-5 grid gap-4 xl:grid-cols-2">
      {sections.map((section) => <ReviewCard key={section.title} section={section} testMode={testMode} />)}
    </div>
    <p className="mt-5 text-sm leading-6 text-stone-600">Потрібні деталі або зміна стану? Відкрийте задачу зі списку або перейдіть до <Link className="font-semibold text-amber-800 hover:underline" href="/tasks/list">усіх задач</Link>.</p>
  </>;
}
