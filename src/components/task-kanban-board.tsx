"use client";

import Link from "next/link";
import { type DragEvent, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { readLocalTestTasks, writeLocalTestTasks } from "@/lib/local-test-tasks";
import { taskAreaOptions, taskHorizonLabels, taskHorizonOptions, taskStatusLabels, taskStatusOptions } from "@/lib/task-options";
import { createClient } from "@/lib/supabase/client";
import type { Task, TaskArea, TaskHorizon, TaskStatus } from "@/types/task";

type TaskKanbanBoardProps = Readonly<{
  tasks: readonly Task[];
  memberName: string;
  testMode: boolean;
}>;

type TaskCardProps = Readonly<{
  task: Task;
  testMode: boolean;
  isMoving: boolean;
  onDragStart: (event: DragEvent<HTMLElement>, task: Task) => void;
  onDragEnd: () => void;
}>;

const columns: readonly TaskStatus[] = ["active", "in_work", "in_progress", "postponed", "completed", "rejected"];
const orderedHorizons: readonly TaskHorizon[] = ["tactical", "operational", "strategic"];
const horizonOrder: Record<TaskHorizon, number> = { tactical: 0, operational: 1, strategic: 2 };
const areaOrder: Record<TaskArea, number> = { work: 0, family: 1, personal: 2 };

function subscribeToLocalTasks() {
  return () => {};
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

function peopleForTask(task: Task) {
  return Array.from(new Set([task.createdByName, ...task.participants.map((participant) => participant.name)]));
}

function projectOptionsForTasks(tasks: readonly Task[]) {
  return Array.from(new Map(tasks.filter((task) => task.projectId && task.projectName).map((task) => [task.projectId as string, task.projectName as string])).entries())
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name, "uk"));
}

function taskContainer(task: Task) {
  if (task.projectId && task.projectName) {
    return { id: `project-${task.projectId}`, label: `Проєкт · ${task.projectName}`, sortOrder: 0 };
  }

  return { id: `space-${task.scopeKind}-${task.scopeId}`, label: `Простір · ${task.scopeName}`, sortOrder: 1 };
}

function taskGroupsForHorizon(tasks: readonly Task[]) {
  const groups = new Map<string, { id: string; label: string; sortOrder: number; tasks: Task[] }>();
  tasks.forEach((task) => {
    const container = taskContainer(task);
    const group = groups.get(container.id) ?? { id: container.id, label: container.label, sortOrder: container.sortOrder, tasks: [] };
    group.tasks.push(task);
    groups.set(container.id, group);
  });
  return Array.from(groups.values()).sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label, "uk"));
}

function taskMatchesSearch(task: Task, search: string) {
  const query = search.trim().toLocaleLowerCase("uk-UA");
  if (!query) return true;
  return [task.title, task.goal, task.scopeName, task.projectName, task.createdByName, ...task.participants.map((participant) => participant.name)]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLocaleLowerCase("uk-UA").includes(query));
}

function columnStyle(status: TaskStatus) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50/60";
  if (status === "rejected") return "border-red-200 bg-red-50/60";
  if (status === "postponed") return "border-amber-200 bg-amber-50/70";
  if (status === "in_progress") return "border-sky-200 bg-sky-50/70";
  if (status === "in_work") return "border-violet-200 bg-violet-50/70";
  return "border-stone-200 bg-stone-50";
}

