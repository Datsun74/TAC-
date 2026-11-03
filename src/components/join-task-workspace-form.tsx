"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { createClient } from "@/lib/supabase/client";

export function JoinTaskWorkspaceForm({ initialCode = "" }: Readonly<{ initialCode?: string }>) {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState(initialCode);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = inviteCode.trim();
    const name = displayName.trim();

    if (!code || name.length < 2) {
      setError("Вставте код запрошення та вкажіть ім’я щонайменше з двох символів.");
      return;
    }

    setError("");
    setIsSaving(true);
    const { error: rpcError } = await createClient().rpc("accept_task_workspace_invite", {
      invite_code: code,
      display_name: name,
    });

    if (rpcError) {
      setError("Код не спрацював. Перевірте його або попросіть власника створити новий.");
      setIsSaving(false);
      return;
    }

    router.replace("/tasks");
    router.refresh();
  }

  return (
    <form className="mt-7 space-y-5" noValidate onSubmit={handleSubmit}>
      <div>
        <label className="block text-sm font-semibold text-stone-900" htmlFor="task-workspace-invite-code">Код запрошення</label>
        <input autoComplete="off" className="mt-2 min-h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 font-mono text-sm outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100" id="task-workspace-invite-code" onChange={(event) => setInviteCode(event.target.value)} placeholder="Вставте код від власника" value={inviteCode} />
      </div>
      <div>
        <label className="block text-sm font-semibold text-stone-900" htmlFor="task-workspace-member-name">Ваше ім’я у просторі</label>
        <input autoComplete="name" className="mt-2 min-h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100" id="task-workspace-member-name" onChange={(event) => setDisplayName(event.target.value)} placeholder="Наприклад, Олена" value={displayName} />
      </div>
      {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">{error}</p> : null}
      <button className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-amber-800 px-6 py-3 text-base font-semibold text-white transition hover:bg-amber-900 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Приєднуємо…" : "Приєднатися до робочого простору"}</button>
    </form>
  );
}
