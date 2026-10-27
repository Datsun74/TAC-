import { FamilyAppShell } from "@/components/family-app-shell";
import { FamilyInvitePanel } from "@/components/family-invite-panel";
import { PageIntro } from "@/components/page-intro";
import { requireFamilyMember } from "@/lib/family-access";
import { createClient } from "@/lib/supabase/server";
import { isLocalTestMode } from "@/lib/test-mode";

type ListedMember = Readonly<{ id: string; displayName: string; role: "owner" | "member" }>;

export default async function FamilyPage() {
  const member = await requireFamilyMember();
  const testMode = isLocalTestMode();
  let members: ListedMember[] = [{ id: member.id, displayName: member.displayName, role: member.role }];

  if (!testMode) {
    const supabase = await createClient();
    const { data } = await supabase.from("family_members").select("user_id, display_name, role").eq("family_id", member.familyId).eq("is_active", true).order("joined_at");
    if (data) members = data.map((row) => ({ id: row.user_id, displayName: row.display_name, role: row.role === "owner" ? "owner" : "member" }));
  }

  return <FamilyAppShell><section className="w-full py-10 sm:py-14 lg:py-16"><PageIntro description="Цей простір ізольований: покупки вашої сім’ї не видно іншим родинам." eyebrow="Налаштування" title={member.familyName} /><div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]"><section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-lg font-semibold text-stone-950">Учасники</h2><ul className="mt-4 divide-y divide-stone-100">{members.map((listedMember) => <li className="flex items-center justify-between gap-4 py-3" key={listedMember.id}><span className="font-medium text-stone-900">{listedMember.displayName}{listedMember.id === member.id ? " (ви)" : ""}</span><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">{listedMember.role === "owner" ? "Власник" : "Учасник"}</span></li>)}</ul></section><section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-7"><h2 className="text-lg font-semibold text-stone-950">Запросити родича</h2><p className="mt-2 text-sm leading-6 text-stone-700">Створіть одноразовий код. Родич спочатку увійде за своїм email, а потім уведе цей код.</p><FamilyInvitePanel canInvite={member.role === "owner"} familyId={member.familyId} testMode={testMode} /></section></div></section></FamilyAppShell>;
}
