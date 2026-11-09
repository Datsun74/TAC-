import Link from "next/link";

import { TaskDailyPlanBoard } from "@/components/task-daily-plan-board";
import { getTaskUserContext } from "@/lib/task-access";
import { isLocalTestMode } from "@/lib/test-mode";
import { getDailyPlanSetupError, getTasks } from "@/lib/tasks";

export default async function TasksTodayPage() {
  const testMode = isLocalTestMode();
  const member = await getTaskUserContext();
  const [result, dailyPlanSetupError] = testMode
    ? [null, null]
    : await Promise.all([getTasks(["active", "in_work", "in_progress", "completed"]), getDailyPlanSetupError()]);

  return (
    <section className="w-full py-10 sm:py-14 lg:py-16">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">Щоденний огляд</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">Сьогодні</h1>
          <p className="mt-3 max-w-2xl leading-7 text-stone-600">Розкладіть задачі «У процесі» на сьогодні і завтра по годинах. Основний Канбан та Гант при цьому не змінюються.</p>
        </div>
        <Link className="inline-flex min-h-11 items-center justify-center rounded-full bg-amber-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-900 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none" href="/tasks/add">+ Нова задача</Link>
      </div>

      {result?.error || dailyPlanSetupError ? (
        <section className="mt-8 max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 px-6 py-8">
          <h2 className="text-lg font-semibold text-amber-950">Задачник потребує одного налаштування</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900">{result?.error ?? dailyPlanSetupError}</p>
        </section>
      ) : <TaskDailyPlanBoard memberName={member.displayName} tasks={result?.tasks ?? []} testMode={testMode} />}
    </section>
  );
}
