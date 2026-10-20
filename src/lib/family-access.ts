import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { isLocalTestMode } from "@/lib/test-mode";

export type FamilyMember = Readonly<{
  id: string;
  displayName: string;
}>;

export async function getAuthenticatedUserId() {
  const supabase = await createClient();
  const {
    data: claimsData,
    error,
  } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;

  if (error || typeof userId !== "string") {
    return null;
  }

  return userId;
}

export async function requireFamilyMember(): Promise<FamilyMember> {
  if (isLocalTestMode()) {
    return {
      id: "local-test-member",
      displayName: "Сергій (тест)",
    };
  }

  const userId = await getAuthenticatedUserId();

  if (!userId) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: member, error } = await supabase
    .from("family_members")
    .select("display_name")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !member) {
    redirect("/access-pending");
  }

  return {
    id: userId,
    displayName: member.display_name,
  };
}
