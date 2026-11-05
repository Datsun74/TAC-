import type { TaskArea, TaskHorizon, TaskStatus } from "@/types/task";

export const taskAreaOptions: ReadonlyArray<Readonly<{ value: TaskArea; label: string }>> = [
  { value: "work", label: "Робота" },
  { value: "family", label: "Сім’я" },
  { value: "personal", label: "Особисте" },
];

export const taskHorizonOptions: ReadonlyArray<Readonly<{ value: TaskHorizon; label: string; hint: string }>> = [
  { value: "strategic", label: "Стратегічна", hint: "Довгостроковий напрям" },
  { value: "operational", label: "Оперативна", hint: "До року" },
  { value: "tactical", label: "Тактична", hint: "На найближчі дні й тижні" },
];

export const taskAreaLabels: Record<TaskArea, string> = {
  work: "Робота",
  family: "Сім’я",
  personal: "Особисте",
};

export const taskHorizonLabels: Record<TaskHorizon, string> = {
  strategic: "Стратегічна",
  operational: "Оперативна",
  tactical: "Тактична",
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  active: "Активна",
  in_work: "Взята в роботу",
  in_progress: "У процесі",
  completed: "Виконана",
  rejected: "Відхилена",
  postponed: "Відкладена",
};

export const taskStatusOptions: ReadonlyArray<Readonly<{ value: TaskStatus; label: string }>> = [
  { value: "active", label: taskStatusLabels.active },
  { value: "in_work", label: taskStatusLabels.in_work },
  { value: "in_progress", label: taskStatusLabels.in_progress },
  { value: "postponed", label: taskStatusLabels.postponed },
  { value: "completed", label: taskStatusLabels.completed },
  { value: "rejected", label: taskStatusLabels.rejected },
];

export function formatTaskDate(value: string) {
  return new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}
