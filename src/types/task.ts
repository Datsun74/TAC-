export const taskAreas = ["work", "family", "personal"] as const;
export const taskHorizons = ["strategic", "operational", "tactical"] as const;
export const taskStatuses = ["active", "in_work", "in_progress", "completed", "rejected", "postponed"] as const;
export const taskProjectStatuses = ["active", "closed"] as const;
export const taskWorkspaceStatuses = ["active", "test"] as const;

export type TaskArea = (typeof taskAreas)[number];
export type TaskHorizon = (typeof taskHorizons)[number];
export type TaskStatus = (typeof taskStatuses)[number];
export type TaskProjectStatus = (typeof taskProjectStatuses)[number];
export type TaskWorkspaceStatus = (typeof taskWorkspaceStatuses)[number];
export type TaskScopeKind = "family" | "workspace";
export type TaskWorkspaceRole = "owner" | "manager" | "worker";

export type TaskParticipant = Readonly<{
  id: string;
  name: string;
}>;

export type Task = Readonly<{
  id: string;
  title: string;
  goal: string | null;
  area: TaskArea;
  horizon: TaskHorizon;
  plannedStartDate: string | null;
  dueDate: string | null;
  actualStartedAt: string | null;
  progressPercent: number;
  executionNote: string | null;
  executionUpdatedAt: string | null;
  status: TaskStatus;
  postponedUntil: string | null;
  createdByName: string;
  createdAt: string;
  completedBy: string | null;
  completedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  participants: readonly TaskParticipant[];
  scopeKind: TaskScopeKind;
  scopeId: string;
  scopeName: string;
  projectId: string | null;
  projectName: string | null;
}>;

export type TaskMember = Readonly<{
  id: string;
  name: string;
}>;

export type TaskSpace = Readonly<{
  id: string;
  kind: TaskScopeKind;
  name: string;
  members: readonly TaskMember[];
}>;

export type TaskProject = Readonly<{
  id: string;
  name: string;
  horizon: TaskHorizon;
  status: TaskProjectStatus;
  scopeKind: TaskScopeKind;
  scopeId: string;
  scopeName: string;
  createdByName: string;
  createdAt: string;
  closedAt: string | null;
}>;

export type TaskWorkspace = Readonly<{
  id: string;
  name: string;
  status: TaskWorkspaceStatus;
  role: TaskWorkspaceRole;
  displayName: string;
}>;

export type TaskWorkspaceMember = Readonly<{
  id: string;
  workspaceId: string;
  name: string;
  role: TaskWorkspaceRole;
}>;

export type TaskAttachment = Readonly<{
  id: string;
  originalName: string;
  mediaType: string;
  byteSize: number;
  storagePath: string;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
}>;

export type TaskChecklistItem = Readonly<{
  id: string;
  title: string;
  isCompleted: boolean;
  sortOrder: number;
  createdAt: string;
  completedByName: string | null;
  completedAt: string | null;
}>;

export type TaskActivityEvent = Readonly<{
  id: string;
  eventType: "created" | "status_changed";
  actorName: string;
  previousStatus: TaskStatus | null;
  nextStatus: TaskStatus;
  occurredAt: string;
}>;

export type TaskComment = Readonly<{
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}>;

export function isTaskArea(value: string): value is TaskArea {
  return (taskAreas as readonly string[]).includes(value);
}

export function isTaskHorizon(value: string): value is TaskHorizon {
  return (taskHorizons as readonly string[]).includes(value);
}

export function isTaskStatus(value: string): value is TaskStatus {
  return (taskStatuses as readonly string[]).includes(value);
}

export function isTaskProjectStatus(value: string): value is TaskProjectStatus {
  return (taskProjectStatuses as readonly string[]).includes(value);
}

export function isTaskWorkspaceStatus(value: string): value is TaskWorkspaceStatus {
  return (taskWorkspaceStatuses as readonly string[]).includes(value);
}
