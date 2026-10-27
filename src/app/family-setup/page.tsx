import { redirect } from "next/navigation";

import { FamilySetupForm } from "@/components/family-setup-form";
import { getAuthenticatedUserId } from "@/lib/family-access";
import { createClient } from "@/lib/supabase/server";
import { isLocalTestMode } from "@/lib/test-mode";

export default async function FamilySetupPage() {
  if (isLocalTestMode()) redirect("/");
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");
  const supabase = await createClient();
  const { data: member } = await supabase.from("family_members").select("user_id").eq("user_id", userId).eq("is_active", true).maybeSingle();
  if (member) redirect("/");

  return <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10 sm:px-6"><section className="w-full rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-9"><p className="text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">Перший крок</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">Створіть сімейний простір</h1><p className="mt-4 leading-7 text-stone-700">У вашої сім’ї буде окремий список покупок. Інші родини не бачитимуть його.</p><FamilySetupForm /></section></main>;
}
