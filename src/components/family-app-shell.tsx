import { AppShell } from "@/components/app-shell";
import { requireFamilyMember } from "@/lib/family-access";

type FamilyAppShellProps = Readonly<{
  children: React.ReactNode;
}>;

export async function FamilyAppShell({ children }: FamilyAppShellProps) {
  const member = await requireFamilyMember();

  return <AppShell memberName={member.displayName}>{children}</AppShell>;
}
