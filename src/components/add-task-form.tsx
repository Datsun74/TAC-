"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import { readLocalTestTasks, writeLocalTestTasks } from "@/lib/local-test-tasks";
import { taskAreaOptions, taskHorizonOptions } from "@/lib/task-options";
import { createClient } from "@/lib/supabase/client";
import type { Task, TaskArea, TaskHorizon, TaskMember, TaskProject, TaskSpace } from "@/types/task";

type ContainerKind = "space" | "project";

type FormValues = {
  title: string;
  goal: string;
  area: TaskArea;
  horizon: TaskHorizon;
  dueDate: string;
  containerKind: ContainerKind;
  spaceId: string;
  projectId: string;
  participantIds: string[];
};

type FormErrors = Partial<Pick<FormValues, "title" | "goal">>;
type DatabaseError = Readonly<{ code?: string; message?: string }>;

type AddTaskFormProps = Readonly<{
  currentMember: TaskMember;
  spaces: readonly TaskSpace[];
  projects: readonly TaskProject[];
  projectsSetupError: string | null;
  testMode: boolean;
}>;

const initialValues: FormValues = {
  title: "", goal: "", area: "family", horizon: "tactical", dueDate: "", containerKind: "space", spaceId: "", projectId: "", participantIds: [],
};

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (values.title.trim().length < 2) errors.title = "Опишіть задачу щонайменше двома символами.";
  if (values.goal.trim().length > 5000) errors.goal = "Кінцева мета має містити не більш як 5 000 символів.";
  return errors;
}

function saveErrorMessage(error: DatabaseError | null, isProjectTask: boolean) {
  if (error?.code === "PGRST202" || error?.code === "42883") {
    return isProjectTask
      ? "Для задач у проєктах виконайте файл supabase/task-projects.sql у Supabase SQL Editor, а потім повторіть спробу."
      : "Для збереження задач виконайте файл supabase/task-create-reliability.sql у Supabase SQL Editor, а потім повторіть спробу.";
  }
  if (error?.code === "42501") return "Supabase не підтвердив право на створення задачі. Оновіть сторінку, увійдіть знову й повторіть спробу.";
  if (error?.code === "23514" || error?.code === "23502") return "Не вдалося зберегти дані задачі. Перевірте назву, напрям, рівень планування та вибраний простір або проєкт.";
  return "Не вдалося зберегти задачу. Спробуйте ще раз після оновлення сторінки.";
}

const fieldClass = "mt-3 min-h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100";

