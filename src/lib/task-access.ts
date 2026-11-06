import "server-only";

import { redirect } from "next/navigation";

import { getAuthenticatedUserId, type FamilyMember } from "@/lib/family-access";
import { createClient } from "@/lib/supabase/server";
import { isLocalTestMode } from "@/lib/test-mode";
import type { TaskWorkspace, TaskWorkspaceMember, TaskWorkspaceRole, TaskWorkspaceStatus } from "@/types/task";

export type TaskUserContext = Readonly<{
  userId: string;
  displayName: string;
  family: FamilyMember | null;
  workspaces: readonly TaskWorkspace[];
}>;

type WorkspaceRow = Readonly<{
  workspace_id: string;
  display_name: string;
  role: unknown;
  task_workspaces: unknown;
}>;

function workspaceName(value: unknown) {
  if (Array.isArray(value)) {
    return workspaceName(value[0]);
  }

  if (value && typeof value === "object" && typeof (value as { name?: unknown }).name === "string") {
    return (value as { name: string }).name;
  }

  return "Робочий простір";
}

function workspaceRole(value: unknown): TaskWorkspaceRole {
  return value === "owner" || value === "manager" ? value : "worker";
}

function workspaceStatus(value: unknown): TaskWorkspaceStatus {
  return value === "test" ? "test" : "active";
}

function workspaceStatusValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return workspaceStatusValue(value[0]);
  }

  if (value && typeof value === "object") {
    return (value as { status?: unknown }).status;
  }

  return undefined;
}

export async function getTaskUserContext(): Promise<TaskUserContext> {
  if (isLocalTestMode()) {
    return {
      userId: "local-test-member",
      displayName: "Сергій (тест)",
      family: {
        id: "local-test-member",
        displayName: "Сергій (тест)",
        familyId: "local-test-family",
        familyName: "Тестова сім’я",
        role: "owner",
      },
      workspaces: [],
    };
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    redirect("/login");
  }

  const supabase = await createClient();
  const [{ data: familyMember }, initialWorkspaceResult] = await Promise.all([
    supabase
      .from("family_members")
      .select("display_name, family_id, role, families(name)")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("task_workspace_members")
      .select("workspace_id, display_name, role, task_workspaces(name, status)")
      .eq("user_id", userId)
      .eq("is_active", true),
  ]);

  const family = Array.isArray(familyMember?.families) ? familyMember.families[0] : familyMember?.families;
  const resolvedFamily: FamilyMember | null = familyMember && family && typeof family.name === "string" && familyMember.family_id
    ? {
      id: userId,
      displayName: familyMember.display_name,
      familyId: familyMember.family_id,
      familyName: family.name,
      role: familyMember.role === "owner" ? "owner" : "member",
    }
    : null;

  // The fallback keeps existing workspaces available until the optional
  // workspace-status migration has been applied in Supabase.
  let workspaceData = initialWorkspaceResult.data as WorkspaceRow[] | null;
  if (initialWorkspaceResult.error) {
    const { data: legacyWorkspaceData } = await supabase
      .from("task_workspace_members")
      .select("workspace_id, display_name, role, task_workspaces(name)")
      .eq("user_id", userId)
      .eq("is_active", true);
    workspaceData = legacyWorkspaceData as WorkspaceRow[] | null;
  }

  const workspaces: TaskWorkspace[] = (workspaceData ?? []).map((workspace) => ({
    id: workspace.workspace_id,
    name: workspaceName(workspace.task_workspaces),
    status: workspaceStatus(workspaceStatusValue(workspace.task_workspaces)),
    role: workspaceRole(workspace.role),
    displayName: workspace.display_name,
  }));

  return {
    userId,
    displayName: resolvedFamily?.displayName ?? workspaces[0]?.displayName ?? "Користувач",
    family: resolvedFamily,
    workspaces,
  };
}

export async function getTaskWorkspaceMembers(workspaceIds: readonly string[]): Promise<TaskWorkspaceMember[]> {
  if (isLocalTestMode() || workspaceIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("task_workspace_members")
    .select("workspace_id, user_id, display_name, role")
    .in("workspace_id", [...workspaceIds])
    .eq("is_active", true)
    .order("display_name");

  return (data ?? []).map((member) => ({
    id: member.user_id,
    workspaceId: member.workspace_id,
    name: member.display_name,
    role: workspaceRole(member.role),
  }));
}
