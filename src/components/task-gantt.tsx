"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { taskAreaLabels, taskAreaOptions, taskHorizonLabels, taskHorizonOptions, taskStatusLabels } from "@/lib/task-options";
import type { Task, TaskArea, TaskHorizon } from "@/types/task";

type GanttRange = Readonly<{ start: Date; end: Date }>;
type DateRange = Readonly<{ start: string; end: string }>;
type GanttScale = "weeks" | "months" | "years";
type GanttRow = Readonly<{
  id: string;
  label: string;
  sublabel: string;
  href: string | null;
  planned: DateRange | null;
  actual: DateRange | null;
  emphasized?: boolean;
}>;
type PlanningConflict = Readonly<{
  id: string;
  independentTask: Task;
  projectTask: Task;
  sharedPeople: readonly string[];
  overlap: DateRange;
}>;

const monthFormatter = new Intl.DateTimeFormat("uk-UA", { month: "short", year: "2-digit" });
const weekFormatter = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short" });
const yearFormatter = new Intl.DateTimeFormat("uk-UA", { year: "numeric" });
const horizonOrder = { tactical: 0, operational: 1, strategic: 2 } as const;
const areaOrder: Record<TaskArea, number> = { work: 0, family: 1, personal: 2 };

function dateAtNoon(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

function dateOnly(value: string | null) {
  return value ? value.slice(0, 10) : null;
}

function localToday() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1, 12);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addYears(date: Date, years: number) {
  return new Date(date.getFullYear() + years, 0, 1, 12);
}

function startOfWeek(date: Date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const weekDay = result.getDay() || 7;
  result.setDate(result.getDate() - weekDay + 1);
  return result;
}

function timelineColumns(view: GanttRange, scale: GanttScale) {
  if (scale === "weeks") return Array.from({ length: 12 }, (_, index) => addDays(view.start, index * 7));
  if (scale === "years") return Array.from({ length: 5 }, (_, index) => addYears(view.start, index));
  return Array.from({ length: 6 }, (_, index) => addMonths(view.start, index));
}

function timelineLabel(value: Date, scale: GanttScale) {
  if (scale === "weeks") return weekFormatter.format(value);
  if (scale === "years") return yearFormatter.format(value);
  return monthFormatter.format(value);
}

function timelineView(anchor: Date, scale: GanttScale): GanttRange {
  if (scale === "weeks") {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 84) };
  }
  if (scale === "years") {
    const start = new Date(anchor.getFullYear(), 0, 1, 12);
    return { start, end: addYears(start, 5) };
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12);
  return { start, end: addMonths(start, 6) };
}

function shiftTimeline(anchor: Date, scale: GanttScale, direction: -1 | 1) {
  if (scale === "weeks") return addDays(anchor, direction * 84);
  if (scale === "years") return addYears(anchor, direction * 5);
  return addMonths(anchor, direction * 6);
}

function toggleChoice<T extends string>(current: readonly T[], choice: T) {
  return current.includes(choice) ? current.filter((item) => item !== choice) : [...current, choice];
}

function peopleForTask(task: Task) {
  return Array.from(new Set([task.assigneeName ?? task.createdByName, ...task.participants.map((participant) => participant.name)]));
}

function projectOptionsForTasks(tasks: readonly Task[]) {
  return Array.from(new Map(tasks.filter((task) => task.projectId && task.projectName).map((task) => [task.projectId as string, task.projectName as string])).entries())
    .map(([id, name]) => ({ id, name }))
    .sort((left, right) => left.name.localeCompare(right.name, "uk"));
}

function dayDiff(first: Date, second: Date) {
  return Math.round((second.getTime() - first.getTime()) / 86_400_000);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short" }).format(dateAtNoon(value));
}

function taskPlannedRange(task: Task): DateRange | null {
  const start = task.plannedStartDate ?? task.dueDate;
  const end = task.dueDate ?? task.plannedStartDate;
  return start && end ? { start: start <= end ? start : end, end: start <= end ? end : start } : null;
}

function taskActualRange(task: Task): DateRange | null {
  const start = dateOnly(task.actualStartedAt);
  if (!start) return null;
  const end = dateOnly(task.completedAt) ?? dateOnly(task.rejectedAt) ?? localToday();
  return { start: start <= end ? start : end, end: start <= end ? end : start };
}

function aggregateRange(ranges: readonly (DateRange | null)[]): DateRange | null {
  const present = ranges.filter((range): range is DateRange => range !== null);
  if (present.length === 0) return null;
  return {
    start: present.reduce((first, range) => range.start < first ? range.start : first, present[0].start),
    end: present.reduce((last, range) => range.end > last ? range.end : last, present[0].end),
  };
}

