"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { taskAreaLabels, taskHorizonLabels, taskStatusLabels } from "@/lib/task-options";
import type { Task, TaskHoshinNode, TaskHoshinNodeLevel, TaskHoshinPlan } from "@/types/task";

type HoshinValues = Readonly<{
  action: string;
  metricName: string;
  metricTarget: string;
  ownerName: string;
  executorComment: string;
  proposedMetric: string;
}>;

type PlanRow = {
  task_id: string;
  action: string;
  metric_name: string;
  metric_target: string;
  owner_name: string;
  executor_comment: string;
  proposed_metric: string;
  proposal_author_name: string | null;
  proposal_updated_at: string | null;
  updated_at: string;
};

type NodeRow = PlanRow & {
  id: string;
  parent_id: string | null;
  level: string;
  title: string;
  created_at: string;
};

const emptyValues: HoshinValues = {
  action: "",
  metricName: "",
  metricTarget: "",
  ownerName: "",
  executorComment: "",
  proposedMetric: "",
};

function valuesFromPlan(plan: TaskHoshinPlan | undefined, fallbackOwner: string): HoshinValues {
  if (!plan) return { ...emptyValues, ownerName: fallbackOwner };
  return {
    action: plan.action,
    metricName: plan.metricName,
    metricTarget: plan.metricTarget,
    ownerName: plan.ownerName || fallbackOwner,
    executorComment: plan.executorComment,
    proposedMetric: plan.proposedMetric,
  };
}

function valuesFromNode(node: TaskHoshinNode, fallbackOwner: string): HoshinValues {
  return {
    action: node.action,
    metricName: node.metricName,
    metricTarget: node.metricTarget,
    ownerName: node.ownerName || fallbackOwner,
    executorComment: node.executorComment,
    proposedMetric: node.proposedMetric,
  };
}

function mapPlan(row: PlanRow): TaskHoshinPlan {
  return {
    taskId: row.task_id,
    action: row.action,
    metricName: row.metric_name,
    metricTarget: row.metric_target,
    ownerName: row.owner_name,
    executorComment: row.executor_comment,
    proposedMetric: row.proposed_metric,
    proposalAuthorName: row.proposal_author_name,
    proposalUpdatedAt: row.proposal_updated_at,
    updatedAt: row.updated_at,
  };
}

