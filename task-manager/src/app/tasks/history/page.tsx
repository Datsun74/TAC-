import { TaskBoard } from "../../../../../src/components/task-board";
import { getTaskUserContext } from "../../../../../src/lib/task-access";
import { isLocalTestMode } from "../../../../../src/lib/test-mode";
import { getTasks } from "../../../../../src/lib/tasks";

export default async function TasksHistoryPage() {
  const testMode = isLocalTestMode();
  const member = await getTaskUserContext();
  const result = testMode ? null : await getTasks(["completed", "rejected"]);

  return (
    <section className="w-full py-10 sm:py-14 lg:py-16">
      <p className="text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">Історія</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">Завершені задачі</h1>
      <p className="mt-3 max-w-2xl leading-7 text-stone-600">Тут зберігається історія виконаних і відхилених задач; вона не заважає активному плану.</p>

      {result?.error ? (
        <section className="mt-8 max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 px-6 py-8">
          <h2 className="text-lg font-semibold text-amber-950">Задачник потребує одного налаштування</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">{result.error}</p>
        </section>
      ) : <TaskBoard memberName={member.displayName} tasks={result?.tasks ?? []} testMode={testMode} view="history" />}
    </section>
  );
}
