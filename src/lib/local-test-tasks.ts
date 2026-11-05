"use client";

import { localTestTasksStorageKey } from "@/lib/test-mode";
import { isTaskArea, isTaskHorizon, isTaskStatus, type Task, type TaskParticipant } from "@/types/task";

let cachedTasks: Task[] | null = null;

function dateOffset(days: number) {
  const value = new Date();
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function exampleTasks(): Task[] {
  const createdAt = new Date().toISOString();

  return [
    {
      id: "local-task-yard",
      title: "Прибрати подвір’я",
      goal: "Зібрати листя біля гаража та винести гілки.",
      area: "family",
      horizon: "tactical",
      dueDate: dateOffset(0),
      status: "in_progress",
      postponedUntil: null,
      createdByName: "Сергій (тест)",
      createdAt,
      completedBy: null,
      completedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      participants: [{ id: "local-test-member", name: "Сергій (тест)" }],
      scopeKind: "family",
      scopeId: "local-test-family",
      scopeName: "Тестова сім’я",
      projectId: null,
      projectName: null,
    },
    {
      id: "local-task-ielts",
      title: "Забронювати IELTS",
      goal: "Вибрати дату й оформити реєстрацію.",
      area: "personal",
      horizon: "operational",
      dueDate: dateOffset(3),
      status: "active",
      postponedUntil: null,
      createdByName: "Сергій (тест)",
      createdAt,
      completedBy: null,
      completedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      participants: [],
      scopeKind: "family",
      scopeId: "local-test-family",
      scopeName: "Тестова сім’я",
      projectId: null,
      projectName: null,
    },
    {
      id: "local-task-repair",
      title: "Підготувати кошторис ремонту насоса",
      goal: "Зібрати ціни на деталі та передати майстру.",
      area: "work",
      horizon: "tactical",
      dueDate: dateOffset(7),
      status: "active",
      postponedUntil: null,
      createdByName: "Сергій (тест)",
      createdAt,
      completedBy: null,
      completedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      participants: [],
      scopeKind: "family",
      scopeId: "local-test-family",
      scopeName: "Тестова сім’я",
      projectId: "local-test-project-home",
      projectName: "Тестовий ремонт будинку",
    },
  ];
}

function toParticipant(value: unknown): TaskParticipant | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const participant = value as Record<string, unknown>;
  return typeof participant.id === "string" && typeof participant.name === "string"
    ? { id: participant.id, name: participant.name }
    : null;
}

function toTask(value: unknown): Task | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const task = value as Record<string, unknown>;
  if (
    typeof task.id !== "string" ||
    typeof task.title !== "string" ||
    (typeof task.goal !== "string" && task.goal !== null) ||
    typeof task.area !== "string" ||
    !isTaskArea(task.area) ||
    typeof task.horizon !== "string" ||
    !isTaskHorizon(task.horizon) ||
    (typeof task.dueDate !== "string" && task.dueDate !== null) ||
    typeof task.status !== "string" ||
    !isTaskStatus(task.status) ||
    (typeof task.postponedUntil !== "string" && task.postponedUntil !== null) ||
    typeof task.createdByName !== "string" ||
    typeof task.createdAt !== "string" ||
    (typeof task.completedBy !== "string" && task.completedBy !== null) ||
    (typeof task.completedAt !== "string" && task.completedAt !== null) ||
    (typeof task.rejectedBy !== "string" && task.rejectedBy !== null) ||
    (typeof task.rejectedAt !== "string" && task.rejectedAt !== null) ||
    !Array.isArray(task.participants) ||
    (task.scopeKind !== "family" && task.scopeKind !== "workspace") ||
    typeof task.scopeId !== "string" ||
    typeof task.scopeName !== "string"
  ) {
    return null;
  }

  const participants = task.participants.map(toParticipant).filter((participant): participant is TaskParticipant => participant !== null);

  return {
    id: task.id,
    title: task.title,
    goal: task.goal,
    area: task.area,
    horizon: task.horizon,
    dueDate: task.dueDate,
    status: task.status,
    postponedUntil: task.postponedUntil,
    createdByName: task.createdByName,
    createdAt: task.createdAt,
    completedBy: task.completedBy,
    completedAt: task.completedAt,
    rejectedBy: task.rejectedBy,
    rejectedAt: task.rejectedAt,
    participants,
    scopeKind: task.scopeKind,
    scopeId: task.scopeId,
    scopeName: task.scopeName,
    projectId: typeof task.projectId === "string" ? task.projectId : null,
    projectName: typeof task.projectName === "string" ? task.projectName : null,
  };
}

export function readLocalTestTasks() {
  if (cachedTasks !== null) {
    return cachedTasks;
  }

  try {
    const raw = window.localStorage.getItem(localTestTasksStorageKey);
    if (raw === null) {
      cachedTasks = exampleTasks();
      return cachedTasks;
    }

    const parsed = JSON.parse(raw) as unknown;
    cachedTasks = Array.isArray(parsed) ? parsed.map(toTask).filter((task): task is Task => task !== null) : [];
    return cachedTasks;
  } catch {
    cachedTasks = [];
    return cachedTasks;
  }
}

export function writeLocalTestTasks(tasks: readonly Task[]) {
  cachedTasks = [...tasks];
  window.localStorage.setItem(localTestTasksStorageKey, JSON.stringify(cachedTasks));
}
