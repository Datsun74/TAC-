import { TaskAppShell } from "../../components/task-app-shell";

export default function TasksLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <TaskAppShell>{children}</TaskAppShell>;
}