function rangesOverlap(first: DateRange, second: DateRange): DateRange | null {
  const start = first.start > second.start ? first.start : second.start;
  const end = first.end < second.end ? first.end : second.end;
  return start <= end ? { start, end } : null;
}

function sharedParticipantNames(first: Task, second: Task) {
  const secondParticipantIds = new Set(second.participants.map((participant) => participant.id));
  const sharedNames = first.participants
    .filter((participant) => secondParticipantIds.has(participant.id))
    .map((participant) => participant.name);

  if (sharedNames.length > 0) return sharedNames;
  return first.createdByName === second.createdByName ? [first.createdByName] : [];
}

function getPlanningConflicts(tasks: readonly Task[], view: GanttRange) {
  const independentTasks = tasks.filter((task) => !task.projectId);
  const projectTasks = tasks.filter((task) => task.projectId);
  const conflicts: PlanningConflict[] = [];

  independentTasks.forEach((independentTask) => {
    const independentRange = taskPlannedRange(independentTask);
    if (!independentRange || !visibleRange(independentRange, view)) return;

    projectTasks.forEach((projectTask) => {
      const projectRange = taskPlannedRange(projectTask);
      if (!projectRange || !visibleRange(projectRange, view)) return;
      const overlap = rangesOverlap(independentRange, projectRange);
      const sharedPeople = overlap ? sharedParticipantNames(independentTask, projectTask) : [];
      if (!overlap || sharedPeople.length === 0) return;

      conflicts.push({
        id: `${independentTask.id}-${projectTask.id}`,
        independentTask,
        projectTask,
        sharedPeople,
        overlap,
      });
    });
  });

  return conflicts.sort((first, second) => first.overlap.start.localeCompare(second.overlap.start));
}

function buildTaskRow(task: Task): GanttRow {
  return {
    id: task.id,
    label: task.title,
    sublabel: `${taskAreaLabels[task.area]} · ${taskHorizonLabels[task.horizon]} · ${taskStatusLabels[task.status]}`,
    href: `/tasks/${task.id}`,
    planned: taskPlannedRange(task),
    actual: taskActualRange(task),
  };
}

function visibleRange(range: DateRange, view: GanttRange) {
  const start = dateAtNoon(range.start);
  const end = dateAtNoon(range.end);
  return end >= view.start && start < view.end;
}

function barStyle(range: DateRange, view: GanttRange) {
  const rangeStart = dateAtNoon(range.start);
  const rangeEnd = dateAtNoon(range.end);
  const totalDays = Math.max(dayDiff(view.start, view.end), 1);
  const clippedStart = rangeStart < view.start ? view.start : rangeStart;
  const clippedEnd = rangeEnd >= view.end ? new Date(view.end.getTime() - 86_400_000) : rangeEnd;
  const left = Math.max(0, Math.min(100, (dayDiff(view.start, clippedStart) / totalDays) * 100));
  const width = Math.max(1.2, Math.min(100 - left, ((dayDiff(clippedStart, clippedEnd) + 1) / totalDays) * 100));
  return { left: `${left}%`, width: `${width}%` };
}

function Timeline({ actual, planned, scale, view }: Readonly<{ actual: DateRange | null; planned: DateRange | null; scale: GanttScale; view: GanttRange }>) {
  const columns = timelineColumns(view, scale);
  const plannedVisible = planned && visibleRange(planned, view);
  const actualVisible = actual && visibleRange(actual, view);

  return (
    <div className="relative h-11 min-w-0 overflow-hidden rounded-lg bg-stone-50" aria-label="Плановий та фактичний строки">
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column) => <div className="border-r border-stone-200/90 last:border-r-0" key={column.toISOString()} />)}
      </div>
      {plannedVisible ? <span className="absolute top-2 h-3 rounded-full bg-amber-500/90" style={barStyle(planned, view)} title={`План: ${formatShortDate(planned.start)} — ${formatShortDate(planned.end)}`} /> : null}
      {actualVisible ? <span className="absolute bottom-2 h-3 rounded-full bg-emerald-600" style={barStyle(actual, view)} title={`Факт: ${formatShortDate(actual.start)} — ${formatShortDate(actual.end)}`} /> : null}
      {!plannedVisible && !actualVisible ? <span className="absolute inset-0 flex items-center px-3 text-[11px] text-stone-400">Поза обраним періодом або без строку</span> : null}
    </div>
  );
}

