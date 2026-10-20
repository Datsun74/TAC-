import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { getAuthenticatedUserId } from "@/lib/family-access";
import { createClient } from "@/lib/supabase/server";

export default async function AccessPendingPage() {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("family_members")
    .select("user_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (member) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10 sm:px-6">
      <section className="w-full rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-9">
        <p className="text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">Доступ очікує</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">Потрібне підтвердження сім&apos;ї</h1>
        <p className="mt-4 leading-7 text-stone-700">
          Ви успішно увійшли, але цей email ще не додано до закритого сімейного списку. Дані покупок для вас не відкриті.
        </p>
        <div className="mt-6 rounded-2xl border border-amber-200 bg-white p-4">
          <p className="text-sm font-semibold text-stone-800">Код для підтвердження</p>
          <code className="mt-2 block break-all rounded-xl bg-stone-100 p-3 text-xs text-stone-700">{userId}</code>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Передайте цей код тому, хто керує сімейним доступом. Він додасть вам видиме ім&apos;я, наприклад «Сергій».
          </p>
        </div>
        <SignOutButton />
      </section>
    </main>
  );
}