function mapNode(row: NodeRow): TaskHoshinNode | null {
  if (row.level !== "division" && row.level !== "department") return null;
  return {
    id: row.id,
    taskId: row.task_id,
    parentId: row.parent_id,
    level: row.level,
    title: row.title,
    action: row.action,
    metricName: row.metric_name,
    metricTarget: row.metric_target,
    ownerName: row.owner_name,
    executorComment: row.executor_comment,
    proposedMetric: row.proposed_metric,
    proposalAuthorName: row.proposal_author_name,
    proposalUpdatedAt: row.proposal_updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatSavedAt(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function ProposalMeta({ author, updatedAt }: Readonly<{ author: string | null; updatedAt: string | null }>) {
  const date = formatSavedAt(updatedAt);
  if (!author && !date) return <p className="mt-1 text-xs leading-5 text-stone-500">Після збереження тут буде видно, хто і коли оновив пропозицію.</p>;
  return <p className="mt-1 text-xs leading-5 text-stone-500">Останню пропозицію оновив(ла) {author ?? "учасник"}{date ? ` · ${date}` : ""}.</p>;
}

function MetricLine({ metricName, metricTarget }: Readonly<{ metricName: string; metricTarget: string }>) {
  if (!metricName && !metricTarget) return <p className="mt-2 text-xs text-stone-500">Метрику ще не визначено</p>;
  return <p className="mt-2 text-xs leading-5 text-stone-600"><span className="font-semibold text-stone-700">{metricName || "Метрика"}</span>{metricTarget ? `: ${metricTarget}` : ""}</p>;
}

function HoshinRelationshipMap({ nodes, plan, task }: Readonly<{
  nodes: readonly TaskHoshinNode[];
  plan: TaskHoshinPlan | undefined;
  task: Task;
}>) {
  const divisions = nodes.filter((node) => node.level === "division");
  const departmentsFor = (divisionId: string) => nodes.filter((node) => node.level === "department" && node.parentId === divisionId);
  const centralOwner = plan?.ownerName || task.createdByName;

  return (
    <section className="rounded-3xl border border-violet-200 bg-violet-50/50 p-4 shadow-sm sm:p-5" aria-labelledby="hoshin-map-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-violet-800 uppercase">Візуальна карта</p>
          <h2 className="mt-1 text-xl font-bold text-stone-950" id="hoshin-map-title">Взаємозв’язок цілі та відповідальних</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">Лінії показують, який підрозділ та відділ працює на центральну стратегічну ціль. Натисніть на блок, щоб перейти до його редагування.</p>
        </div>
        <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-bold text-violet-900">{divisions.length} підрозділів</span>
      </div>

      <div className="mt-5">
        <div className="mx-auto max-w-xl rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-center shadow-sm">
          <p className="text-[11px] font-bold tracking-[0.14em] text-amber-800 uppercase">Центральна ціль</p>
          <a className="mt-1 block font-bold text-stone-950 hover:text-amber-900 hover:underline" href={`#hoshin-central-${task.id}`}>{task.title}</a>
          <p className="mt-1 text-xs text-stone-600">Власник: {centralOwner || "не визначено"}</p>
          <MetricLine metricName={plan?.metricName ?? ""} metricTarget={plan?.metricTarget ?? ""} />
        </div>
        <div aria-hidden="true" className="mx-auto h-6 w-px bg-violet-300" />

        {divisions.length === 0 ? <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-violet-300 bg-white/80 px-4 py-5 text-center text-sm leading-6 text-stone-600">Додайте перший підрозділ нижче — він з’явиться на цій карті та буде пов’язаний із центральною ціллю.</div> : <><div aria-hidden="true" className="relative hidden h-5 md:block"><span className="absolute top-0 right-[12%] left-[12%] h-px bg-violet-300" /></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {divisions.map((division) => {
            const departments = departmentsFor(division.id);
            return <article className="relative rounded-2xl border border-sky-200 bg-white p-3 shadow-sm" key={division.id}>
              <div aria-hidden="true" className="absolute -top-4 left-1/2 h-4 w-px -translate-x-1/2 bg-violet-300 md:hidden" />
              <div aria-hidden="true" className="absolute -top-5 left-1/2 hidden h-5 w-px -translate-x-1/2 bg-violet-300 md:block" />
              <p className="text-[11px] font-bold tracking-[0.12em] text-sky-800 uppercase">Підрозділ</p>
              <a className="mt-1 block font-bold text-stone-950 hover:text-sky-800 hover:underline" href={`#hoshin-node-${division.id}`}>{division.title}</a>
              <p className="mt-1 text-xs text-stone-600">Власник: {division.ownerName || "не визначено"}</p>
              <MetricLine metricName={division.metricName} metricTarget={division.metricTarget} />
              <div className="mt-3 border-t border-sky-100 pt-3">
                <p className="text-[11px] font-bold tracking-[0.12em] text-stone-500 uppercase">Відділи · {departments.length}</p>
                {departments.length === 0 ? <p className="mt-2 text-xs text-stone-500">Поки не додано.</p> : <div className="mt-2 space-y-2">
                  {departments.map((department) => <a className="block rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm transition hover:border-violet-300 hover:bg-violet-50" href={`#hoshin-node-${department.id}`} key={department.id}>
                    <span className="font-semibold text-stone-900">{department.title}</span>
                    <span className="mt-1 block text-xs text-stone-600">{department.ownerName ? `Відповідальний: ${department.ownerName}` : "Відповідального ще не вказано"}</span>
                    {(department.metricName || department.metricTarget) ? <span className="mt-1 block text-xs text-stone-600">{department.metricName || "Метрика"}{department.metricTarget ? `: ${department.metricTarget}` : ""}</span> : null}
                  </a>)}
                </div>}
              </div>
            </article>;
          })}
        </div></>}
      </div>
    </section>
  );
}

