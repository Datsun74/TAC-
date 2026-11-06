"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { taskAreaLabels, taskHorizonLabels, taskStatusLabels } from "@/lib/task-options";
import type { Task, TaskArea } from "@/types/task";

type GanttRange = Readonly<{ start: Date; end: Date }>;
type DateRange = Readonly<{ start: string; end: string }>;
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

function Timeline({ actual, planned, view }: Readonly<{ actual: DateRange | null; planned: DateRange | null; view: GanttRange }>) {
  const monthCount = Math.max(1, Math.round((view.end.getTime() - view.start.getTime()) / (30.5 * 86_400_000)));
  const monthColumns = Array.from({ length: monthCount }, (_, index) => addMonths(view.start, index));
  const plannedVisible = planned && visibleRange(planned, view);
  const actualVisible = actual && visibleRange(actual, view);

  return (
    <div className="relative h-11 min-w-0 overflow-hidden rounded-lg bg-stone-50" aria-label="Плановий та фактичний строки">
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${monthColumns.length}, minmax(0, 1fr))` }}>
        {monthColumns.map((month) => <div className="border-r border-stone-200/90 last:border-r-0" key={month.toISOString()} />)}
      </div>
      {plannedVisible ? <span className="absolute top-2 h-3 rounded-full bg-amber-500/90" style={barStyle(planned, view)} title={`План: ${formatShortDate(planned.start)} — ${formatShortDate(planned.end)}`} /> : null}
      {actualVisible ? <span className="absolute bottom-2 h-3 rounded-full bg-emerald-600" style={barStyle(actual, view)} title={`Факт: ${formatShortDate(actual.start)} — ${formatShortDate(actual.end)}`} /> : null}
      {!plannedVisible && !actualVisible ? <span className="absolute inset-0 flex items-center px-3 text-[11px] text-stone-400">Поза обраним періодом або без строку</span> : null}
    </div>
  );
}

function TimelineHeader({ view }: Readonly<{ view: GanttRange }>) {
  const monthCount = Math.max(1, Math.round((view.end.getTime() - view.start.getTime()) / (30.5 * 86_400_000)));
  const monthColumns = Array.from({ length: monthCount }, (_, index) => addMonths(view.start, index));

  return <div className="grid min-w-0 text-center text-[10px] font-bold tracking-wide text-stone-500 uppercase" style={{ gridTemplateColumns: `repeat(${monthColumns.length}, minmax(0, 1fr))` }}>{monthColumns.map((month) => <span className="truncate border-r border-stone-200 px-1 last:border-r-0" key={month.toISOString()}>{monthFormatter.format(month)}</span>)}</div>;
}

function GanttDataRows({ rows, view }: Readonly<{ rows: readonly GanttRow[]; view: GanttRange }>) {
  return <div className="divide-y divide-stone-100">{rows.map((row) => <div className="grid grid-cols-[minmax(8.5rem,1.05fr)_minmax(11rem,2.95fr)] gap-3 px-3 py-2.5 sm:grid-cols-[minmax(14rem,1.05fr)_minmax(20rem,2.95fr)]" key={row.id}>
    <div className="min-w-0 self-center">
      {row.href ? <Link className="block truncate text-sm font-semibold text-stone-900 hover:text-amber-800 hover:underline" href={row.href} title={row.label}>{row.label}</Link> : <p className="truncate text-sm font-semibold text-stone-900" title={row.label}>{row.label}</p>}
      <p className="mt-0.5 truncate text-[11px] leading-4 text-stone-500" title={row.sublabel}>{row.sublabel}</p>
    </div>
    <Timeline actual={row.actual} planned={row.planned} view={view} />
  </div>)}</div>;
}

export function TaskGantt({ setupError, tasks }: Readonly<{ setupError: string | null; tasks: readonly Task[] }>) {
  const today = useMemo(() => new Date(), []);
  const [anchorMonth, setAnchorMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1, 12));
  const [months, setMonths] = useState<3 | 6 | 12>(6);
  const [includeFinished, setIncludeFinished] = useState(true);
  const view = useMemo<GanttRange>(() => ({ start: anchorMonth, end: addMonths(anchorMonth, months) }), [anchorMonth, months]);
  const visibleTasks = useMemo(() => tasks
    .filter((task) => includeFinished || (task.status !== "completed" && task.status !== "rejected"))
    .sort((first, second) => horizonOrder[first.horizon] - horizonOrder[second.horizon] || areaOrder[first.area] - areaOrder[second.area] || first.title.localeCompare(second.title, "uk")), [includeFinished, tasks]);
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

  const resetToToday = () => setAnchorMonth(new Date(today.getFullYear(), today.getMonth(), 1, 12));

  return <>
    <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm" aria-label="Керування діаграмою Ганта">
      <div className="flex flex-wrap items-center gap-2">
        <button className="min-h-9 rounded-full border border-stone-300 px-3 text-xs font-semibold text-stone-800 hover:bg-stone-50" onClick={() => setAnchorMonth((month) => addMonths(month, -months))} type="button">← Раніше</button>
        <button className="min-h-9 rounded-full border border-stone-300 px-3 text-xs font-semibold text-stone-800 hover:bg-stone-50" onClick={resetToToday} type="button">Сьогодні</button>
        <button className="min-h-9 rounded-full border border-stone-300 px-3 text-xs font-semibold text-stone-800 hover:bg-stone-50" onClick={() => setAnchorMonth((month) => addMonths(month, months))} type="button">Пізніше →</button>
        <label className="ml-auto flex min-h-9 items-center gap-2 rounded-full border border-stone-300 px-3 text-xs font-semibold text-stone-700">Період<select className="bg-transparent outline-none" onChange={(event) => setMonths(Number(event.target.value) as 3 | 6 | 12)} value={months}><option value={3}>3 міс.</option><option value={6}>6 міс.</option><option value={12}>12 міс.</option></select></label>
        <label className="flex min-h-9 items-center gap-2 rounded-full border border-stone-300 px-3 text-xs font-semibold text-stone-700"><input checked={includeFinished} className="size-3.5 accent-amber-800" onChange={(event) => setIncludeFinished(event.target.checked)} type="checkbox" />Завершені</label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600"><span><i className="mr-1.5 inline-block h-2.5 w-4 rounded-full bg-amber-500 align-middle" />План</span><span><i className="mr-1.5 inline-block h-2.5 w-4 rounded-full bg-emerald-600 align-middle" />Факт</span><span>Планове завершення — «Бажана дата» задачі.</span></div>
    </section>

    {setupError ? <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"><strong>Щоб діаграма показувала обидві смуги:</strong> {setupError}</section> : null}

    {planningConflicts.length > 0 ? <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3" aria-label="Накладки планів">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-sm font-bold text-amber-950">Накладки планів</h2><p className="text-xs text-amber-900">Спільний учасник має дві задачі в один період.</p></div>
      <ul className="mt-2 divide-y divide-amber-200/80">{planningConflicts.slice(0, 5).map((conflict) => <li className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-xs leading-5 text-amber-950" key={conflict.id}>
        <Link className="font-semibold hover:underline" href={`/tasks/${conflict.independentTask.id}`}>{conflict.independentTask.title}</Link><span className="text-amber-700">↔</span><Link className="font-semibold hover:underline" href={`/tasks/${conflict.projectTask.id}`}>{conflict.projectTask.title}</Link><span className="text-amber-800">· {conflict.projectTask.projectName}</span><span className="text-amber-800">· {conflict.sharedPeople.join(", ")}</span><span className="text-amber-800">· {formatShortDate(conflict.overlap.start)} — {formatShortDate(conflict.overlap.end)}</span>
      </li>)}</ul>
      {planningConflicts.length > 5 ? <p className="mt-2 text-xs text-amber-900">Ще накладок: {planningConflicts.length - 5}.</p> : null}
    </section> : null}

    {visibleTasks.length === 0 ? <section className="mt-6 rounded-3xl border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center"><h2 className="text-lg font-semibold text-stone-900">Немає задач для діаграми.</h2><p className="mt-2 text-sm text-stone-600">Створіть задачу з бажаною датою — вона з’явиться на шкалі.</p><Link className="mt-5 inline-flex min-h-10 items-center justify-center rounded-full bg-amber-800 px-4 text-sm font-semibold text-white hover:bg-amber-900" href="/tasks/add">Нова задача</Link></section> : <section className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="grid grid-cols-[minmax(8.5rem,1.05fr)_minmax(11rem,2.95fr)] gap-3 border-b border-stone-200 bg-stone-50 px-3 py-2 sm:grid-cols-[minmax(14rem,1.05fr)_minmax(20rem,2.95fr)]"><p className="text-[10px] font-bold tracking-wide text-stone-500 uppercase">Проєкт / задача</p><TimelineHeader view={view} /></div>
      {projectGroups.map((group) => {
        const projectRow: GanttRow = { id: `project-${group.id}`, label: group.name, sublabel: `${group.tasks.length} задач`, href: null, planned: aggregateRange(group.tasks.map(taskPlannedRange)), actual: aggregateRange(group.tasks.map(taskActualRange)), emphasized: true };
        return <section className="border-b border-stone-200 last:border-b-0" key={group.id}><div className="border-b border-amber-100 bg-amber-50/70"><GanttDataRows rows={[projectRow]} view={view} /></div><GanttDataRows rows={group.tasks.map(buildTaskRow)} view={view} /></section>;
      })}
      {independentGroups.map((group) => <section className="border-b border-stone-200 last:border-b-0" key={group.area}><div className="bg-stone-50 px-3 py-2 text-xs font-bold tracking-wide text-stone-600 uppercase">{taskAreaLabels[group.area]} · поза проєктом</div><GanttDataRows rows={group.tasks.map(buildTaskRow)} view={view} /></section>)}
    </section>}
  </>;
}
