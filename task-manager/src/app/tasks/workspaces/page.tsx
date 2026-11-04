import { TaskWorkspacesPanel } from "../../../../../src/components/task-workspaces-panel";
import { getTaskUserContext, getTaskWorkspaceMembers } from "../../../../../src/lib/task-access";
import { isLocalTestMode } from "../../../../../src/lib/test-mode";

export default async function TaskWorkspacesPage() {
  const context = await getTaskUserContext();
  const members = await getTaskWorkspaceMembers(context.workspaces.map((workspace) => workspace.id));

  return (
    <section className="w-full py-10 sm:py-14 lg:py-16">
      <p className="text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">Доступ</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">Робочі простори</h1>
      <p className="mt-3 max-w-2xl leading-7 text-stone-600">Запрошуйте працівників окремим кодом. Вони бачитимуть лише задачі свого робочого простору.</p>
      <TaskWorkspacesPanel currentUserId={context.userId} displayName={context.displayName} testMode={isLocalTestMode()} workspaceMembers={members} workspaces={context.workspaces} />
    </section>
  );
}
