"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { taskHorizonOptions, taskHorizonLabels } from "@/lib/task-options";
import { createClient } from "@/lib/supabase/client";
import type { Task, TaskHorizon, TaskMember, TaskProject, TaskSpace } from "@/types/task";

type TaskProjectsPanelProps = Readonly<{
  currentMember: TaskMember;
  spaces: readonly TaskSpace[];
  projects: readonly TaskProject[];
  tasks: readonly Task[];
  setupError: string | null;
  testMode: boolean;
}>;

function projectStatusLabel(project: TaskProject) {
  return project.status === "active" ? "Активний" : "Закритий";
}

function projectSummary(projectId: string, tasks: readonly Task[]) {
  const projectTasks = tasks.filter((task) => task.projectId === projectId);
  return {
    total: projectTasks.length,
    active: projectTasks.filter((task) => task.status === "active").length,
    inProgress: projectTasks.filter((task) => task.status === "in_work" || task.status === "in_progress").length,
    completed: projectTasks.filter((task) => task.status === "completed").length,
  };
}

export function TaskProjectsPanel({ currentMember, spaces, projects, tasks, setupError, testMode }: TaskProjectsPanelProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scopeId, setScopeId] = useState("");
  const [horizon, setHorizon] = useState<TaskHorizon>("tactical");
  const [isCreating, setIsCreating] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const projectName = name.trim();
    const scope = spaces.find((item) => item.id === scopeId) ?? spaces[0];
    if (projectName.length < 2) {
      setError("Назва проєкту має містити щонайменше два символи.");
      return;
    }
    if (!scope) {
      setError("Спершу створіть або приєднайтеся до простору.");
      return;
    }
    if (testMode) {
      setError("У тестовому режимі проєкти показані для перегляду. Для створення відкрийте Задачник із підключеним Supabase.");
      return;
    }

    setError("");
    setIsCreating(true);
    const { error: rpcError } = await createClient().rpc("create_task_project", {
      target_family_id: scope.kind === "family" ? scope.id : null,
      target_workspace_id: scope.kind === "workspace" ? scope.id : null,
      project_name: projectName,
      project_horizon: horizon,
      creator_display_name: currentMember.name,
    });
    if (rpcError) {
      setError("Не вдалося створити проєкт. Перевірте, чи виконано supabase/task-projects.sql.");
      setIsCreating(false);
      return;
    }
    setName("");
    setScopeId("");
    setIsCreating(false);
    router.refresh();
  }

  async function closeProject(projectId: string) {
    if (testMode) return;
    setError("");
    setClosingId(projectId);
    const { error: rpcError } = await createClient().rpc("set_task_project_status", { target_project_id: projectId, next_status: "closed" });
    if (rpcError) setError("Не вдалося закрити проєкт. Перевірте права доступу або виконання task-projects.sql.");
    else router.refresh();
    setClosingId(null);
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.75fr)]">
      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-semibold tracking-tight text-stone-950">Проєкти</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">Проєкт — це тимчасовий контейнер задач усередині постійного простору. Наприклад, «Будівництво дому» може бути у просторі «Дача», а після завершення його можна закрити.</p>
        {setupError ? <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">{setupError}</p> : null}
        {projects.length === 0 ? <p className="mt-6 rounded-2xl bg-stone-100 px-4 py-4 text-sm leading-6 text-stone-600">Проєктів поки немає. Постійні «Дача», «Квартира» тощо створюйте як простори, а конкретні роботи — як проєкти.</p> : (
          <ul className="mt-6 divide-y divide-stone-100">
            {projects.map((project) => {
              const summary = projectSummary(project.id, tasks);
              return <li className="flex flex-wrap items-center justify-between gap-3 py-4" key={project.id}>
              <div className="min-w-0"><h3 className="font-semibold text-stone-950">{project.name}</h3><p className="mt-1 text-sm text-stone-600">{project.scopeKind === "workspace" ? "Робота" : "Сім’я"}: {project.scopeName} · {taskHorizonLabels[project.horizon]}</p><p className="mt-1 text-xs leading-5 text-stone-500">Задач: {summary.total} · у роботі: {summary.inProgress} · активних: {summary.active} · виконано: {summary.completed}</p></div>
              <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${project.status === "active" ? "bg-emerald-100 text-emerald-900" : "bg-stone-100 text-stone-600"}`}>{projectStatusLabel(project)}</span><Link className="inline-flex min-h-9 items-center rounded-full border border-stone-300 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-100" href={`/tasks/list?project=${encodeURIComponent(project.id)}`}>Задачі</Link>{project.status === "active" ? <button className="min-h-9 rounded-full border border-stone-300 px-3 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:cursor-wait disabled:opacity-60" disabled={closingId === project.id} onClick={() => void closeProject(project.id)} type="button">{closingId === project.id ? "Закриваємо…" : "Закрити"}</button> : null}</div>
            </li>;
            })}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-7">
        <h2 className="text-xl font-semibold tracking-tight text-stone-950">Новий проєкт</h2>
        <p className="mt-2 text-sm leading-6 text-stone-700">Проєкт успадковує учасників і доступ від вибраного простору. Початковий рівень — тактичний.</p>
        <form className="mt-5 space-y-4" noValidate onSubmit={createProject}>
          <div><label className="block text-sm font-semibold text-stone-900" htmlFor="project-name">Назва</label><input className="mt-2 min-h-11 w-full rounded-2xl border border-amber-200 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100" id="project-name" onChange={(event) => setName(event.target.value)} placeholder="Наприклад, Будівництво дому" value={name} /></div>
          <div><label className="block text-sm font-semibold text-stone-900" htmlFor="project-scope">Постійний простір</label><select className="mt-2 min-h-11 w-full rounded-2xl border border-amber-200 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100" id="project-scope" onChange={(event) => setScopeId(event.target.value)} value={scopeId || spaces[0]?.id || ""}>{spaces.map((space) => <option key={space.kind + space.id} value={space.id}>{space.kind === "workspace" ? "Робота: " : "Сім’я: "}{space.name}</option>)}</select></div>
          <div><label className="block text-sm font-semibold text-stone-900" htmlFor="project-horizon">Рівень планування</label><select className="mt-2 min-h-11 w-full rounded-2xl border border-amber-200 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100" id="project-horizon" onChange={(event) => setHorizon(event.target.value as TaskHorizon)} value={horizon}>{taskHorizonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-900" role="alert">{error}</p> : null}
          <button className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-amber-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-900 disabled:cursor-wait disabled:opacity-60" disabled={isCreating || spaces.length === 0} type="submit">{isCreating ? "Створюємо…" : "Створити проєкт"}</button>
        </form>
      </section>
    </div>
  );
}