function TimelineHeader({ scale, view }: Readonly<{ scale: GanttScale; view: GanttRange }>) {
  const columns = timelineColumns(view, scale);

  return <div className="grid min-w-0 text-center text-[10px] font-bold tracking-wide text-stone-500 uppercase" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>{columns.map((column) => <span className="truncate border-r border-stone-200 px-1 last:border-r-0" key={column.toISOString()}>{timelineLabel(column, scale)}</span>)}</div>;
}

function GanttDataRows({ rows, scale, view }: Readonly<{ rows: readonly GanttRow[]; scale: GanttScale; view: GanttRange }>) {
  return <div className="divide-y divide-stone-100">{rows.map((row) => <div className="grid grid-cols-[minmax(8.5rem,1.05fr)_minmax(11rem,2.95fr)] gap-3 px-3 py-2.5 sm:grid-cols-[minmax(14rem,1.05fr)_minmax(20rem,2.95fr)]" key={row.id}>
    <div className="min-w-0 self-center">
      {row.href ? <Link className="block truncate text-sm font-semibold text-stone-900 hover:text-amber-800 hover:underline" href={row.href} title={row.label}>{row.label}</Link> : <p className="truncate text-sm font-semibold text-stone-900" title={row.label}>{row.label}</p>}
      <p className="mt-0.5 truncate text-[11px] leading-4 text-stone-500" title={row.sublabel}>{row.sublabel}</p>
    </div>
    <Timeline actual={row.actual} planned={row.planned} scale={scale} view={view} />
  </div>)}</div>;
}

