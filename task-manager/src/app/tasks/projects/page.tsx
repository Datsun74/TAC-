import { TaskProjectsPanel } from "../../../../../src/components/task-projects-panel";
import { isLocalTestMode } from "../../../../../src/lib/test-mode";
import { getTaskFormContext } from "../../../../../src/lib/tasks";

export default async function TaskProjectsPage() {
  const context = await getTaskFormContext();

  return (
    <section className="w-full py-10 sm:py-14 lg:py-16">
      <p className="text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">Планування</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">Проєкти</h1>
      <p className="mt-3 max-w-3xl leading-7 text-stone-600">Простори є постійними, а проєкти мають конкретну мету та строк життя. Один проєкт може містити багато задач і підзадач.</p>
      {context.error ? <p className="mt-6 max-w-3xl rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{context.error}</p> : null}
      <TaskProjectsPanel currentMember={context.currentMember} projects={context.projects} setupError={context.projectsSetupError} spaces={context.spaces} testMode={isLocalTestMode()} />
    </section>
  );
}
