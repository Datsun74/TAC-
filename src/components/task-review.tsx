"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { readLocalTestTasks } from "@/lib/local-test-tasks";
import { formatTaskDate, taskAreaLabels, taskAreaOptions, taskHorizonLabels, taskHorizonOptions, taskStatusLabels } from "@/lib/task-options";
import type { Task, TaskArea, TaskHorizon, TaskStatus } from "@/types/task";

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

type ResponsibilitySummary = Readonly<{
  name: string;
  total: number;
  inProgress: number;
  overdue: number;
}>;

const openStatuses: readonly TaskStatus[] = ["active", "in_work", "in_progress", "postponed"];

function subscribeToLocalTasks() {
  return () => {};
}

function toggleChoice<T>(current: readonly T[], value: T) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
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

function responsibleName(task: Task) {
  return task.assigneeName ?? task.createdByName;
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
  const [selectedResponsible, setSelectedResponsible] = useState<string | null>(null);
  const [selectedHorizons, setSelectedHorizons] = useState<readonly TaskHorizon[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<readonly TaskArea[]>([]);
  const today = dateOnly(new Date());
  const weekEnd = addDays(today, 7);

  const openTasks = useMemo(() => items.filter((task) => openStatuses.includes(task.status)), [items]);
  const filteredTasks = useMemo(
    () => openTasks.filter((task) => (selectedHorizons.length === 0 || selectedHorizons.includes(task.horizon)) && (selectedAreas.length === 0 || selectedAreas.includes(task.area))),
    [openTasks, selectedAreas, selectedHorizons],
  );
  const selectedResponsibleIsAvailable = selectedResponsible === null || filteredTasks.some((task) => responsibleName(task) === selectedResponsible);

  useEffect(() => {
    if (!selectedResponsibleIsAvailable) setSelectedResponsible(null);
  }, [selectedResponsibleIsAvailable]);

  const reviewTasks = useMemo(
    () => selectedResponsible === null ? filteredTasks : filteredTasks.filter((task) => responsibleName(task) === selectedResponsible),
    [filteredTasks, selectedResponsible],
  );
  const sections = useMemo<readonly ReviewSection[]>(() => {
    const overdue = reviewTasks.filter((task) => {
      const date = planningDate(task);
      return date !== null && date < today;
    });
    const dueToday = reviewTasks.filter((task) => planningDate(task) === today);
    const upcoming = reviewTasks.filter((task) => {
      const date = planningDate(task);
      return date !== null && date > today && date <= weekEnd;
    });
    const noDate = reviewTasks.filter((task) => planningDate(task) === null);
    const order = (left: Task, right: Task) => (planningDate(left) ?? "9999-12-31").localeCompare(planningDate(right) ?? "9999-12-31") || left.title.localeCompare(right.title, "uk");
    return [
      { title: "Потребують уваги", description: "Строк уже минув або відкладення завершилося.", tone: "urgent", tasks: overdue.sort(order) },
      { title: "На сьогодні", description: "Задачі з планом на сьогодні.", tone: "today", tasks: dueToday.sort(order) },
      { title: "Наступні 7 днів", description: "Підготуйтеся завчасно, щоб не втратити строки.", tone: "upcoming", tasks: upcoming.sort(order) },
      { title: "Без строку", description: "Задачі без визначеної дати — розставте пріоритети.", tone: "quiet", tasks: noDate.sort((left, right) => left.title.localeCompare(right.title, "uk")) },
    ];
  }, [reviewTasks, today, weekEnd]);

  const statusCounts = useMemo(() => ({
    active: reviewTasks.filter((task) => task.status === "active").length,
    inWork: reviewTasks.filter((task) => task.status === "in_work").length,
    inProgress: reviewTasks.filter((task) => task.status === "in_progress").length,
    postponed: reviewTasks.filter((task) => task.status === "postponed").length,
  }), [reviewTasks]);

  const responsibilitySummary = useMemo<readonly ResponsibilitySummary[]>(() => {
    const people = new Map<string, ResponsibilitySummary>();
    filteredTasks.forEach((task) => {
      const name = responsibleName(task);
      const previous = people.get(name) ?? { name, total: 0, inProgress: 0, overdue: 0 };
      const planning = planningDate(task);
      people.set(name, {
        name,
        total: previous.total + 1,
        inProgress: previous.inProgress + (task.status === "in_work" || task.status === "in_progress" ? 1 : 0),
        overdue: previous.overdue + (planning !== null && planning < today ? 1 : 0),
      });
    });
    return [...people.values()].sort((left, right) => right.overdue - left.overdue || right.total - left.total || left.name.localeCompare(right.name, "uk"));
  }, [filteredTasks, today]);

  const filterCount = selectedHorizons.length + selectedAreas.length;

  return <>
    <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Швидкий відбір задач">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-stone-950">Швидкий відбір</h2><p className="mt-0.5 text-xs leading-5 text-stone-600">Поєднуйте рівні планування та напрями. Без вибору відображаються всі відкриті задачі.</p></div>{filterCount > 0 ? <button className="min-h-8 rounded-full px-3 text-xs font-semibold text-stone-600 hover:bg-stone-100" onClick={() => { setSelectedHorizons([]); setSelectedAreas([]); }} type="button">Очистити ({filterCount})</button> : null}</div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <fieldset><legend className="text-xs font-semibold uppercase tracking-wide text-stone-600">Рівень планування</legend><div className="mt-2 flex flex-wrap gap-2">{taskHorizonOptions.map((option) => <button aria-pressed={selectedHorizons.includes(option.value)} className={selectedHorizons.includes(option.value) ? "min-h-8 rounded-full bg-amber-800 px-3 text-xs font-semibold text-white" : "min-h-8 rounded-full border border-stone-300 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50"} key={option.value} onClick={() => setSelectedHorizons((current) => toggleChoice(current, option.value))} type="button">{option.label}</button>)}</div></fieldset>
        <fieldset><legend className="text-xs font-semibold uppercase tracking-wide text-stone-600">Напрям</legend><div className="mt-2 flex flex-wrap gap-2">{taskAreaOptions.map((option) => <button aria-pressed={selectedAreas.includes(option.value)} className={selectedAreas.includes(option.value) ? "min-h-8 rounded-full bg-amber-800 px-3 text-xs font-semibold text-white" : "min-h-8 rounded-full border border-stone-300 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50"} key={option.value} onClick={() => setSelectedAreas((current) => toggleChoice(current, option.value))} type="button">{option.label}</button>)}</div></fieldset>
      </div>
    </section>

    <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Коротка картина по задачах">
      <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Активні</p><p className="mt-1 text-2xl font-semibold text-stone-950">{statusCounts.active}</p></div>
      <div className="rounded-2xl border border-violet-200 bg-violet-50/50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Взято в роботу</p><p className="mt-1 text-2xl font-semibold text-violet-950">{statusCounts.inWork}</p></div>
      <div className="rounded-2xl border border-sky-200 bg-sky-50/50 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-sky-800">У процесі</p><p className="mt-1 text-2xl font-semibold text-sky-950">{statusCounts.inProgress}</p></div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Відкладені</p><p className="mt-1 text-2xl font-semibold text-amber-950">{statusCounts.postponed}</p></div>
    </section>

    <section className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm" aria-label="Розподіл задач за відповідальними">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 sm:px-5"><div><h2 className="text-base font-semibold text-stone-950">За відповідальними</h2><p className="mt-0.5 text-xs leading-5 text-stone-600">Оберіть людину, щоб одразу відфільтрувати всі блоки огляду.</p></div><div className="flex items-center gap-2"><span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700">{responsibilitySummary.length}</span><button aria-pressed={selectedResponsible === null} className={selectedResponsible === null ? "min-h-8 rounded-full bg-amber-800 px-3 text-xs font-semibold text-white" : "min-h-8 rounded-full border border-stone-300 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-50"} onClick={() => setSelectedResponsible(null)} type="button">Усі</button></div></div>
      {responsibilitySummary.length === 0 ? <p className="border-t border-stone-100 px-4 py-3 text-sm text-stone-500 sm:px-5">Немає відкритих задач.</p> : <ul className="grid divide-y divide-stone-100 border-t border-stone-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">{responsibilitySummary.map((person) => <li key={person.name}><button aria-pressed={selectedResponsible === person.name} className={selectedResponsible === person.name ? "flex w-full flex-col gap-2 bg-amber-50 px-4 py-3 text-left sm:px-5" : "flex w-full flex-col gap-2 px-4 py-3 text-left hover:bg-stone-50 sm:px-5"} onClick={() => setSelectedResponsible(person.name)} type="button"><p className="min-w-0 truncate text-sm font-semibold text-stone-950">{person.name}</p><div className="flex flex-wrap gap-1.5 text-[11px] font-semibold"><span className="rounded-full bg-stone-100 px-2 py-1 text-stone-700">Відкриті: {person.total}</span>{person.inProgress > 0 ? <span className="rounded-full bg-sky-100 px-2 py-1 text-sky-900">У процесі: {person.inProgress}</span> : null}{person.overdue > 0 ? <span className="rounded-full bg-red-50 px-2 py-1 text-red-800">Прострочено: {person.overdue}</span> : null}</div></button></li>)}</ul>}
    </section>

    <div className="mt-5 grid gap-4 xl:grid-cols-2">
      {sections.map((section) => <ReviewCard key={section.title} section={section} testMode={testMode} />)}
    </div>
    <p className="mt-5 text-sm leading-6 text-stone-600">Потрібні деталі або зміна стану? Відкрийте задачу зі списку або перейдіть до <Link className="font-semibold text-amber-800 hover:underline" href="/tasks/list">усіх задач</Link>.</p>
  </>;
}