export function TaskGantt({ setupError, tasks }: Readonly<{ setupError: string | null; tasks: readonly Task[] }>) {
  const today = useMemo(() => new Date(), []);
  const [anchor, setAnchor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1, 12));
  const [scale, setScale] = useState<GanttScale>("months");
  const [includeFinished, setIncludeFinished] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedHorizons, setSelectedHorizons] = useState<readonly TaskHorizon[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<readonly TaskArea[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<readonly string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<readonly string[]>([]);
  const view = useMemo(() => timelineView(anchor, scale), [anchor, scale]);
  const people = useMemo(() => Array.from(new Set(tasks.flatMap(peopleForTask))).sort((left, right) => left.localeCompare(right, "uk")), [tasks]);
  const projects = useMemo(() => projectOptionsForTasks(tasks), [tasks]);
  const filtersApplied = !includeFinished || selectedHorizons.length > 0 || selectedAreas.length > 0 || selectedPeople.length > 0 || selectedProjectIds.length > 0;
  const visibleTasks = useMemo(() => tasks
    .filter((task) => includeFinished || (task.status !== "completed" && task.status !== "rejected"))
    .filter((task) => selectedHorizons.length === 0 || selectedHorizons.includes(task.horizon))
    .filter((task) => selectedAreas.length === 0 || selectedAreas.includes(task.area))
    .filter((task) => selectedPeople.length === 0 || peopleForTask(task).some((person) => selectedPeople.includes(person)))
    .filter((task) => selectedProjectIds.length === 0 || (task.projectId !== null && selectedProjectIds.includes(task.projectId)))
    .sort((first, second) => horizonOrder[first.horizon] - horizonOrder[second.horizon] || areaOrder[first.area] - areaOrder[second.area] || first.title.localeCompare(second.title, "uk")), [includeFinished, selectedAreas, selectedHorizons, selectedPeople, selectedProjectIds, tasks]);
  const projectGroups = useMemo(() => {
    const groups = new Map<string, Task[]>();
    visibleTasks.filter((task) => task.projectId && task.projectName).forEach((task) => {
      const key = task.projectId as string;
      groups.set(key, [...(groups.get(key) ?? []), task]);
    });
    return [...groups.entries()].map(([id, groupTasks]) => ({ id, name: groupTasks[0].projectName as string, tasks: groupTasks }));
  }, [visibleTasks]);
  const independentGroups = useMemo(() => (["work", "family", "personal"] as const).map((area) => ({ area, tasks: visibleTasks.filter((task) => !task.projectId && task.area === area) })).filter((group) => group.tasks.length > 0), [visibleTasks]);
  const planningConflicts = useMemo(() => getPlanningConflicts(visibleTasks, view), [view, visibleTasks]);

  const resetToToday = () => setAnchor(new Date(today.getFullYear(), today.getMonth(), 1, 12));

  function clearFilters() {
    setIncludeFinished(true);
    setSelectedHorizons([]);
    setSelectedAreas([]);
    setSelectedPeople([]);
    setSelectedProjectIds([]);
  }

  return <>
    <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm" aria-label="Керування діаграмою Ганта">
      <div className="flex flex-wrap items-center gap-2">
        <button className="min-h-9 rounded-full border border-stone-300 px-3 text-xs font-semibold text-stone-800 hover:bg-stone-50" onClick={() => setAnchor((current) => shiftTimeline(current, scale, -1))} type="button">← Раніше</button>
        <button className="min-h-9 rounded-full border border-stone-300 px-3 text-xs font-semibold text-stone-800 hover:bg-stone-50" onClick={resetToToday} type="button">Сьогодні</button>
        <button className="min-h-9 rounded-full border border-stone-300 px-3 text-xs font-semibold text-stone-800 hover:bg-stone-50" onClick={() => setAnchor((current) => shiftTimeline(current, scale, 1))} type="button">Пізніше →</button>
        <label className="ml-auto flex min-h-9 items-center gap-2 rounded-full border border-stone-300 px-3 text-xs font-semibold text-stone-700">Шкала<select className="bg-transparent outline-none" onChange={(event) => setScale(event.target.value as GanttScale)} value={scale}><option value="weeks">Тижні · 12</option><option value="months">Місяці · 6</option><option value="years">Роки · 5</option></select></label>
        <label className="flex min-h-9 items-center gap-2 rounded-full border border-stone-300 px-3 text-xs font-semibold text-stone-700"><input checked={includeFinished} className="size-3.5 accent-amber-800" onChange={(event) => setIncludeFinished(event.target.checked)} type="checkbox" />Завершені</label>
        <button aria-expanded={filtersOpen} className="min-h-9 rounded-full border border-stone-300 px-3 text-xs font-semibold text-stone-800 hover:bg-stone-50" onClick={() => setFiltersOpen((open) => !open)} type="button">Фільтри{filtersApplied ? ` (${selectedHorizons.length + selectedAreas.length + selectedPeople.length + selectedProjectIds.length + (includeFinished ? 0 : 1)})` : ""}</button>
        {filtersApplied ? <button className="min-h-9 rounded-full px-2 text-xs font-semibold text-stone-600 hover:bg-stone-100" onClick={clearFilters} type="button">Очистити</button> : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600"><span><i className="mr-1.5 inline-block h-2.5 w-4 rounded-full bg-amber-500 align-middle" />План</span><span><i className="mr-1.5 inline-block h-2.5 w-4 rounded-full bg-emerald-600 align-middle" />Факт</span><span>Планове завершення — «Бажана дата» задачі.</span><span>{scale === "weeks" ? "Показано 12 тижнів." : scale === "months" ? "Показано 6 місяців." : "Показано 5 років."}</span></div>

      {filtersOpen ? <div className="mt-4 grid gap-5 border-t border-stone-100 pt-4 sm:grid-cols-2 xl:grid-cols-4">
        <fieldset><legend className="text-sm font-semibold text-stone-950">Рівень планування</legend><p className="mt-1 text-xs leading-5 text-stone-500">Можна обрати кілька.</p><div className="mt-2 space-y-1">{taskHorizonOptions.map((option) => <label className="flex min-h-8 items-center gap-2 rounded-lg px-2 text-sm text-stone-800 hover:bg-stone-50" key={option.value}><input checked={selectedHorizons.includes(option.value)} className="size-3.5 accent-amber-800" onChange={() => setSelectedHorizons((current) => toggleChoice(current, option.value))} type="checkbox" />{option.label}</label>)}</div></fieldset>
        <fieldset><legend className="text-sm font-semibold text-stone-950">Напрям</legend><p className="mt-1 text-xs leading-5 text-stone-500">Робота, сім’я або особисте.</p><div className="mt-2 space-y-1">{taskAreaOptions.map((option) => <label className="flex min-h-8 items-center gap-2 rounded-lg px-2 text-sm text-stone-800 hover:bg-stone-50" key={option.value}><input checked={selectedAreas.includes(option.value)} className="size-3.5 accent-amber-800" onChange={() => setSelectedAreas((current) => toggleChoice(current, option.value))} type="checkbox" />{option.label}</label>)}</div></fieldset>
        <fieldset><legend className="text-sm font-semibold text-stone-950">Люди</legend><p className="mt-1 text-xs leading-5 text-stone-500">Задачі хоча б з одним обраним учасником.</p><div className="mt-2 space-y-1">{people.length > 0 ? people.map((person) => <label className="flex min-h-8 items-center gap-2 rounded-lg px-2 text-sm text-stone-800 hover:bg-stone-50" key={person}><input checked={selectedPeople.includes(person)} className="size-3.5 accent-amber-800" onChange={() => setSelectedPeople((current) => toggleChoice(current, person))} type="checkbox" />{person}</label>) : <p className="text-sm text-stone-500">Учасники з’являться після створення задач.</p>}</div></fieldset>
        <fieldset><legend className="text-sm font-semibold text-stone-950">Проєкти</legend><p className="mt-1 text-xs leading-5 text-stone-500">Без вибору — усі проєкти й простори.</p><div className="mt-2 space-y-1">{projects.length > 0 ? projects.map((project) => <label className="flex min-h-8 items-center gap-2 rounded-lg px-2 text-sm text-stone-800 hover:bg-stone-50" key={project.id}><input checked={selectedProjectIds.includes(project.id)} className="size-3.5 accent-amber-800" onChange={() => setSelectedProjectIds((current) => toggleChoice(current, project.id))} type="checkbox" />{project.name}</label>) : <p className="text-sm text-stone-500">Проєкти з’являться після створення задачі в проєкті.</p>}</div></fieldset>
      </div> : null}
    </section>

    {setupError ? <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"><strong>Щоб діаграма показувала обидві смуги:</strong> {setupError}</section> : null}

    {planningConflicts.length > 0 ? <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3" aria-label="Накладки планів">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-sm font-bold text-amber-950">Накладки планів</h2><p className="text-xs text-amber-900">Спільний учасник має дві задачі в один період.</p></div>
      <ul className="mt-2 divide-y divide-amber-200/80">{planningConflicts.slice(0, 5).map((conflict) => <li className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-xs leading-5 text-amber-950" key={conflict.id}>
        <Link className="font-semibold hover:underline" href={`/tasks/${conflict.independentTask.id}`}>{conflict.independentTask.title}</Link><span className="text-amber-700">↔</span><Link className="font-semibold hover:underline" href={`/tasks/${conflict.projectTask.id}`}>{conflict.projectTask.title}</Link><span className="text-amber-800">· {conflict.projectTask.projectName}</span><span className="text-amber-800">· {conflict.sharedPeople.join(", ")}</span><span className="text-amber-800">· {formatShortDate(conflict.overlap.start)} — {formatShortDate(conflict.overlap.end)}</span>
      </li>)}</ul>
      {planningConflicts.length > 5 ? <p className="mt-2 text-xs text-amber-900">Ще накладок: {planningConflicts.length - 5}.</p> : null}
    </section> : null}

    {visibleTasks.length === 0 ? <section className="mt-6 rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center"><h2 className="text-lg font-semibold text-stone-900">{filtersApplied ? "За обраними фільтрами задач немає." : "Немає задач для діаграми."}</h2><p className="mt-2 text-sm text-stone-600">{filtersApplied ? "Змініть фільтри або поверніть усі задачі." : "Створіть задачу з бажаною датою — вона з’явиться на шкалі."}</p>{filtersApplied ? <button className="mt-5 min-h-10 rounded-full bg-amber-800 px-4 text-sm font-semibold text-white hover:bg-amber-900" onClick={clearFilters} type="button">Показати всі задачі</button> : <Link className="mt-5 inline-flex min-h-10 items-center justify-center rounded-full bg-amber-800 px-4 text-sm font-semibold text-white hover:bg-amber-900" href="/tasks/add">Нова задача</Link>}</section> : <section className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="grid grid-cols-[minmax(8.5rem,1.05fr)_minmax(11rem,2.95fr)] gap-3 border-b border-stone-200 bg-stone-50 px-3 py-2 sm:grid-cols-[minmax(14rem,1.05fr)_minmax(20rem,2.95fr)]"><p className="text-[10px] font-bold tracking-wide text-stone-500 uppercase">Проєкт / задача</p><TimelineHeader scale={scale} view={view} /></div>
      {projectGroups.map((group) => {
        const projectRow: GanttRow = { id: `project-${group.id}`, label: group.name, sublabel: `${group.tasks.length} задач`, href: null, planned: aggregateRange(group.tasks.map(taskPlannedRange)), actual: aggregateRange(group.tasks.map(taskActualRange)), emphasized: true };
        return <section className="border-b border-stone-200 last:border-b-0" key={group.id}><div className="border-b border-amber-100 bg-amber-50/70"><GanttDataRows rows={[projectRow]} scale={scale} view={view} /></div><GanttDataRows rows={group.tasks.map(buildTaskRow)} scale={scale} view={view} /></section>;
      })}
      {independentGroups.map((group) => <section className="border-b border-stone-200 last:border-b-0" key={group.area}><div className="bg-stone-50 px-3 py-2 text-xs font-bold tracking-wide text-stone-600 uppercase">{taskAreaLabels[group.area]} · поза проєктом</div><GanttDataRows rows={group.tasks.map(buildTaskRow)} scale={scale} view={view} /></section>)}
    </section>}
  </>;
}
