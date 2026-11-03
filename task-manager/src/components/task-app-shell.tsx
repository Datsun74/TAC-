import { getTaskUserContext } from "../../../src/lib/task-access";
import { isLocalTestMode } from "../../../src/lib/test-mode";

import { TaskShell } from "./task-shell";

type TaskAppShellProps = Readonly<{
  children: React.ReactNode;
}>;

export async function TaskAppShell({ children }: TaskAppShellProps) {
  const context = await getTaskUserContext();
  const spaceName = context.workspaces[0]?.name ?? "Робочі простори";

  return (
    <TaskShell displayName={context.displayName} spaceName={spaceName} testMode={isLocalTestMode()}>
      {children}
    </TaskShell>
  );
}