export function AddTaskForm({ currentMember, spaces, projects, projectsSetupError, testMode }: AddTaskFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");

  const activeProjects = useMemo(() => projects.filter((project) => project.status === "active"), [projects]);
  const selectedProject = activeProjects.find((project) => project.id === values.projectId) ?? activeProjects[0] ?? null;
  const selectedSpace = values.containerKind === "project"
    ? (selectedProject ? spaces.find((space) => space.kind === selectedProject.scopeKind && space.id === selectedProject.scopeId) ?? null : null)
    : spaces.find((space) => space.id === values.spaceId) ?? spaces[0] ?? null;
  const availableParticipants = selectedSpace?.members.filter((member) => member.id !== currentMember.id) ?? [];

  function updateValue<Field extends Exclude<keyof FormValues, "participantIds">>(field: Field, value: FormValues[Field]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmissionError("");
  }

  function updateContainerKind(containerKind: ContainerKind) {
    setValues((current) => ({ ...current, containerKind, participantIds: [] }));
    setSubmissionError("");
  }

  function updateSpace(spaceId: string) {
    const space = spaces.find((item) => item.id === spaceId);
    setValues((current) => ({ ...current, spaceId, participantIds: [], area: space?.kind === "workspace" ? "work" : current.area }));
    setSubmissionError("");
  }

  function updateProject(projectId: string) {
    const project = activeProjects.find((item) => item.id === projectId);
    setValues((current) => ({ ...current, projectId, participantIds: [], area: project?.scopeKind === "workspace" ? "work" : current.area }));
    setSubmissionError("");
  }

  function toggleParticipant(memberId: string) {
    setValues((current) => ({
      ...current,
      participantIds: current.participantIds.includes(memberId) ? current.participantIds.filter((id) => id !== memberId) : [...current.participantIds, memberId],
    }));
    setSubmissionError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (!selectedSpace) {
      setSubmissionError(values.containerKind === "project" ? "Виберіть активний проєкт або створіть його на сторінці «Проєкти»." : "Спершу створіть або приєднайтеся до сімейного чи робочого простору.");
      return;
    }

    const selectedParticipants = selectedSpace.members.filter((member) => values.participantIds.includes(member.id));
    const task: Task = {
      id: window.crypto.randomUUID(), title: values.title.trim(), goal: values.goal.trim() || null, area: values.area, horizon: values.horizon, dueDate: values.dueDate || null,
      status: "active", postponedUntil: null, createdByName: currentMember.name, createdAt: new Date().toISOString(), completedBy: null, completedAt: null, rejectedBy: null, rejectedAt: null,
      participants: selectedParticipants, scopeKind: selectedSpace.kind, scopeId: selectedSpace.id, scopeName: selectedSpace.name,
      projectId: values.containerKind === "project" ? selectedProject?.id ?? null : null,
      projectName: values.containerKind === "project" ? selectedProject?.name ?? null : null,
    };

    setIsSubmitting(true);
    setSubmissionError("");
    if (testMode) {
      writeLocalTestTasks([task, ...readLocalTestTasks()]);
      router.push("/tasks/list");
      return;
    }

    const supabase = createClient();
    const { data: createdTaskId, error } = selectedProject && values.containerKind === "project"
      ? await supabase.rpc("create_project_task_with_participants", {
        target_project_id: selectedProject.id, task_title: task.title, task_goal: task.goal, task_area: task.area, task_horizon: task.horizon,
        task_due_date: task.dueDate, creator_display_name: currentMember.name, participant_user_ids: selectedParticipants.map((member) => member.id),
      })
      : await supabase.rpc("create_task_with_participants", {
        target_family_id: selectedSpace.kind === "family" ? selectedSpace.id : null, target_workspace_id: selectedSpace.kind === "workspace" ? selectedSpace.id : null,
        task_title: task.title, task_goal: task.goal, task_area: task.area, task_horizon: task.horizon, task_due_date: task.dueDate,
        creator_display_name: currentMember.name, participant_user_ids: selectedParticipants.map((member) => member.id),
      });

    if (error) {
      setSubmissionError(saveErrorMessage(error, values.containerKind === "project"));
      setIsSubmitting(false);
      return;
    }
    if (typeof createdTaskId === "string") {
      await supabase.from("task_activity_events").insert({
        task_id: createdTaskId,
        event_type: "created",
        actor_name: currentMember.name,
        previous_status: null,
        next_status: "active",
      });
    }
    router.push("/tasks/list");
    router.refresh();
  }

  return (
    <form className="mt-8 max-w-3xl rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8" noValidate onSubmit={handleSubmit}>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-stone-900" htmlFor="task-title">Суть задачі</label>
          <p className="mt-1 text-sm text-stone-500" id="task-title-hint">Наприклад, «Прибрати подвір’я» або «Підготувати кошторис ремонту».</p>
          <input aria-describedby="task-title-hint task-title-error" aria-invalid={Boolean(errors.title)} autoComplete="off" className={fieldClass} id="task-title" onChange={(event) => updateValue("title", event.target.value)} placeholder="Що потрібно зробити?" value={values.title} />
          {errors.title ? <p className="mt-2 text-sm font-medium text-red-700" id="task-title-error" role="alert">{errors.title}</p> : null}
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-900" htmlFor="task-goal">Кінцева мета <span className="font-normal text-stone-500">(необов’язково)</span></label>
          <textarea aria-describedby="task-goal-error" aria-invalid={Boolean(errors.goal)} className="mt-3 min-h-28 w-full resize-y rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-950 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100" id="task-goal" onChange={(event) => updateValue("goal", event.target.value)} placeholder="Який результат має бути після виконання?" rows={4} value={values.goal} />
          {errors.goal ? <p className="mt-2 text-sm font-medium text-red-700" id="task-goal-error" role="alert">{errors.goal}</p> : null}
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-stone-900">Де ведемо задачу</legend>
          <p className="mt-1 text-sm leading-6 text-stone-500">Вибирається або постійний простір, або тимчасовий проєкт усередині простору.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className={`flex min-h-12 items-center gap-3 rounded-2xl border px-4 text-sm font-semibold ${values.containerKind === "space" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-stone-200 text-stone-700"}`}><input checked={values.containerKind === "space"} className="size-4 accent-amber-800" name="task-container" onChange={() => updateContainerKind("space")} type="radio" />Простір</label>
            <label className={`flex min-h-12 items-center gap-3 rounded-2xl border px-4 text-sm font-semibold ${values.containerKind === "project" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-stone-200 text-stone-700"}`}><input checked={values.containerKind === "project"} className="size-4 accent-amber-800" disabled={activeProjects.length === 0} name="task-container" onChange={() => updateContainerKind("project")} type="radio" />Проєкт</label>
          </div>
          {values.containerKind === "space" ? (
            <div className="mt-4">
              <label className="block text-sm font-semibold text-stone-900" htmlFor="task-space">Простір задачі</label>
              {spaces.length > 0 ? <><select className={fieldClass} id="task-space" onChange={(event) => updateSpace(event.target.value)} value={selectedSpace?.id ?? ""}>{spaces.map((space) => <option key={space.kind + space.id} value={space.id}>{space.kind === "workspace" ? "Робота: " : "Сім’я: "}{space.name}</option>)}</select><p className="mt-1 text-sm text-stone-500">Учасників можна обирати лише з цього простору.</p></> : <p className="mt-3 rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-600">Немає доступного простору. Створіть робочий простір або приєднайтесь за кодом.</p>}
            </div>
          ) : (
            <div className="mt-4">
              <label className="block text-sm font-semibold text-stone-900" htmlFor="task-project">Проєкт</label>
              {activeProjects.length > 0 ? <><select className={fieldClass} id="task-project" onChange={(event) => updateProject(event.target.value)} value={selectedProject?.id ?? ""}>{activeProjects.map((project) => <option key={project.id} value={project.id}>{project.name} — {project.scopeName}</option>)}</select><p className="mt-1 text-sm text-stone-500">Простір «{selectedProject?.scopeName ?? "…"}» підставлено автоматично: учасники й доступ беруться з нього.</p></> : <p className="mt-3 rounded-2xl bg-stone-100 px-4 py-3 text-sm leading-6 text-stone-600">{projectsSetupError ?? "Активних проєктів поки немає. Створіть проєкт на сторінці «Проєкти»."}</p>}
            </div>
          )}
        </fieldset>

        <div className="grid gap-6 sm:grid-cols-2">
          <div><label className="block text-sm font-semibold text-stone-900" htmlFor="task-area">Напрям</label><select className={fieldClass} id="task-area" onChange={(event) => updateValue("area", event.target.value as TaskArea)} value={values.area}>{taskAreaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          <div><label className="block text-sm font-semibold text-stone-900" htmlFor="task-horizon">Рівень планування</label><select className={fieldClass} id="task-horizon" onChange={(event) => updateValue("horizon", event.target.value as TaskHorizon)} value={values.horizon}>{taskHorizonOptions.map((option) => <option key={option.value} value={option.value}>{option.label} — {option.hint}</option>)}</select></div>
        </div>

        <div className="max-w-sm"><label className="block text-sm font-semibold text-stone-900" htmlFor="task-due-date">Бажана дата</label><input className={fieldClass} id="task-due-date" onChange={(event) => updateValue("dueDate", event.target.value)} type="date" value={values.dueDate} /><p className="mt-1 text-sm text-stone-500">Згодом цю дату можна буде синхронізувати з календарем.</p></div>

        <fieldset>
          <legend className="text-sm font-semibold text-stone-900">Учасники</legend>
          <p className="mt-1 text-sm text-stone-500">Ви вже є автором і першим учасником. За потреби додайте тих, хто має бачити та виконувати задачу разом з вами.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-950"><input checked className="size-4 accent-amber-800" disabled readOnly type="checkbox" /><span>{currentMember.name} <span className="font-normal text-amber-900">— ви, автор</span></span></label>
            {availableParticipants.map((member) => <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-stone-200 px-4 text-sm font-medium text-stone-800" key={member.id}><input checked={values.participantIds.includes(member.id)} className="size-4 accent-amber-800" onChange={() => toggleParticipant(member.id)} type="checkbox" />{member.name}</label>)}
          </div>
          {availableParticipants.length === 0 ? <p className="mt-3 text-sm text-stone-500">Інших активних учасників у вибраному просторі поки немає. Задача буде особистою.</p> : null}
        </fieldset>
      </div>
      {submissionError ? <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900" role="alert">{submissionError}</p> : null}
      <button className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-amber-800 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-amber-900 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60 sm:w-auto" disabled={isSubmitting} type="submit">{isSubmitting ? "Зберігаємо…" : "Створити задачу"}</button>
    </form>
  );
}