function HoshinFields({ values, onChange, disabled }: Readonly<{
  values: HoshinValues;
  onChange: (field: keyof HoshinValues, value: string) => void;
  disabled: boolean;
}>) {
  const inputClassName = "mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-700 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-stone-100";
  const labelClassName = "block text-xs font-bold tracking-wide text-stone-700 uppercase";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className={labelClassName}>Що потрібно зробити</span>
        <textarea className={inputClassName} disabled={disabled} maxLength={5000} onChange={(event) => onChange("action", event.target.value)} placeholder="Конкретна дія або результат цього рівня" rows={3} value={values.action} />
      </label>
      <label>
        <span className={labelClassName}>Ключова метрика</span>
        <input className={inputClassName} disabled={disabled} maxLength={160} onChange={(event) => onChange("metricName", event.target.value)} placeholder="Наприклад, частка виконаних етапів" value={values.metricName} />
      </label>
      <label>
        <span className={labelClassName}>Ціль метрики</span>
        <input className={inputClassName} disabled={disabled} maxLength={160} onChange={(event) => onChange("metricTarget", event.target.value)} placeholder="Наприклад, 90 % до 30.06" value={values.metricTarget} />
      </label>
      <label className="sm:col-span-2">
        <span className={labelClassName}>Власник результату</span>
        <input className={inputClassName} disabled={disabled} maxLength={80} onChange={(event) => onChange("ownerName", event.target.value)} placeholder="Хто відповідає за результат" value={values.ownerName} />
      </label>
      <label className="sm:col-span-2 rounded-xl border border-sky-100 bg-sky-50/70 p-3">
        <span className={labelClassName}>Коментар виконавця · catchball</span>
        <textarea className={inputClassName} disabled={disabled} maxLength={5000} onChange={(event) => onChange("executorComment", event.target.value)} placeholder="Що треба уточнити, які є ризики, ресурси або пропозиції" rows={3} value={values.executorComment} />
      </label>
      <label className="sm:col-span-2 rounded-xl border border-sky-100 bg-sky-50/70 p-3">
        <span className={labelClassName}>Запропонована виконавцем метрика</span>
        <input className={inputClassName} disabled={disabled} maxLength={500} onChange={(event) => onChange("proposedMetric", event.target.value)} placeholder="Вимірюваний показник, який пропонує виконавець" value={values.proposedMetric} />
      </label>
    </div>
  );
}

