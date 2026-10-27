"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Invite = Readonly<{ code: string; expiresAt: string }>;

export function FamilyInvitePanel({ familyId, canInvite, testMode }: Readonly<{ familyId: string; canInvite: boolean; testMode: boolean }>) {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function createInvite() {
    setError("");
    setIsCreating(true);
    try {
      const supabase = createClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("missing-user");
      const { data, error: insertError } = await supabase.from("family_invites").insert({ family_id: familyId, created_by: userData.user.id }).select("code, expires_at").single();
      if (insertError || !data) throw insertError ?? new Error("missing-invite");
      setInvite({ code: data.code, expiresAt: data.expires_at });
    } catch {
      setError("Не вдалося створити запрошення. Спробуйте ще раз.");
    } finally {
      setIsCreating(false);
    }
  }

  async function copyCode() {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.code);
    setCopied(true);
  }

  if (testMode) return <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">У тестовому режимі створення кодів вимкнено. Воно працюватиме після запуску SQL-оновлення у Supabase.</p>;
  if (!canInvite) return <p className="mt-4 rounded-2xl bg-stone-100 px-4 py-3 text-sm leading-6 text-stone-700">Код запрошення може створити власник цього сімейного простору.</p>;

  return <div className="mt-5"><button className="inline-flex min-h-11 items-center justify-center rounded-full bg-amber-800 px-5 py-2 text-sm font-semibold text-white transition hover:bg-amber-900 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60" disabled={isCreating} onClick={createInvite} type="button">{isCreating ? "Створюємо…" : "Створити код запрошення"}</button>{error ? <p className="mt-3 text-sm text-red-800" role="alert">{error}</p> : null}{invite ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-stone-900">Передайте цей код родичу</p><code className="mt-2 block break-all rounded-xl bg-white p-3 text-sm text-stone-800">{invite.code}</code><p className="mt-3 text-sm text-stone-600">Код діє до {new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Kyiv" }).format(new Date(invite.expiresAt))}.</p><button className="mt-3 text-sm font-semibold text-amber-800 underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:outline-none" onClick={copyCode} type="button">{copied ? "Скопійовано" : "Копіювати код"}</button></div> : null}</div>;
}
