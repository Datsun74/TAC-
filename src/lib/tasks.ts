import "server-only";

import { getTaskUserContext } from "@/lib/task-access";
import { createClient } from "@/lib/supabase/server";
import { isLocalTestMode } from "@/lib/test-mode";
import { isTaskHorizon, isTaskProjectStatus, isTaskStatus, type Task, type TaskActivityEvent, type TaskAttachment, type TaskChecklistItem, type TaskMember, type TaskParticipant, type TaskProject, type TaskScopeKind, type TaskSpace, type TaskStatus } from "@/types/task";

type NameRelation = { name: string } | { name: string }[] | null;

type TaskRow = {
  id: string;
  title: string;
  goal: string | null;
  area: Task["area"];
  horizon: Task["horizon"];
  due_date: string | null;
  status: TaskStatus;
  postponed_until: string | null;
  created_by_name: string;
  created_at: string;
  completed_by: string | null;
  completed_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  family_id: string | null;
  workspace_id: string | null;
  project_id?: string | null;
  families: NameRelation;
  task_workspaces: NameRelation;
  task_projects?: NameRelation;
  task_participants: Array<{
    member_user_id: string;
    member_name: string;
  }> | null;
};

type TaskProjectRow = {
  id: string;
  name: string;
  horizon: string;
  status: string;
  family_id: string | null;
  workspace_id: string | null;
  created_by_name: string;
  created_at: string;
  closed_at: string | null;
};

export type TasksResult = Readonly<{
  tasks: Task[];
  error: string | null;
}>;

export type TaskDetailResult = Readonly<{
  task: Task | null;
  checklistItems: TaskChecklistItem[];
  checklistError: string | null;
  activityEvents: TaskActivityEvent[];
  activityError: string | null;
  attachments: TaskAttachment[];
  error: string | null;
}>;

function relationName(value: NameRelation, fallback: string) {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation?.name ?? fallback;
}

function scopeKind(row: TaskRow): TaskScopeKind {
  return row.workspace_id ? "workspace" : "family";
}

function mapTask(row: TaskRow): Task {
  const participants: TaskParticipant[] = (row.task_participants ?? []).map((participant) => ({
    id: participant.member_user_id,
    name: participant.member_name,
  }));
  const kind = scopeKind(row);

  return {
    id: row.id,
    title: row.title,
    goal: row.goal,
    area: row.area,
    horizon: row.horizon,
    dueDate: row.due_date,
    status: row.status,
    postponedUntil: row.postponed_until,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    completedBy: row.completed_by,
    completedAt: row.completed_at,
    rejectedBy: row.rejected_by,
    rejectedAt: row.rejected_at,
    participants,
    scopeKind: kind,
    scopeId: kind === "workspace" ? row.workspace_id ?? "" : row.family_id ?? "",
    scopeName: kind === "workspace" ? relationName(row.task_workspaces, "Робочий простір") : relationName(row.families, "Сім’я"),
    projectId: row.project_id ?? null,
    projectName: row.project_id ? relationName(row.task_projects ?? null, "Проєкт") : null,
  };
}

const taskFields = "id, title, goal, area, horizon, due_date, status, postponed_until, created_by_name, created_at, completed_by, completed_at, rejected_by, rejected_at, family_id, workspace_id, project_id, families(name), task_workspaces(name), task_projects(name), task_participants(member_user_id, member_name)";
const legacyTaskFields = "id, title, goal, area, horizon, due_date, status, postponed_until, created_by_name, created_at, completed_by, completed_at, rejected_by, rejected_at, family_id, workspace_id, families(name), task_workspaces(name), task_participants(member_user_id, member_name)";

function shouldUseLegacyTaskFields(error: { code?: string; message?: string } | null) {
  return error?.code === "42703" || error?.code === "PGRST200" || error?.message?.includes("project") === true;
}

