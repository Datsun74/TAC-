import type { NavigationItem } from "@/types/navigation";

export const navigationItems: NavigationItem[] = [
  { label: "Головна", mobileLabel: "Головна", href: "/" },
  { label: "Покупки", mobileLabel: "Покупки", href: "/purchases" },
  { label: "Додати", mobileLabel: "Додати", href: "/add" },
  { label: "Я йду в магазин", mobileLabel: "Магазин", href: "/shopping" },
  { label: "Куплено", mobileLabel: "Куплено", href: "/purchased" },
  { label: "Відхилені", mobileLabel: "Відхил.", href: "/rejected" },
];
