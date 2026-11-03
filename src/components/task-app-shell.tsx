import { AppShell } from "@/components/app-shell";
import { getTaskUserContext } from "@/lib/task-access";
import { taskNavigationItems } from "@/lib/task-navigation";
import { isLocalTestMode } from "@/lib/test-mode";

type TaskAppShellProps = Readonly<{
  children: React.ReactNode;
}>;

export async function TaskAppShell({ children }: TaskAppShellProps) {
  const context = await getTaskUserContext();
  const spaceName = context.workspaces[0]?.name ?? "Робочі простори";

  return (
    <AppShell
      familyName={spaceName}
      footerText="Задачник для особистих, сімейних і робочих справ."
      memberName={context.displayName}
      navigation={taskNavigationItems}
      productName="Задачник"
      testMode={isLocalTestMode()}
      spaceAriaLabel="Керувати робочими просторами"
      spaceHref="/tasks/workspaces"
    >
      {children}
    </AppShell>
  );
}
