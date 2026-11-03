export const taskAreas = ["work", "family", "personal"] as const;
export const taskHorizons = ["strategic", "operational", "tactical"] as const;
export const taskStatuses = ["active", "in_progress", "completed", "rejected", "postponed"] as const;

export type TaskArea = (typeof taskAreas)[number];
export type TaskHorizon = (typeof taskHorizons)[number];
export type TaskStatus = (typeof taskStatuses)[number];
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
  dueDate: string | null;
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

export type TaskWorkspace = Readonly<{
  id: string;
  name: string;
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

export function isTaskArea(value: string): value is TaskArea {
  return (taskAreas as readonly string[]).includes(value);
}

export function isTaskHorizon(value: string): value is TaskHorizon {
  return (taskHorizons as readonly string[]).includes(value);
}

export function isTaskStatus(value: string): value is TaskStatus {
  return (taskStatuses as readonly string[]).includes(value);
}
