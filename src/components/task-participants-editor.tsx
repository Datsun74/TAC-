"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import type { TaskMember, TaskParticipant } from "@/types/task";

type TaskParticipantsEditorProps = Readonly<{
  assigneeId: string | null;
  availableMembers: readonly TaskMember[];
  createdById: string;
  createdByName: string;
  initialParticipants: readonly TaskParticipant[];
  setupError: string | null;
  taskId: string;
}>;

export function TaskParticipantsEditor({ assigneeId, availableMembers, createdById, createdByName, initialParticipants, setupError, taskId }: TaskParticipantsEditorProps) {
  const router = useRouter();
  const initialIds = useMemo(() => initialParticipants.map((participant) => participant.id), [initialParticipants]);
  const [participantIds, setParticipantIds] = useState<readonly string[]>(initialIds);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const members = useMemo(() => {
    const existingMembers = initialParticipants.filter((participant) => !availableMembers.some((member) => member.id === participant.id));
    return [...availableMembers, ...existingMembers]
      .filter((member) => member.id !== createdById)
      .sort((left, right) => left.name.localeCompare(right.name, "uk"));
  }, [availableMembers, createdById, initialParticipants]);

  const hasChanges = initialIds.length !== participantIds.length
    || initialIds.some((id) => !participantIds.includes(id));

  function toggleParticipant(memberId: string) {
    setParticipantIds((current) => current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]);
    setError("");
  }

  async function saveParticipants() {
    const addedMembers = members.filter((member) => participantIds.includes(member.id) && !initialIds.includes(member.id));
    const removedMemberIds = initialIds.filter((id) => !participantIds.includes(id));
    setError("");
    setIsSaving(true);

    const supabase = createClient();
    if (addedMembers.length > 0) {
      const { error: insertError } = await supabase.from("task_participants").insert(addedMembers.map((member) => ({
        task_id: taskId,
        member_user_id: member.id,
        member_name: member.name,
      })));
      if (insertError) {
        setError("Не вдалося додати учасників. Переконайтеся, що вони є активними в цьому просторі.");
        setIsSaving(false);
        return;
      }
    }

    if (removedMemberIds.length > 0) {
      const { error: deleteError } = await supabase.from("task_participants").delete().eq("task_id", taskId).in("member_user_id", removedMemberIds);
      if (deleteError) {
        setError("Частину учасників не вдалося прибрати. Оновіть сторінку та повторіть спробу.");
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(false);
    router.refresh();
  }

  return (
    <section className="mt-7 border-t border-stone-100 pt-5" aria-labelledby="task-participants-heading">
      <h2 className="text-base font-semibold text-stone-950" id="task-participants-heading">Учасники задачі</h2>
      <p className="mt-1 text-sm leading-6 text-stone-600">Автор завжди має доступ до задачі. Додайте тих, хто має її бачити та виконувати разом з автором. Відповідального не можна прибрати зі списку.</p>
      <div className="mt-3 flex min-h-10 items-center rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-950">
        {createdByName} <span className="ml-1 font-normal text-amber-800">— автор</span>
      </div>
      {setupError ? <p className="mt-3 rounded-xl bg-stone-100 px-3 py-2 text-xs leading-5 text-stone-600">{setupError}</p> : null}
      {members.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {members.map((member) => {
            const isAssignee = member.id === assigneeId;
            return <label className="flex min-h-10 items-center gap-3 rounded-xl border border-stone-200 px-3 text-sm font-medium text-stone-800" key={member.id}>
              <input checked={participantIds.includes(member.id)} className="size-4 accent-amber-800" disabled={isSaving || isAssignee} onChange={() => toggleParticipant(member.id)} type="checkbox" />
              <span>{member.name}{isAssignee ? <span className="ml-1 text-xs font-normal text-amber-800">— відповідальний</span> : null}</span>
            </label>;
          })}
        </div>
      ) : <p className="mt-3 text-sm text-stone-500">Інших активних учасників у цьому просторі поки немає. Це особиста задача автора.</p>}
      {hasChanges ? <div className="mt-4 flex flex-wrap gap-2"><button className="min-h-10 rounded-full bg-amber-800 px-4 text-sm font-semibold text-white hover:bg-amber-900 disabled:cursor-wait disabled:opacity-60" disabled={isSaving} onClick={() => void saveParticipants()} type="button">{isSaving ? "Зберігаємо…" : "Зберегти учасників"}</button><button className="min-h-10 rounded-full px-3 text-sm font-semibold text-stone-600 hover:bg-stone-100" disabled={isSaving} onClick={() => { setParticipantIds(initialIds); setError(""); }} type="button">Скасувати</button></div> : null}
      {error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm leading-6 text-red-800" role="alert">{error}</p> : null}
    </section>
  );
}