function CentralPlanEditor({ currentUserName, disabled, onSaved, plan, task }: Readonly<{
  currentUserName: string;
  disabled: boolean;
  onSaved: (plan: TaskHoshinPlan) => void;
  plan: TaskHoshinPlan | undefined;
  task: Task;
}>) {
  const [values, setValues] = useState(() => valuesFromPlan(plan, task.createdByName));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setField(field: keyof HoshinValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const now = new Date().toISOString();
    const { data, error: saveError } = await createClient()
      .from("task_hoshin_plans")
      .upsert({
        task_id: task.id,
        action: values.action.trim(),
        metric_name: values.metricName.trim(),
        metric_target: values.metricTarget.trim(),
        owner_name: values.ownerName.trim(),
        executor_comment: values.executorComment.trim(),
        proposed_metric: values.proposedMetric.trim(),
        proposal_author_name: currentUserName,
        proposal_updated_at: now,
      }, { onConflict: "task_id" })
      .select("task_id, action, metric_name, metric_target, owner_name, executor_comment, proposed_metric, proposal_author_name, proposal_updated_at, updated_at")
      .single();
    setSaving(false);

    if (saveError || !data) {
      setError("Не вдалося зберегти центральний рівень. Перевірте налаштування Хошин Канрі у Supabase.");
      return;
    }
    onSaved(mapPlan(data as PlanRow));
  }

  return (
    <form className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5" id={`hoshin-central-${task.id}`} onSubmit={(event) => void save(event)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-amber-800 uppercase">F3 · Центральна стратегічна ціль</p>
          <h2 className="mt-1 text-xl font-bold text-stone-950">{task.title}</h2>
          {task.goal ? <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-700">{task.goal}</p> : <p className="mt-1 text-sm text-stone-600">Додайте кінцеву мету в картці стратегічної задачі, щоб команда бачила очікуваний результат.</p>}
        </div>
        <Link className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100" href={`/tasks/${task.id}`}>Відкрити задачу</Link>
      </div>
      <HoshinFields disabled={disabled || saving} onChange={setField} values={values} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="rounded-xl bg-amber-800 px-4 py-2 text-sm font-bold text-white hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-60" disabled={disabled || saving} type="submit">{saving ? "Збереження…" : "Зберегти центральний рівень"}</button>
        {error ? <p aria-live="assertive" className="text-sm font-medium text-red-700">{error}</p> : <ProposalMeta author={plan?.proposalAuthorName ?? null} updatedAt={plan?.proposalUpdatedAt ?? null} />}
      </div>
    </form>
  );
}

function NodeEditor({ currentUserName, disabled, node, onDeleted, onSaved }: Readonly<{
  currentUserName: string;
  disabled: boolean;
  node: TaskHoshinNode;
  onDeleted: (id: string) => void;
  onSaved: (node: TaskHoshinNode) => void;
}>) {
  const [values, setValues] = useState(() => valuesFromNode(node, currentUserName));
  const [title, setTitle] = useState(node.title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setField(field: keyof HoshinValues, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length < 2) {
      setError("Вкажіть назву щонайменше з двох символів.");
      return;
    }
    setSaving(true);
    setError("");
    const { data, error: saveError } = await createClient()
      .from("task_hoshin_nodes")
      .update({
        title: title.trim(),
        action: values.action.trim(),
        metric_name: values.metricName.trim(),
        metric_target: values.metricTarget.trim(),
        owner_name: values.ownerName.trim(),
        executor_comment: values.executorComment.trim(),
        proposed_metric: values.proposedMetric.trim(),
        proposal_author_name: currentUserName,
        proposal_updated_at: new Date().toISOString(),
      })
      .eq("id", node.id)
      .select("id, task_id, parent_id, level, title, action, metric_name, metric_target, owner_name, executor_comment, proposed_metric, proposal_author_name, proposal_updated_at, created_at, updated_at")
      .single();
    setSaving(false);
    if (saveError || !data) {
      setError("Не вдалося зберегти цей рівень. Спробуйте ще раз.");
      return;
    }
    const mapped = mapNode(data as NodeRow);
    if (mapped) onSaved(mapped);
  }

  async function remove() {
    if (!window.confirm(`${node.level === "division" ? "Підрозділ" : "Відділ"} буде видалено разом з усіма вкладеними рівнями. Продовжити?`)) return;
    setSaving(true);
    setError("");
    const { error: deleteError } = await createClient().from("task_hoshin_nodes").delete().eq("id", node.id);
    setSaving(false);
    if (deleteError) {
      setError("Не вдалося видалити рівень.");
      return;
    }
    onDeleted(node.id);
  }

  const levelLabel = node.level === "division" ? "F3 · Підрозділ" : "F3 · Відділ";
  return (
    <form className={`rounded-2xl border p-4 ${node.level === "division" ? "border-sky-200 bg-sky-50/60" : "border-stone-200 bg-white"}`} id={`hoshin-node-${node.id}`} onSubmit={(event) => void save(event)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <label className="min-w-0 flex-1">
          <span className="text-xs font-bold tracking-[0.14em] text-sky-800 uppercase">{levelLabel}</span>
          <input className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-base font-bold text-stone-950 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100 disabled:bg-stone-100" disabled={disabled || saving} maxLength={160} onChange={(event) => setTitle(event.target.value)} value={title} />
        </label>
        <button className="rounded-lg px-2.5 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled || saving} onClick={() => void remove()} type="button">Видалити</button>
      </div>
      <HoshinFields disabled={disabled || saving} onChange={setField} values={values} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-bold text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={disabled || saving} type="submit">{saving ? "Збереження…" : "Зберегти"}</button>
        {error ? <p aria-live="assertive" className="text-sm font-medium text-red-700">{error}</p> : <ProposalMeta author={node.proposalAuthorName} updatedAt={node.proposalUpdatedAt} />}
      </div>
    </form>
  );
}

function NodeCreateForm({ currentUserName, disabled, level, parentId, taskId, onCreated }: Readonly<{
  currentUserName: string;
  disabled: boolean;
  level: TaskHoshinNodeLevel;
  parentId: string | null;
  taskId: string;
  onCreated: (node: TaskHoshinNode) => void;
}>) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const label = level === "division" ? "підрозділ" : "відділ";

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length < 2) {
      setError(`Вкажіть назву ${label}у щонайменше з двох символів.`);
      return;
    }
    setSaving(true);
    setError("");
    const { data, error: createError } = await createClient()
      .from("task_hoshin_nodes")
      .insert({ task_id: taskId, parent_id: parentId, level, title: title.trim(), owner_name: currentUserName })
      .select("id, task_id, parent_id, level, title, action, metric_name, metric_target, owner_name, executor_comment, proposed_metric, proposal_author_name, proposal_updated_at, created_at, updated_at")
      .single();
    setSaving(false);
    if (createError || !data) {
      setError(`Не вдалося додати ${label}. Перевірте налаштування Хошин Канрі.`);
      return;
    }
    const mapped = mapNode(data as NodeRow);
    if (!mapped) {
      setError("Не вдалося прочитати створений рівень.");
      return;
    }
    setTitle("");
    onCreated(mapped);
  }

  return (
    <form className="flex flex-col gap-2 rounded-xl border border-dashed border-stone-300 bg-white/70 p-3 sm:flex-row sm:items-start" onSubmit={(event) => void create(event)}>
      <label className="min-w-0 flex-1">
        <span className="sr-only">Назва {label}у</span>
        <input className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none placeholder:text-stone-400 focus:border-amber-700 focus:ring-2 focus:ring-amber-100 disabled:bg-stone-100" disabled={disabled || saving} maxLength={160} onChange={(event) => setTitle(event.target.value)} placeholder={`Назва ${label}у`} value={title} />
      </label>
      <button className="rounded-lg border border-amber-800 px-3 py-2 text-sm font-bold text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled || saving} type="submit">{saving ? "Додаю…" : `+ ${level === "division" ? "Підрозділ" : "Відділ"}`}</button>
      {error ? <p aria-live="assertive" className="basis-full text-xs font-medium text-red-700">{error}</p> : null}
    </form>
  );
}