export async function getTasks(statuses: readonly TaskStatus[]): Promise<TasksResult> {
  await getTaskUserContext();
  const supabase = await createClient();
  const initialResult = await supabase
    .from("tasks")
    .select(taskFields)
    .in("status", [...statuses])
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  let data: unknown = initialResult.data;
  let error: { code?: string; message?: string } | null = initialResult.error;

  if (shouldUseLegacyTaskFields(error)) {
    const legacyResult = await supabase
      .from("tasks")
      .select(legacyTaskFields)
      .in("status", [...statuses])
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) {
    return {
      tasks: [],
      error: "Задачник ще не підключено до Supabase. Виконайте файл supabase/tasks.sql у SQL Editor.",
    };
  }

  return { tasks: ((data ?? []) as TaskRow[]).map(mapTask), error: null };
}

export async function getTaskDetail(taskId: string, includeAttachments = false): Promise<TaskDetailResult> {
  await getTaskUserContext();
  const supabase = await createClient();
  const initialResult = await supabase
    .from("tasks")
    .select(taskFields)
    .eq("id", taskId)
    .maybeSingle();
  let data: unknown = initialResult.data;
  let error: { code?: string; message?: string } | null = initialResult.error;

  if (shouldUseLegacyTaskFields(error)) {
    const legacyResult = await supabase
      .from("tasks")
      .select(legacyTaskFields)
      .eq("id", taskId)
      .maybeSingle();
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) {
    return {
      task: null,
      checklistItems: [],
      checklistError: null,
      activityEvents: [],
      activityError: null,
      attachments: [],
      error: "Не вдалося відкрити задачу. Перевірте підключення задачника.",
    };
  }

  if (!data) {
    return { task: null, checklistItems: [], checklistError: null, activityEvents: [], activityError: null, attachments: [], error: null };
  }

  const task = mapTask(data as TaskRow);
  const { data: checklistData, error: checklistQueryError } = await supabase
    .from("task_checklist_items")
    .select("id, title, is_completed, sort_order, created_at, completed_by_name, completed_at")
    .eq("task_id", taskId)
    .order("sort_order")
    .order("created_at");

  const checklistItems: TaskChecklistItem[] = checklistQueryError
    ? []
    : (checklistData ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      isCompleted: item.is_completed,
      sortOrder: item.sort_order,
      createdAt: item.created_at,
      completedByName: item.completed_by_name,
      completedAt: item.completed_at,
    }));
  const checklistError = checklistQueryError
    ? "Чекліст поки не підключено. Виконайте файл supabase/task-checklists.sql у SQL Editor."
    : null;

  const { data: activityData, error: activityQueryError } = await supabase
    .from("task_activity_events")
    .select("id, event_type, actor_name, previous_status, next_status, occurred_at")
    .eq("task_id", taskId)
    .order("occurred_at");
  const activityEvents: TaskActivityEvent[] = activityQueryError
    ? []
    : (activityData ?? []).flatMap((event): TaskActivityEvent[] => {
      if ((event.event_type !== "created" && event.event_type !== "status_changed") || !isTaskStatus(event.next_status) || (event.previous_status !== null && !isTaskStatus(event.previous_status))) return [];
      return [{
        id: event.id,
        eventType: event.event_type,
        actorName: event.actor_name,
        previousStatus: event.previous_status,
        nextStatus: event.next_status,
        occurredAt: event.occurred_at,
      }];
    });
  const activityError = activityQueryError
    ? "Повний журнал дій ще не підключено. Виконайте файл supabase/task-activity.sql у SQL Editor."
    : null;

  if (!includeAttachments || task.scopeKind === "workspace") {
    return { task, checklistItems, checklistError, activityEvents, activityError, attachments: [], error: null };
  }

  const { data: attachmentData, error: attachmentsError } = await supabase
    .from("task_attachments")
    .select("id, original_name, media_type, byte_size, storage_path, uploaded_by, uploaded_by_name, created_at")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (attachmentsError) {
    return {
      task,
      checklistItems,
      checklistError,
      activityEvents,
      activityError,
      attachments: [],
      error: "Задачу відкрито, але вкладення поки недоступні. Виконайте файл supabase/tasks-attachments.sql.",
    };
  }

  return {
    task,
    checklistItems,
    checklistError,
    activityEvents,
    activityError,
    attachments: (attachmentData ?? []).map((attachment) => ({
      id: attachment.id,
      originalName: attachment.original_name,
      mediaType: attachment.media_type,
      byteSize: attachment.byte_size,
      storagePath: attachment.storage_path,
      uploadedById: attachment.uploaded_by,
      uploadedByName: attachment.uploaded_by_name,
      createdAt: attachment.created_at,
    })),
    error: null,
  };
}

