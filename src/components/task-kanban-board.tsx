"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";

import { readLocalTestTasks } from "@/lib/local-test-tasks";
import { formatTaskDate, taskAreaLabels, taskAreaOptions, taskHorizonLabels, taskHorizonOptions, taskStatusLabels } from "@/lib/task-options";
import type { Task, TaskArea, TaskHorizon, TaskStatus } from "@/types/task";

type TaskKanbanBoardProps = Readonly<{
  tasks: readonly Task[];
  testMode: boolean;
}>;

const columns: readonly TaskStatus[] = ["active", "in_work", "in_progress", "postponed", "completed", "rejected"];
const horizonOrder: Record<TaskHorizon, number> = { tactical: 0, operational: 1, strategic: 2 };
const areaOrder: Record<TaskArea, number> = { work: 0, family: 1, personal: 2 };

function subscribeToLocalTasks() {
  return () => {};
}

function toggleChoice<T extends string>(current: readonly T[], choice: T) {
  return current.includes(choice) ? current.filter((item) => item !== choice) : [...current, choice];
}

function peopleForTask(task: Task) {
  return Array.from(new Set([task.createdByName, ...task.participants.map((participant) => participant.name)]));
}

function deadlineLabel(task: Task) {
  if (task.status === "postponed" && task.postponedUntil) return `До ${formatTaskDate(task.postponedUntil)}`;
  return task.dueDate ? formatTaskDate(task.dueDate) : "Без дати";
}

function columnStyle(status: TaskStatus) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50/60";
  if (status === "rejected") return "border-red-200 bg-red-50/60";
  if (status === "postponed") return "border-amber-200 bg-amber-50/70";
  if (status === "in_progress") return "border-sky-200 bg-sky-50/70";
  if (status === "in_work") return "border-violet-200 bg-violet-50/70";
  return "border-stone-200 bg-stone-50";
}

function taskCard(task: Task, testMode: boolean) {
  const title = testMode ? task.title : <Link className="font-semibold text-stone-950 hover:text-amber-800 hover:underline" href={`/tasks/${task.id}`}>{task.title}</Link>;

  return (
    <article className="rounded-2xl border border-white bg-white p-3.5 shadow-sm">
      <h3 className="text-sm leading-5">{title}</h3>
      {task.goal ? <p className="mt-1 text-xs leading-5 text-stone-600">{task.goal}</p> : null}
      <p className="mt-3 text-xs font-medium text-stone-800">{taskHorizonLabels[task.horizon]} · {taskAreaLabels[task.area]}</p>
      <p className="mt-1 text-xs text-stone-600">Строк: {deadlineLabel(task)}</p>
      <p className="mt-2 line-clamp-2 text-xs leading-5 text-stone-600">{peopleForTask(task).join(", ")}</p>
    </article>
  );
}

