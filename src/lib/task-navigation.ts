import type { NavigationItem } from "@/types/navigation";

export const taskNavigationItems: NavigationItem[] = [
  { label: "Сьогодні", mobileLabel: "Сьогодні", href: "/tasks" },
  { label: "Усі задачі", mobileLabel: "Усі", href: "/tasks/list" },
  { label: "Дошка", mobileLabel: "Дошка", href: "/tasks/board" },
  { label: "Нова задача", mobileLabel: "Додати", href: "/tasks/add" },
  { label: "Історія", mobileLabel: "Історія", href: "/tasks/history" },
  { label: "Простори", mobileLabel: "Простори", href: "/tasks/workspaces" },
  { label: "Проєкти", mobileLabel: "Проєкти", href: "/tasks/projects" },
];