export async function getTaskFormContext(): Promise<Readonly<{
  currentMember: TaskMember;
  spaces: TaskSpace[];
  projects: TaskProject[];
  projectsSetupError: string | null;
  error: string | null;
}>> {
  const context = await getTaskUserContext();
  const currentMember = { id: context.userId, name: context.displayName };

  if (isLocalTestMode()) {
    return {
      currentMember,
      spaces: [{
        id: "local-test-family",
        kind: "family",
        name: "Тестова сім’я",
        members: [currentMember],
      }],
      projects: [{
        id: "local-test-project-home",
        name: "Тестовий ремонт будинку",
        horizon: "tactical",
        status: "active",
        scopeKind: "family",
        scopeId: "local-test-family",
        scopeName: "Тестова сім’я",
        createdByName: currentMember.name,
        createdAt: new Date(2026, 0, 1).toISOString(),
        closedAt: null,
      }],
      projectsSetupError: null,
      error: null,
    };
  }

  const supabase = await createClient();
  const spaces: TaskSpace[] = [];

  if (context.family) {
    const { data: familyMembers, error: familyError } = await supabase
      .from("family_members")
      .select("user_id, display_name")
      .eq("family_id", context.family.familyId)
      .eq("is_active", true)
      .order("display_name");

    if (familyError) {
      return { currentMember, spaces: [], projects: [], projectsSetupError: null, error: "Не вдалося завантажити учасників сім’ї." };
    }

    spaces.push({
      id: context.family.familyId,
      kind: "family",
      name: context.family.familyName,
      members: (familyMembers ?? []).map((member) => ({ id: member.user_id, name: member.display_name })),
    });
  }

  if (context.workspaces.length > 0) {
    const workspaceIds = context.workspaces.map((workspace) => workspace.id);
    const { data: workspaceMembers, error: workspaceError } = await supabase
      .from("task_workspace_members")
      .select("workspace_id, user_id, display_name")
      .in("workspace_id", workspaceIds)
      .eq("is_active", true)
      .order("display_name");

    if (workspaceError) {
      return { currentMember, spaces, projects: [], projectsSetupError: null, error: "Не вдалося завантажити учасників робочого простору." };
    }

    context.workspaces.forEach((workspace) => {
      spaces.push({
        id: workspace.id,
        kind: "workspace",
        name: workspace.name,
        members: (workspaceMembers ?? [])
          .filter((member) => member.workspace_id === workspace.id)
          .map((member) => ({ id: member.user_id, name: member.display_name })),
      });
    });
  }

  const { data: projectData, error: projectError } = await supabase
    .from("task_projects")
    .select("id, name, horizon, status, family_id, workspace_id, created_by_name, created_at, closed_at")
    .order("status")
    .order("name");

  const projects = projectError
    ? []
    : ((projectData ?? []) as TaskProjectRow[])
      .map((project): TaskProject | null => {
        const kind: TaskScopeKind = project.workspace_id ? "workspace" : "family";
        const scopeId = kind === "workspace" ? project.workspace_id : project.family_id;
        const scope = spaces.find((item) => item.kind === kind && item.id === scopeId);

        if (!scope || !isTaskHorizon(project.horizon) || !isTaskProjectStatus(project.status)) return null;

        return {
          id: project.id,
          name: project.name,
          horizon: project.horizon,
          status: project.status,
          scopeKind: scope.kind,
          scopeId: scope.id,
          scopeName: scope.name,
          createdByName: project.created_by_name,
          createdAt: project.created_at,
          closedAt: project.closed_at,
        };
      })
      .filter((project): project is TaskProject => project !== null);

  return {
    currentMember,
    spaces,
    projects,
    projectsSetupError: projectError ? "Проєкти ще не підключено. Виконайте файл supabase/task-projects.sql у SQL Editor." : null,
    error: null,
  };
}