function taskWithStatus(task: Task, status: TaskStatus, memberName: string): Task {
  const changedAt = new Date().toISOString();

  if (status === "completed") {
    return { ...task, status, postponedUntil: null, completedBy: memberName, completedAt: changedAt, rejectedBy: null, rejectedAt: null };
  }

  if (status === "rejected") {
    return { ...task, status, postponedUntil: null, completedBy: null, completedAt: null, rejectedBy: memberName, rejectedAt: changedAt };
  }

  if (status === "postponed") {
    return { ...task, status, postponedUntil: task.postponedUntil ?? oneMonthFromNow(), completedBy: null, completedAt: null, rejectedBy: null, rejectedAt: null };
  }

  return { ...task, status, postponedUntil: null, completedBy: null, completedAt: null, rejectedBy: null, rejectedAt: null };
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

function TaskCard({ task, testMode, isMoving, onDragStart, onDragEnd }: TaskCardProps) {
  const title = testMode
    ? task.title
    : <Link className="font-semibold text-stone-950 hover:text-amber-800 hover:underline" draggable={false} href={`/tasks/${task.id}`}>{task.title}</Link>;

  return (
    <article aria-label={`Перетягнути задачу «${task.title}»`} className={`cursor-grab rounded-xl border border-white bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${isMoving ? "opacity-45" : ""}`} draggable={!isMoving} onDragEnd={onDragEnd} onDragStart={(event) => onDragStart(event, task)}>
      <h3 className="break-words text-sm leading-5">{title}</h3>
    </article>
  );
}

export function TaskKanbanBoard({ tasks, memberName, testMode }: TaskKanbanBoardProps) {
  const router = useRouter();
  const localTasks = useSyncExternalStore(subscribeToLocalTasks, () => (testMode ? readLocalTestTasks() : tasks), () => tasks);
  const [overriddenItems, setOverriddenItems] = useState<readonly Task[] | null>(null);
  const [selectedAreas, setSelectedAreas] = useState<readonly TaskArea[]>([]);
  const [selectedHorizons, setSelectedHorizons] = useState<readonly TaskHorizon[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<readonly string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<readonly string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<readonly TaskStatus[]>([]);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetStatus, setDropTargetStatus] = useState<TaskStatus | null>(null);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const items = overriddenItems ?? localTasks;
  const filtersApplied = Boolean(search.trim()) || selectedAreas.length > 0 || selectedHorizons.length > 0 || selectedPeople.length > 0 || selectedProjectIds.length > 0 || selectedStatuses.length > 0;

  const people = useMemo(() => Array.from(new Set(items.flatMap(peopleForTask))).sort((left, right) => left.localeCompare(right, "uk")), [items]);
  const projects = useMemo(() => projectOptionsForTasks(items), [items]);
  const visibleTasks = useMemo(() => items
    .filter((task) => taskMatchesSearch(task, search))
    .filter((task) => selectedAreas.length === 0 || selectedAreas.includes(task.area))
    .filter((task) => selectedHorizons.length === 0 || selectedHorizons.includes(task.horizon))
    .filter((task) => selectedPeople.length === 0 || peopleForTask(task).some((person) => selectedPeople.includes(person)))
    .filter((task) => selectedProjectIds.length === 0 || (task.projectId !== null && selectedProjectIds.includes(task.projectId)))
    .filter((task) => selectedStatuses.length === 0 || selectedStatuses.includes(task.status))
    .sort((left, right) => {
      const horizonDifference = horizonOrder[left.horizon] - horizonOrder[right.horizon];
      if (horizonDifference !== 0) return horizonDifference;
      const areaDifference = areaOrder[left.area] - areaOrder[right.area];
      if (areaDifference !== 0) return areaDifference;
      return (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31") || left.createdAt.localeCompare(right.createdAt);
    }), [items, search, selectedAreas, selectedHorizons, selectedPeople, selectedProjectIds, selectedStatuses]);

  function clearFilters() {
    setSearch("");
    setSelectedAreas([]);
    setSelectedHorizons([]);
    setSelectedPeople([]);
    setSelectedProjectIds([]);
    setSelectedStatuses([]);
  }

  function startDragging(event: DragEvent<HTMLElement>, task: Task) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
    setError("");
    setDraggedTaskId(task.id);
  }

  async function moveTask(taskId: string, status: TaskStatus) {
    const task = items.find((item) => item.id === taskId);
    if (!task || task.status === status) return;

    const previousItems = items;
    const updatedTask = taskWithStatus(task, status, memberName);
    const updatedItems = items.map((item) => (item.id === taskId ? updatedTask : item));
    setError("");
    setMovingTaskId(taskId);
    setOverriddenItems(updatedItems);

    if (testMode) {
      writeLocalTestTasks(updatedItems);
      setMovingTaskId(null);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.from("tasks").update(taskUpdate(updatedTask)).eq("id", taskId);
    if (updateError) {
      setOverriddenItems(previousItems);
      setError("Не вдалося змінити стан задачі. Спробуйте перемістити її ще раз.");
    } else {
      await supabase.from("task_activity_events").insert({
        task_id: task.id,
        event_type: "status_changed",
        actor_name: memberName,
        previous_status: task.status,
        next_status: updatedTask.status,
      });
      router.refresh();
    }
    setMovingTaskId(null);
  }

  function allowDrop(event: DragEvent<HTMLElement>, status: TaskStatus) {
    if (!draggedTaskId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetStatus(status);
  }

  function dropTask(event: DragEvent<HTMLElement>, status: TaskStatus) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
    setDraggedTaskId(null);
    setDropTargetStatus(null);
    if (taskId) void moveTask(taskId, status);
  }

  function renderColumn(status: TaskStatus) {
    const columnTasks = visibleTasks.filter((task) => task.status === status);
    const isDropTarget = dropTargetStatus === status && draggedTaskId !== null;

    return (
      <section className={`${columnStyle(status)} ${isDropTarget ? "ring-2 ring-amber-700 ring-offset-2" : ""} min-w-0 rounded-2xl border p-3 transition-shadow`} key={status} onDragOver={(event) => allowDrop(event, status)} onDrop={(event) => dropTask(event, status)}>
        <div className="flex items-center justify-between gap-2"><h2 className="min-w-0 text-sm font-semibold leading-5 text-stone-950">{taskStatusLabels[status]}</h2><span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-bold text-stone-700">{columnTasks.length}</span></div>
        {columnTasks.length > 0 ? <div className="mt-3 space-y-4">{orderedHorizons.map((horizon) => {
          const groups = taskGroupsForHorizon(columnTasks.filter((task) => task.horizon === horizon));
          if (groups.length === 0) return null;
          return <section className="space-y-2" key={horizon}>
            <h3 className="border-b border-stone-200 pb-1 text-[11px] font-bold tracking-wide text-stone-600 uppercase">{taskHorizonLabels[horizon]}</h3>
            {groups.map((group) => <div className="space-y-2" key={group.id}>
              <p className="truncate px-1 text-[11px] font-semibold leading-4 text-amber-900" title={group.label}>{group.label}</p>
              <div className="space-y-2">{group.tasks.map((task) => <TaskCard isMoving={movingTaskId === task.id} key={task.id} onDragEnd={() => { setDraggedTaskId(null); setDropTargetStatus(null); }} onDragStart={startDragging} task={task} testMode={testMode} />)}</div>
            </div>)}
          </section>;
        })}</div> : <p className="mt-3 rounded-xl bg-white/70 px-3 py-4 text-sm text-stone-500">Перетягніть сюди задачу.</p>}
      </section>
    );
  }

  return (
    <>
      <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm" aria-label="Фільтри Канбан-дошки">
        <div className="flex flex-wrap items-center gap-2">
          <label className="min-w-[13rem] flex-1 sm:max-w-sm"><span className="sr-only">Пошук задач на канбані</span><input className="min-h-10 w-full rounded-full border border-stone-300 bg-white px-4 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-amber-700 focus:ring-2 focus:ring-amber-100" onChange={(event) => setSearch(event.target.value)} placeholder="Пошук задач, проєктів, людей…" type="search" value={search} /></label>
          <button aria-expanded={filtersOpen} className="min-h-10 rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50" onClick={() => setFiltersOpen((open) => !open)} type="button">Фільтри{filtersApplied ? ` (${selectedAreas.length + selectedHorizons.length + selectedPeople.length + selectedProjectIds.length + selectedStatuses.length + (search.trim() ? 1 : 0)})` : ""}</button>
          {filtersApplied ? <button className="min-h-10 rounded-full px-3 text-sm font-semibold text-stone-600 hover:bg-stone-100" onClick={clearFilters} type="button">Очистити</button> : null}
          <p className="basis-full text-xs leading-5 text-stone-500 sm:ml-2 sm:basis-auto">Перетягніть картку до іншої колонки, щоб змінити її стан. Порядок: тактичні → оперативні → стратегічні; робота → сім’я → особисте. Назва проєкту показана під задачею.</p>
        </div>

        {filtersOpen ? (
          <div className="mt-4 grid gap-5 border-t border-stone-100 pt-4 lg:grid-cols-4 xl:grid-cols-5">
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
            <fieldset>
              <legend className="text-sm font-semibold text-stone-950">Проєкти</legend>
              <p className="mt-1 text-xs leading-5 text-stone-500">Позначте один або кілька проєктів. Без вибору — задачі з усіх просторів і проєктів.</p>
              <div className="mt-3 space-y-2">
                {projects.length > 0 ? projects.map((project) => <label className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-stone-800 hover:bg-stone-50" key={project.id}><input checked={selectedProjectIds.includes(project.id)} className="size-4 accent-amber-800" onChange={() => setSelectedProjectIds((current) => toggleChoice(current, project.id))} type="checkbox" /><span>{project.name}</span></label>) : <p className="rounded-xl bg-stone-50 px-3 py-3 text-sm text-stone-600">Проєкти з’являться після створення задачі в проєкті.</p>}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold text-stone-950">Стан</legend>
              <p className="mt-1 text-xs leading-5 text-stone-500">Можна лишити на дошці лише потрібні колонки задач.</p>
              <div className="mt-3 space-y-2">
                {taskStatusOptions.map((option) => <label className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-stone-800 hover:bg-stone-50" key={option.value}><input checked={selectedStatuses.includes(option.value)} className="size-4 accent-amber-800" onChange={() => setSelectedStatuses((current) => toggleChoice(current, option.value))} type="checkbox" /><span>{option.label}</span></label>)}
              </div>
            </fieldset>
          </div>
        ) : null}
      </section>

      {error ? <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-800" role="alert">{error}</p> : null}

      {visibleTasks.length === 0 ? (
        <section className="mt-6 max-w-2xl rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center">
          <h2 className="text-lg font-semibold text-stone-900">{filtersApplied ? "За обраними фільтрами задач немає." : "Задач поки немає."}</h2>
          {filtersApplied ? <button className="mt-5 min-h-11 rounded-full bg-amber-800 px-5 text-sm font-semibold text-white hover:bg-amber-900" onClick={clearFilters} type="button">Показати всі задачі</button> : <Link className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-amber-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-900" href="/tasks/add">Створити задачу</Link>}
        </section>
      ) : <><div className="mt-6 space-y-5 lg:hidden">{columns.map(renderColumn)}</div><div className="mt-6 hidden lg:grid lg:grid-cols-6 lg:gap-3">{columns.map(renderColumn)}</div></>}
    </>
  );
}
