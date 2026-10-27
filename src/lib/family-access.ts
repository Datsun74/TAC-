import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isLocalTestMode } from "@/lib/test-mode";

export type FamilyMember = Readonly<{
  id: string;
  displayName: string;
  familyId: string;
  familyName: string;
  role: "owner" | "member";
}>;

export async function getAuthenticatedUserId() {
  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;

  return error || typeof userId !== "string" ? null : userId;
}

export async function requireFamilyMember(): Promise<FamilyMember> {
  if (isLocalTestMode()) {
    return {
      id: "local-test-member",
      displayName: "Сергій (тест)",
      familyId: "local-test-family",
      familyName: "Тестова сім’я",
      role: "owner",
    };
  }

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: member, error } = await supabase
    .from("family_members")
    .select("display_name, family_id, role, families(name)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  const family = Array.isArray(member?.families) ? member.families[0] : member?.families;

  if (error || !member || !member.family_id || !family || typeof family.name !== "string") {
    redirect("/access-pending");
  }

  return {
    id: userId,
    displayName: member.display_name,
    familyId: member.family_id,
    familyName: family.name,
    role: member.role === "owner" ? "owner" : "member",
  };
}
