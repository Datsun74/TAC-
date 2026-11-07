"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import type { Task, TaskMember, TaskParticipant } from "@/types/task";

type TaskAssigneeEditorProps = Readonly<{
  availableMembers: readonly TaskMember[];
  initialParticipants: readonly TaskParticipant[];
  setupError: string | null;
  task: Task;
}>;

export function TaskAssigneeEditor({ availableMembers, initialParticipants, setupError, task }: TaskAssigneeEditorProps) {
  const router = useRouter();
  const defaultAssigneeId = task.assigneeId ?? task.createdById;
  const [assigneeId, setAssigneeId] = useState(defaultAssigneeId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const members = useMemo(() => {
    const candidates: TaskMember[] = [
      { id: task.createdById, name: task.createdByName },
      ...availableMembers,
      ...initialParticipants,
    ];

    return candidates.filter((member, index) => candidates.findIndex((candidate) => candidate.id === member.id) === index);
  }, [availableMembers, initialParticipants, task.createdById, task.createdByName]);
  const selectedMember = members.find((member) => member.id === assigneeId) ?? members[0];
  const hasChanges = Boolean(selectedMember) && selectedMember.id !== defaultAssigneeId;

  async function saveAssignee() {
    if (!selectedMember || !hasChanges || isSaving) return;
    setError("");
    setIsSaving(true);

    const supabase = createClient();
    const isAuthor = selectedMember.id === task.createdById;
    const isAlreadyParticipant = initialParticipants.some((participant) => participant.id === selectedMember.id);

    if (!isAuthor && !isAlreadyParticipant) {
      const { error: participantError } = await supabase.from("task_participants").insert({
        task_id: task.id,
        member_user_id: selectedMember.id,
        member_name: selectedMember.name,
      });
      if (participantError) {
        setError("Не вдалося додати відповідального до учасників задачі. Переконайтеся, що ця людина активна у просторі задачі.");
        setIsSaving(false);
        return;
      }
    }

    const { error: updateError } = await supabase
      .from("tasks")
      .update(isAuthor ? { assignee_user_id: null, assignee_name: null } : { assignee_user_id: selectedMember.id, assignee_name: selectedMember.name })
      .eq("id", task.id);

    if (updateError) {
      setError("Не вдалося зберегти відповідального. Виконайте supabase/task-assignee.sql у Supabase SQL Editor і повторіть спробу.");
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    router.refresh();
  }

  return (
    <section className="mt-7 border-t border-stone-100 pt-5" aria-labelledby="task-assignee-heading">
      <h2 className="text-base font-semibold text-stone-950" id="task-assignee-heading">Відповідальний за виконання</h2>
      <p className="mt-1 text-sm leading-6 text-stone-600">За замовчуванням це автор задачі. Коли обираєте іншу людину, вона автоматично додається до учасників.</p>
      {setupError ? <p className="mt-3 rounded-xl bg-stone-100 px-3 py-2 text-xs leading-5 text-stone-600">{setupError}</p> : null}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor={`task-assignee-${task.id}`}>Відповідальний</label>
        <select className="min-h-10 min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-900 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-100 disabled:bg-stone-100" disabled={isSaving || Boolean(setupError)} id={`task-assignee-${task.id}`} onChange={(event) => { setAssigneeId(event.target.value); setError(""); }} value={selectedMember?.id ?? ""}>
          {members.map((member) => <option key={member.id} value={member.id}>{member.name}{member.id === task.createdById ? " — автор" : ""}</option>)}
        </select>
        {hasChanges ? <button className="min-h-10 rounded-full bg-amber-800 px-4 text-sm font-semibold text-white hover:bg-amber-900 disabled:cursor-wait disabled:opacity-60" disabled={isSaving || Boolean(setupError)} onClick={() => void saveAssignee()} type="button">{isSaving ? "Зберігаємо…" : "Призначити"}</button> : null}
      </div>
      {error ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm leading-6 text-red-800" role="alert">{error}</p> : null}
    </section>
  );
}