export function TaskKanbanBoard({ tasks, testMode }: TaskKanbanBoardProps) {
  const localTasks = useSyncExternalStore(subscribeToLocalTasks, () => (testMode ? readLocalTestTasks() : tasks), () => tasks);
  const [selectedAreas, setSelectedAreas] = useState<readonly TaskArea[]>([]);
  const [selectedHorizons, setSelectedHorizons] = useState<readonly TaskHorizon[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<readonly string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersApplied = selectedAreas.length > 0 || selectedHorizons.length > 0 || selectedPeople.length > 0;

  const people = useMemo(() => Array.from(new Set(localTasks.flatMap(peopleForTask))).sort((left, right) => left.localeCompare(right, "uk")), [localTasks]);
  const visibleTasks = useMemo(() => localTasks
    .filter((task) => selectedAreas.length === 0 || selectedAreas.includes(task.area))
    .filter((task) => selectedHorizons.length === 0 || selectedHorizons.includes(task.horizon))
    .filter((task) => selectedPeople.length === 0 || peopleForTask(task).some((person) => selectedPeople.includes(person)))
    .sort((left, right) => {
      const horizonDifference = horizonOrder[left.horizon] - horizonOrder[right.horizon];
      if (horizonDifference !== 0) return horizonDifference;
      const areaDifference = areaOrder[left.area] - areaOrder[right.area];
      if (areaDifference !== 0) return areaDifference;
      return (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31") || left.createdAt.localeCompare(right.createdAt);
    }), [localTasks, selectedAreas, selectedHorizons, selectedPeople]);

  function clearFilters() {
    setSelectedAreas([]);
    setSelectedHorizons([]);
    setSelectedPeople([]);
  }

  return (
    <>
      <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm" aria-label="Фільтри Канбан-дошки">
        <div className="flex flex-wrap items-center gap-2">
          <button aria-expanded={filtersOpen} className="min-h-10 rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50" onClick={() => setFiltersOpen((open) => !open)} type="button">Фільтри{filtersApplied ? ` (${selectedAreas.length + selectedHorizons.length + selectedPeople.length})` : ""}</button>
          {filtersApplied ? <button className="min-h-10 rounded-full px-3 text-sm font-semibold text-stone-600 hover:bg-stone-100" onClick={clearFilters} type="button">Очистити</button> : null}
          <p className="basis-full text-xs leading-5 text-stone-500 sm:ml-2 sm:basis-auto">Порядок карток: тактичні → оперативні → стратегічні; робота → сім’я → особисте.</p>
        </div>

        {filtersOpen ? (
          <div className="mt-4 grid gap-5 border-t border-stone-100 pt-4 lg:grid-cols-3">
            <fieldset>
              <legend className="text-sm font-semibold text-stone-950">Рівень планування</legend>
              <p className="mt-1 text-xs leading-5 text-stone-500">Можна обрати кілька. Без позначок — усі.</p>
              <div className="mt-3 space-y-2">
                {taskHorizonOptions.map((option) => <label className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-stone-800 hover:bg-stone-50" key={option.value}><input checked={selectedHorizons.includes(option.value)} className="size-4 accent-amber-800" onChange={() => setSelectedHorizons((current) => toggleChoice(current, option.value))} type="checkbox" /><span>{option.label}</span></label>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold text-stone-950">Напрям</legend>
              <p className="mt-1 text-xs leading-5 text-stone-500">Наприклад: тільки сімейні задачі.</p>
              <div className="mt-3 space-y-2">
                {taskAreaOptions.map((option) => <label className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-stone-800 hover:bg-stone-50" key={option.value}><input checked={selectedAreas.includes(option.value)} className="size-4 accent-amber-800" onChange={() => setSelectedAreas((current) => toggleChoice(current, option.value))} type="checkbox" /><span>{option.label}</span></label>)}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold text-stone-950">Люди</legend>
              <p className="mt-1 text-xs leading-5 text-stone-500">Покажемо задачі, де є хоча б одна обрана людина.</p>
              <div className="mt-3 space-y-2">
                {people.length > 0 ? people.map((person) => <label className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-stone-800 hover:bg-stone-50" key={person}><input checked={selectedPeople.includes(person)} className="size-4 accent-amber-800" onChange={() => setSelectedPeople((current) => toggleChoice(current, person))} type="checkbox" /><span>{person}</span></label>) : <p className="rounded-xl bg-stone-50 px-3 py-3 text-sm text-stone-600">Люди з’являться після створення задач.</p>}
              </div>
            </fieldset>
          </div>
        ) : null}
      </section>

      {visibleTasks.length === 0 ? (
        <section className="mt-6 max-w-2xl rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center">
          <h2 className="text-lg font-semibold text-stone-900">{filtersApplied ? "За обраними фільтрами задач немає." : "Задач поки немає."}</h2>
          {filtersApplied ? <button className="mt-5 min-h-11 rounded-full bg-amber-800 px-5 text-sm font-semibold text-white hover:bg-amber-900" onClick={clearFilters} type="button">Показати всі задачі</button> : <Link className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-amber-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-900" href="/tasks/add">Створити задачу</Link>}
        </section>
      ) : (
        <>
          <div className="mt-6 space-y-5 lg:hidden">
            {columns.map((status) => {
              const columnTasks = visibleTasks.filter((task) => task.status === status);
              return <section className={"rounded-2xl border p-3 " + columnStyle(status)} key={status}><div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-stone-950">{taskStatusLabels[status]}</h2><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-stone-700">{columnTasks.length}</span></div><div className="mt-3 space-y-3">{columnTasks.length > 0 ? columnTasks.map((task) => <div key={task.id}>{taskCard(task, testMode)}</div>) : <p className="rounded-xl bg-white/70 px-3 py-4 text-sm text-stone-500">Немає задач.</p>}</div></section>;
            })}
          </div>

          <div className="mt-6 hidden overflow-x-auto pb-4 lg:block">
            <div className="flex min-w-max gap-4">
              {columns.map((status) => {
                const columnTasks = visibleTasks.filter((task) => task.status === status);
                return <section className={"w-72 shrink-0 rounded-2xl border p-3 " + columnStyle(status)} key={status}><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold text-stone-950">{taskStatusLabels[status]}</h2><span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-stone-700">{columnTasks.length}</span></div><div className="mt-3 space-y-3">{columnTasks.length > 0 ? columnTasks.map((task) => <div key={task.id}>{taskCard(task, testMode)}</div>) : <p className="rounded-xl bg-white/70 px-3 py-4 text-sm text-stone-500">Немає задач.</p>}</div></section>;
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
