import Link from "next/link";
import { notFound } from "next/navigation";

import { TaskChecklist } from "@/components/task-checklist";
import { TaskComments } from "@/components/task-comments";
import { TaskDetailStatus } from "@/components/task-detail-status";
import { TaskEditor } from "@/components/task-editor";
import { TaskParticipantsEditor } from "@/components/task-participants-editor";
import { getTaskUserContext } from "@/lib/task-access";
import { formatTaskDate, taskAreaLabels, taskHorizonLabels, taskStatusLabels } from "@/lib/task-options";
import { isLocalTestMode } from "@/lib/test-mode";
import { getTaskDetail, getTaskFormContext } from "@/lib/tasks";

function formatTaskTimestamp(value: string) {
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Kyiv" }).format(new Date(value));
}

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

  const [member, result, formContext] = await Promise.all([getTaskUserContext(), getTaskDetail(taskId), getTaskFormContext()]);

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
  const taskSpace = formContext.spaces.find((space) => space.kind === task.scopeKind && space.id === task.scopeId);
  const hasCreatedEvent = result.activityEvents.some((event) => event.eventType === "created");
  const hasCompletedEvent = result.activityEvents.some((event) => event.nextStatus === "completed");
  const hasRejectedEvent = result.activityEvents.some((event) => event.nextStatus === "rejected");
  const activity = [
    ...(!hasCreatedEvent ? [{ date: task.createdAt, label: "Створено", text: `${task.createdByName} створив(-ла) задачу.` }] : []),
    ...result.activityEvents.map((event) => event.eventType === "created"
      ? { date: event.occurredAt, label: "Створено", text: `${event.actorName} створив(-ла) задачу.` }
      : { date: event.occurredAt, label: "Змінено стан", text: `${event.actorName} змінив(-ла) стан: «${taskStatusLabels[event.previousStatus ?? "active"]}» → «${taskStatusLabels[event.nextStatus]}».` }),
    ...(!hasCompletedEvent && task.completedAt && task.completedBy ? [{ date: task.completedAt, label: "Виконано", text: `${task.completedBy} позначив(-ла) задачу виконаною.` }] : []),
    ...(!hasRejectedEvent && task.rejectedAt && task.rejectedBy ? [{ date: task.rejectedAt, label: "Відхилено", text: `${task.rejectedBy} відхилив(-ла) задачу.` }] : []),
  ].sort((left, right) => left.date.localeCompare(right.date));

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
          <div><dt className="text-stone-500">План</dt><dd className="mt-1 font-semibold text-stone-800">{task.plannedStartDate ? formatTaskDate(task.plannedStartDate) : "Старт не встановлено"} — {task.dueDate ? formatTaskDate(task.dueDate) : "завершення не встановлено"}</dd></div>
          {task.actualStartedAt ? <div><dt className="text-stone-500">Фактичний старт</dt><dd className="mt-1 font-semibold text-stone-800">{formatTaskTimestamp(task.actualStartedAt)}</dd></div> : null}
          {task.projectName ? <div><dt className="text-stone-500">Постійний простір</dt><dd className="mt-1 font-semibold text-stone-800">{task.scopeName}</dd></div> : null}
          <div className="sm:col-span-2"><dt className="text-stone-500">Учасники</dt><dd className="mt-1 font-semibold text-stone-800">{[task.createdByName, ...task.participants.map((participant) => participant.name)].join(", ")}</dd></div>
        </dl>
        <section className="mt-7 border-t border-stone-100 pt-5" aria-labelledby="task-activity-heading">
          <h2 className="text-base font-semibold text-stone-950" id="task-activity-heading">Історія задачі</h2>
          <ol className="mt-3 space-y-3">
            {activity.map((entry) => <li className="flex gap-3 text-sm leading-5" key={`${entry.label}-${entry.date}`}><span className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-700" /><div><p className="font-semibold text-stone-800">{entry.label}</p><p className="text-stone-600">{entry.text}</p><time className="text-xs text-stone-500" dateTime={entry.date}>{formatTaskTimestamp(entry.date)}</time></div></li>)}
            {task.status === "postponed" && task.postponedUntil ? <li className="flex gap-3 text-sm leading-5"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-amber-400" /><div><p className="font-semibold text-stone-800">Відкладено</p><p className="text-stone-600">Задача відкладена до {formatTaskDate(task.postponedUntil)}.</p></div></li> : null}
          </ol>
          {result.activityError ? <p className="mt-4 rounded-xl bg-stone-100 px-3 py-2 text-xs leading-5 text-stone-600">{result.activityError}</p> : null}
        </section>
        <TaskEditor task={task} />
        <TaskParticipantsEditor availableMembers={taskSpace?.members ?? []} createdByName={task.createdByName} initialParticipants={task.participants} setupError={formContext.error} taskId={task.id} />
        <TaskDetailStatus actualStartedAt={task.actualStartedAt} memberName={member.displayName} postponedUntil={task.postponedUntil} status={task.status} taskId={task.id} />
      </div>
      <TaskChecklist
        currentUserId={member.userId}
        currentUserName={member.displayName}
        initialItems={result.checklistItems}
        setupError={result.checklistError}
        taskId={task.id}
      />
      <TaskComments currentUserName={member.displayName} initialComments={result.comments} setupError={result.commentsError} taskId={task.id} />
      {result.error ? <p className="mt-6 max-w-3xl rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900" role="status">{result.error}</p> : null}
      <p className="mt-8 max-w-3xl rounded-2xl bg-stone-100 px-4 py-3 text-sm leading-6 text-stone-600">Вкладення та архів ще не входять до стартової версії Задачника.</p>
      <p className="sr-only">Поточний користувач: {member.displayName}</p>
    </section>
  );
}
