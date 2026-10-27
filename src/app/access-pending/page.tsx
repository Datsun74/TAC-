import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { getAuthenticatedUserId } from "@/lib/family-access";
import { createClient } from "@/lib/supabase/server";

export default async function AccessPendingPage() {
  const userId = await getAuthenticatedUserId();
  if (!userId) redirect("/login");

  const supabase = await createClient();
  const { data: member } = await supabase.from("family_members").select("user_id").eq("user_id", userId).eq("is_active", true).maybeSingle();
  if (member) redirect("/");

  return <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10 sm:px-6"><section className="w-full rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-9"><p className="text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">Сімейний простір</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">Оберіть спосіб почати</h1><p className="mt-4 leading-7 text-stone-700">Ви успішно увійшли. Тепер створіть окремий список для своєї сім’ї або приєднайтеся до списку родича за його кодом.</p><div className="mt-7 grid gap-3 sm:grid-cols-2"><Link className="rounded-2xl bg-amber-800 px-5 py-4 text-center text-sm font-semibold text-white transition hover:bg-amber-900 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none" href="/family-setup">Створити свою сім’ю</Link><Link className="rounded-2xl border border-amber-300 bg-white px-5 py-4 text-center text-sm font-semibold text-amber-900 transition hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none" href="/join-family">Увести код запрошення</Link></div><SignOutButton /></section></main>;
}