function DivisionTree({ currentUserName, departments, disabled, division, onCreated, onDeleted, onSaved }: Readonly<{
  currentUserName: string;
  departments: readonly TaskHoshinNode[];
  disabled: boolean;
  division: TaskHoshinNode;
  onCreated: (node: TaskHoshinNode) => void;
  onDeleted: (id: string) => void;
  onSaved: (node: TaskHoshinNode) => void;
}>) {
  return (
    <article className="rounded-3xl border border-sky-200 bg-sky-50/40 p-3 sm:p-4">
      <NodeEditor currentUserName={currentUserName} disabled={disabled} key={division.id} node={division} onDeleted={onDeleted} onSaved={onSaved} />
      <div className="mt-4 border-l-2 border-sky-200 pl-3 sm:pl-5">
        <div className="mb-3 flex items-center gap-2"><span className="text-sm font-bold text-stone-900">Відділи</span><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-stone-600">{departments.length}</span></div>
        <div className="space-y-3">
          {departments.map((department) => <NodeEditor currentUserName={currentUserName} disabled={disabled} key={department.id} node={department} onDeleted={onDeleted} onSaved={onSaved} />)}
          <NodeCreateForm currentUserName={currentUserName} disabled={disabled} level="department" onCreated={onCreated} parentId={division.id} taskId={division.taskId} />
        </div>
      </div>
    </article>
  );
}

