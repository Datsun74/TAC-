"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { createClient } from "@/lib/supabase/client";

export function FamilySetupForm() {
  const router = useRouter();
  const [familyName, setFamilyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedFamilyName = familyName.trim();
    const trimmedDisplayName = displayName.trim();

    if (trimmedFamilyName.length < 2 || trimmedDisplayName.length < 2) {
      setError("Укажіть назву сім’ї та ваше ім’я щонайменше з двох символів.");
      return;
    }

    setError("");
    setIsSaving(true);
    const { error: rpcError } = await createClient().rpc("create_family_space", { family_name: trimmedFamilyName, display_name: trimmedDisplayName });

    if (rpcError) {
      setError("Не вдалося створити сімейний простір. Спробуйте ще раз.");
      setIsSaving(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return <form className="mt-7 space-y-5" noValidate onSubmit={handleSubmit}><div><label className="block text-sm font-semibold text-stone-900" htmlFor="familyName">Назва сім’ї</label><input autoComplete="organization" className="mt-2 min-h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100" id="familyName" onChange={(event) => setFamilyName(event.target.value)} placeholder="Наприклад, Родина Дацун" value={familyName} /></div><div><label className="block text-sm font-semibold text-stone-900" htmlFor="displayName">Ваше ім’я у списку</label><input autoComplete="name" className="mt-2 min-h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100" id="displayName" onChange={(event) => setDisplayName(event.target.value)} placeholder="Наприклад, Сергій" value={displayName} /><p className="mt-2 text-sm leading-6 text-stone-600">Email нікому не показується — у списку буде лише це ім’я.</p></div>{error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">{error}</p> : null}<button className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-amber-800 px-6 py-3 text-base font-semibold text-white transition hover:bg-amber-900 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Створюємо…" : "Створити сімейний простір"}</button></form>;
}
