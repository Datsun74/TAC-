import Link from "next/link";

import { TaskBoard } from "../../../../../src/components/task-board";
import { getTaskUserContext } from "../../../../../src/lib/task-access";
import { isLocalTestMode } from "../../../../../src/lib/test-mode";
import { getTasks } from "../../../../../src/lib/tasks";

export default async function TasksListPage({ searchParams }: Readonly<{ searchParams: Promise<{ project?: string }> }>) {
  const testMode = isLocalTestMode();
  const member = await getTaskUserContext();
  const result = testMode ? null : await getTasks(["active", "in_work", "in_progress", "postponed"]);
  const { project: requestedProjectId } = await searchParams;
  const tasks = result?.tasks ?? [];
  const selectedProject = requestedProjectId ? tasks.find((task) => task.projectId === requestedProjectId) ?? null : null;
  const filteredTasks = requestedProjectId ? tasks.filter((task) => task.projectId === requestedProjectId) : tasks;
  const projectTaskCount = testMode ? null : filteredTasks.length;

  return (
    <section className="w-full py-10 sm:py-14 lg:py-16">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">Планування</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">{requestedProjectId ? selectedProject?.projectName ?? "Задачі проєкту" : "Усі задачі"}</h1>
          <p className="mt-3 max-w-2xl leading-7 text-stone-600">{requestedProjectId ? "Відкриті задачі вибраного проєкту. Щоб повернутися до загального списку, очистіть вибір нижче." : "Особисті та спільні справи, згруповані за напрямом і рівнем планування."}</p>
        </div>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-full bg-amber-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-900 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none" href="/tasks/add">+ Нова задача</Link>
      </div>

      {result?.error ? (
        <section className="mt-8 max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 px-6 py-8">
          <h2 className="text-lg font-semibold text-amber-950">Задачник потребує одного налаштування</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">{result.error}</p>
        </section>
      ) : <><div className="mt-6 flex flex-wrap items-center gap-3">{requestedProjectId ? <Link className="inline-flex min-h-10 items-center rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-700 hover:bg-stone-50" href="/tasks/list">Показати всі задачі</Link> : null}{projectTaskCount !== null ? <p className="text-sm text-stone-500">У проєкті відкритих задач: {projectTaskCount}.</p> : null}</div><TaskBoard memberName={member.displayName} projectId={requestedProjectId} tasks={filteredTasks} testMode={testMode} view="list" /></>}
    </section>
  );
}