export function TaskHoshinKanri({ currentUserName, initialNodes, initialPlans, setupError, strategicTasks }: Readonly<{
  currentUserName: string;
  initialNodes: readonly TaskHoshinNode[];
  initialPlans: readonly TaskHoshinPlan[];
  setupError: string | null;
  strategicTasks: readonly Task[];
}>) {
  const orderedTasks = useMemo(() => [...strategicTasks].sort((first, second) => first.title.localeCompare(second.title, "uk")), [strategicTasks]);
  const [selectedTaskId, setSelectedTaskId] = useState(orderedTasks[0]?.id ?? "");
  const [plans, setPlans] = useState<readonly TaskHoshinPlan[]>(initialPlans);
  const [nodes, setNodes] = useState<readonly TaskHoshinNode[]>(initialNodes);
  const selectedTask = orderedTasks.find((task) => task.id === selectedTaskId) ?? null;
  const selectedPlan = plans.find((plan) => plan.taskId === selectedTaskId);
  const selectedNodes = nodes.filter((node) => node.taskId === selectedTaskId);
  const divisions = selectedNodes.filter((node) => node.level === "division");
  const disabled = setupError !== null;

  function replacePlan(nextPlan: TaskHoshinPlan) {
    setPlans((previous) => [...previous.filter((plan) => plan.taskId !== nextPlan.taskId), nextPlan]);
  }

  function replaceNode(nextNode: TaskHoshinNode) {
    setNodes((previous) => [...previous.filter((node) => node.id !== nextNode.id), nextNode]);
  }

  function removeNode(id: string) {
    setNodes((previous) => {
      const idsToRemove = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        previous.forEach((node) => {
          if (node.parentId && idsToRemove.has(node.parentId) && !idsToRemove.has(node.id)) {
            idsToRemove.add(node.id);
            changed = true;
          }
        });
      }
      return previous.filter((node) => !idsToRemove.has(node.id));
    });
  }

  if (orderedTasks.length === 0) {
    return <section className="mt-8 rounded-3xl border border-stone-200 bg-white px-6 py-8 shadow-sm"><h2 className="text-xl font-bold text-stone-950">Поки немає стратегічних задач</h2><p className="mt-2 max-w-2xl leading-7 text-stone-600">Блок Хошин Канрі працює лише зі стратегічними задачами. Спершу створіть стратегічну задачу або змініть рівень планування існуючої.</p><Link className="mt-5 inline-flex rounded-xl bg-amber-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-900" href="/tasks/add">+ Стратегічна задача</Link></section>;
  }

  return (
    <div className="mt-8 space-y-6">
      {setupError ? <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4"><h2 className="font-bold text-amber-950">Потрібне одноразове підключення</h2><p className="mt-1 text-sm leading-6 text-amber-900">{setupError}</p></section> : null}

      <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-bold text-stone-950">Оберіть центральну стратегічну ціль</h2><p className="mt-1 text-sm text-stone-600">Для кожної стратегічної задачі ведеться окремий каскад.</p></div>
          <label className="min-w-0 sm:w-96"><span className="sr-only">Стратегічна задача</span><select className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-semibold text-stone-900 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100" onChange={(event) => setSelectedTaskId(event.target.value)} value={selectedTaskId}>{orderedTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
        </div>
      </section>

      {selectedTask ? <>
        <HoshinRelationshipMap nodes={selectedNodes} plan={selectedPlan} task={selectedTask} />
        <CentralPlanEditor currentUserName={currentUserName} disabled={disabled} key={selectedTask.id} onSaved={replacePlan} plan={selectedPlan} task={selectedTask} />
        <section className="rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.14em] text-stone-500 uppercase">Каскад цілі</p><h2 className="mt-1 text-xl font-bold text-stone-950">Підрозділи й відділи</h2><p className="mt-1 text-sm leading-6 text-stone-600">Кожний рівень отримує дію, метрику та відповідь виконавця. Це допомагає погодити план до початку виконання.</p></div><span className="rounded-full bg-stone-100 px-3 py-1.5 text-sm font-bold text-stone-700">{divisions.length} підрозд.</span></div>
          <div className="space-y-4">
            {divisions.map((division) => <DivisionTree currentUserName={currentUserName} departments={selectedNodes.filter((node) => node.level === "department" && node.parentId === division.id)} disabled={disabled} division={division} key={division.id} onCreated={replaceNode} onDeleted={removeNode} onSaved={replaceNode} />)}
            <NodeCreateForm currentUserName={currentUserName} disabled={disabled} level="division" onCreated={replaceNode} parentId={null} taskId={selectedTask.id} />
          </div>
        </section>

        <section className="grid gap-3 rounded-2xl border border-stone-200 bg-stone-100 p-4 text-sm leading-6 text-stone-700 sm:grid-cols-3"><div><p className="font-bold text-stone-950">Стратегічна задача</p><p>{taskHorizonLabels[selectedTask.horizon]} · {taskAreaLabels[selectedTask.area]}</p></div><div><p className="font-bold text-stone-950">Контекст</p><p>{selectedTask.projectName ? `Проєкт: ${selectedTask.projectName}` : `Простір: ${selectedTask.scopeName}`}</p></div><div><p className="font-bold text-stone-950">Стан задачі</p><p>{taskStatusLabels[selectedTask.status]}</p></div></section>
      </> : null}
    </div>
  );
}
