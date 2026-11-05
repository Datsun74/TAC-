import Link from "next/link";
import { notFound } from "next/navigation";

import { TaskChecklist } from "@/components/task-checklist";
import { TaskEditor } from "@/components/task-editor";
import { getTaskUserContext } from "@/lib/task-access";
import { formatTaskDate, taskAreaLabels, taskHorizonLabels, taskStatusLabels } from "@/lib/task-options";
import { isLocalTestMode } from "@/lib/test-mode";
import { getTaskDetail } from "@/lib/tasks";

export default async function TaskDetailPage(props: PageProps<"/tasks/[taskId]">) {
  const { taskId } = await props.params;

  if (isLocalTestMode()) {
    return (
      <section className="w-full py-10 sm:py-14 lg:py-16">
        <p className="text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">Тестовий режим</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">Картка задачі</h1>
        <p className="mt-3 max-w-2xl leading-7 text-stone-600">Деталі задачі будуть доступні після підключення робочого простору.</p>
        <Link className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-amber-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-900" href="/tasks/list">Повернутися до задач</Link>
      </section>
    );
  }

  const [member, result] = await Promise.all([getTaskUserContext(), getTaskDetail(taskId)]);

  if (!result.task) {
    if (result.error) {
      return (
        <section className="w-full py-10 sm:py-14 lg:py-16">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Не вдалося відкрити задачу</h1>
          <p className="mt-3 max-w-2xl leading-7 text-stone-600">{result.error}</p>
          <Link className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full border border-stone-300 px-5 py-2.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50" href="/tasks/list">До всіх задач</Link>
        </section>
      );
    }

    notFound();
  }

  const task = result.task;

  return (
    <section className="w-full py-10 sm:py-14 lg:py-16">
      <Link className="text-sm font-semibold text-amber-800 underline-offset-4 hover:underline" href="/tasks/list">← Усі задачі</Link>
      <div className="mt-6 max-w-3xl rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-950">{taskAreaLabels[task.area]}</span>
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-700">{taskHorizonLabels[task.horizon]}</span>
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-700">{taskStatusLabels[task.status]}</span>
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-700">{task.projectName ? `Проєкт: ${task.projectName}` : `Простір: ${task.scopeName}`}</span>
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">{task.title}</h1>
        {task.goal ? <p className="mt-5 whitespace-pre-wrap leading-7 text-stone-700">{task.goal}</p> : <p className="mt-5 text-stone-500">Кінцеву мету не вказано.</p>}
        <dl className="mt-7 grid gap-5 border-t border-stone-100 pt-5 text-sm sm:grid-cols-2">
          <div><dt className="text-stone-500">Створив</dt><dd className="mt-1 font-semibold text-stone-800">{task.createdByName}</dd></div>
          <div><dt className="text-stone-500">Строк</dt><dd className="mt-1 font-semibold text-stone-800">{task.dueDate ? formatTaskDate(task.dueDate) : "Не встановлено"}</dd></div>
          {task.projectName ? <div><dt className="text-stone-500">Постійний простір</dt><dd className="mt-1 font-semibold text-stone-800">{task.scopeName}</dd></div> : null}
          <div className="sm:col-span-2"><dt className="text-stone-500">Учасники</dt><dd className="mt-1 font-semibold text-stone-800">{task.participants.length > 0 ? task.participants.map((participant) => participant.name).join(", ") : "Особиста задача"}</dd></div>
        </dl>
        <TaskEditor task={task} />
      </div>
      <TaskChecklist
        currentUserId={member.userId}
        currentUserName={member.displayName}
        initialItems={result.checklistItems}
        setupError={result.checklistError}
        taskId={task.id}
      />
      {result.error ? <p className="mt-6 max-w-3xl rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900" role="status">{result.error}</p> : null}
      <p className="mt-8 max-w-3xl rounded-2xl bg-stone-100 px-4 py-3 text-sm leading-6 text-stone-600">Вкладення та архів ще не входять до стартової версії Задачника.</p>
      <p className="sr-only">Поточний користувач: {member.displayName}</p>
    </section>
  );
}
