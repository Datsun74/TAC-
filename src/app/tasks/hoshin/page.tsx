import Link from "next/link";

import { TaskHoshinKanri } from "@/components/task-hoshin-kanri";
import { getHoshinKanriData } from "@/lib/hoshin";
import { getTaskUserContext } from "@/lib/task-access";
import { getTasks } from "@/lib/tasks";
import { isLocalTestMode } from "@/lib/test-mode";
import { taskStatuses } from "@/types/task";

export default async function TasksHoshinPage() {
  const testMode = isLocalTestMode();

  if (testMode) {
    return (
      <section className="w-full py-10 sm:py-14 lg:py-16">
        <p className="text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">Стратегічне розгортання</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">Хошин Канрі</h1>
        <section className="mt-8 max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 px-6 py-8">
          <h2 className="text-lg font-semibold text-amber-950">Хошин Канрі доступний після підключення Supabase</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">Цей блок зберігає каскад стратегічної цілі, підрозділів та відділів для спільної роботи. У тестовому режимі ці дані не створюються.</p>
          <Link className="mt-5 inline-flex rounded-xl bg-amber-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-900" href="/tasks/add">+ Створити стратегічну задачу</Link>
        </section>
      </section>
    );
  }

  const [context, tasksResult, hoshin] = await Promise.all([getTaskUserContext(), getTasks(taskStatuses), getHoshinKanriData()]);
  const strategicTasks = tasksResult.tasks.filter((task) => task.horizon === "strategic");

  return (
    <section className="w-full py-10 sm:py-14 lg:py-16">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">Стратегічне розгортання</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">Хошин Канрі</h1>
          <p className="mt-3 max-w-3xl leading-7 text-stone-600">Каскад стратегічної цілі від центрального рівня до підрозділів і відділів. На кожному рівні фіксуються дія, вимірювана метрика та пропозиції виконавців.</p>
        </div>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-full bg-amber-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-900 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none" href="/tasks/add">+ Стратегічна задача</Link>
      </div>

      {tasksResult.error ? <section className="mt-8 max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 px-6 py-8"><h2 className="text-lg font-semibold text-amber-950">Задачник потребує одного налаштування</h2><p className="mt-2 text-sm leading-6 text-amber-900">{tasksResult.error}</p></section> : <TaskHoshinKanri currentUserName={context.displayName} initialNodes={hoshin.nodes} initialPlans={hoshin.plans} setupError={hoshin.setupError} strategicTasks={strategicTasks} />}
    </section>
  );
}
