"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { createClient } from "@/lib/supabase/client";
import type { TaskWorkspace, TaskWorkspaceMember, TaskWorkspaceRole, TaskWorkspaceStatus } from "@/types/task";

type Invite = Readonly<{
  code: string;
  expiresAt: string;
}>;

type TaskWorkspacesPanelProps = Readonly<{
  displayName: string;
  currentUserId: string;
  testMode: boolean;
  workspaces: readonly TaskWorkspace[];
  workspaceMembers: readonly TaskWorkspaceMember[];
}>;

function roleLabel(role: TaskWorkspace["role"]) {
  if (role === "owner") return "Власник";
  if (role === "manager") return "Менеджер";
  return "Працівник";
}

function workspaceStatusLabel(status: TaskWorkspaceStatus) {
  return status === "test" ? "Тестовий режим" : "Активний";
}

export function TaskWorkspacesPanel({ currentUserId, displayName, testMode, workspaces, workspaceMembers }: TaskWorkspacesPanelProps) {
  const router = useRouter();
  const [workspaceName, setWorkspaceName] = useState("");
  const [memberName, setMemberName] = useState(displayName === "Користувач" ? "" : displayName);
  const [isCreating, setIsCreating] = useState(false);
  const [creatingInviteFor, setCreatingInviteFor] = useState<string | null>(null);
  const [invites, setInvites] = useState<Record<string, Invite>>({});
  const [changedRoles, setChangedRoles] = useState<Record<string, TaskWorkspaceRole>>({});
  const [changedStatuses, setChangedStatuses] = useState<Record<string, TaskWorkspaceStatus>>({});
  const [changingRoleFor, setChangingRoleFor] = useState<string | null>(null);
  const [changingStatusFor, setChangingStatusFor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const members = workspaceMembers.map((member) => ({ ...member, role: changedRoles[member.workspaceId + member.id] ?? member.role }));

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = workspaceName.trim();
    const personName = memberName.trim();

    if (name.length < 2 || personName.length < 2) {
      setError("Вкажіть назву простору та ваше ім’я щонайменше з двох символів.");
      return;
    }

    if (testMode) {
      setError("Створення робочих просторів потребує підключеного Supabase.");
      return;
    }

    setError("");
    setIsCreating(true);
    const { error: rpcError } = await createClient().rpc("create_task_workspace", {
      workspace_name: name,
      display_name: personName,
    });

    if (rpcError) {
      setError("Не вдалося створити робочий простір. Перевірте, чи виконано supabase/task-workspaces.sql.");
      setIsCreating(false);
      return;
    }

    router.refresh();
  }

  async function createInvite(workspaceId: string) {
    if (testMode) {
      setError("Створення кодів потребує підключеного Supabase.");
      return;
    }

    setError("");
    setCreatingInviteFor(workspaceId);
    const { data, error: rpcError } = await createClient().rpc("create_task_workspace_invite", {
      target_workspace_id: workspaceId,
    });

    const invite = Array.isArray(data) ? data[0] : data;
    if (rpcError || !invite || typeof invite.code !== "string" || typeof invite.expires_at !== "string") {
      setError("Не вдалося створити код запрошення.");
      setCreatingInviteFor(null);
      return;
    }

    setInvites((current) => ({ ...current, [workspaceId]: { code: invite.code, expiresAt: invite.expires_at } }));
    setCreatingInviteFor(null);
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
  }

  async function changeRole(member: TaskWorkspaceMember, nextRole: TaskWorkspaceRole) {
    if (nextRole === "owner") {
      return;
    }

    setError("");
    setChangingRoleFor(member.workspaceId + member.id);
    const { error: rpcError } = await createClient().rpc("set_task_workspace_member_role", {
      target_workspace_id: member.workspaceId,
      target_user_id: member.id,
      next_role: nextRole,
    });

    if (rpcError) {
      setError("Не вдалося змінити роль працівника.");
      setChangingRoleFor(null);
      return;
    }

    setChangedRoles((current) => ({ ...current, [member.workspaceId + member.id]: nextRole }));
    setChangingRoleFor(null);
  }

  async function changeWorkspaceStatus(workspace: TaskWorkspace, nextStatus: TaskWorkspaceStatus) {
    if (testMode) {
      setError("Зміна режиму простору потребує підключеного Supabase.");
      return;
    }

    setError("");
    setChangingStatusFor(workspace.id);
    const { error: rpcError } = await createClient().rpc("set_task_workspace_status", {
      target_workspace_id: workspace.id,
      next_status: nextStatus,
    });

    if (rpcError) {
      setError("Не вдалося змінити режим простору. Перевірте, чи виконано supabase/task-workspace-status.sql.");
      setChangingStatusFor(null);
      return;
    }

    setChangedStatuses((current) => ({ ...current, [workspace.id]: nextStatus }));
    setChangingStatusFor(null);
    router.refresh();
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.8fr)]">
      <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-semibold tracking-tight text-stone-950">Ваші робочі простори</h2>
        <p className="mt-2 text-sm leading-6 text-stone-600">Робочі задачі та працівники ізольовані від сімейного простору. Тестовий простір зберігає всі дані, але не пропонується для нових задач і проєктів.</p>
        {workspaces.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-stone-100 px-4 py-4 text-sm leading-6 text-stone-600">Ви ще не належите до жодного робочого простору.</p>
        ) : (
          <ul className="mt-6 divide-y divide-stone-100">
            {workspaces.map((workspace) => {
              const status = changedStatuses[workspace.id] ?? workspace.status;
              const canManage = workspace.role === "owner" || workspace.role === "manager";

              return (
              <li className="py-5" key={workspace.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-stone-900">{workspace.name}</h3>
                    <p className="mt-1 text-sm text-stone-600">Ви: {workspace.displayName}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status === "test" ? "bg-amber-100 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}>{workspaceStatusLabel(status)}</span>
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">{roleLabel(workspace.role)}</span>
                  </div>
                </div>
                {canManage && status === "active" ? (
                  <div className="mt-4">
                    <button className="min-h-10 rounded-full border border-amber-800 px-4 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-50 disabled:cursor-wait disabled:opacity-60" disabled={creatingInviteFor === workspace.id} onClick={() => void createInvite(workspace.id)} type="button">
                      {creatingInviteFor === workspace.id ? "Створюємо…" : "Код для працівника"}
                    </button>
                    {invites[workspace.id] ? (
                      <div className="mt-3 rounded-2xl bg-amber-50 p-4">
                        <p className="text-sm font-semibold text-stone-900">Передайте цей код працівнику</p>
                        <code className="mt-2 block break-all rounded-xl bg-white p-3 text-sm text-stone-800">{invites[workspace.id].code}</code>
                        <p className="mt-3 text-sm text-stone-600">Діє до {new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Kyiv" }).format(new Date(invites[workspace.id].expiresAt))}.</p>
                        <button className="mt-3 text-sm font-semibold text-amber-800 underline underline-offset-4 hover:text-amber-950" onClick={() => void copyCode(invites[workspace.id].code)} type="button">Копіювати код</button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {workspace.role === "owner" ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${status === "test" ? "border-emerald-700 text-emerald-800 hover:bg-emerald-50" : "border-amber-800 text-amber-900 hover:bg-amber-50"}`} disabled={changingStatusFor === workspace.id} onClick={() => void changeWorkspaceStatus(workspace, status === "test" ? "active" : "test")} type="button">
                      {changingStatusFor === workspace.id ? "Зберігаємо…" : status === "test" ? "Активувати простір" : "Перевести в тестовий режим"}
                    </button>
                    <p className="text-xs leading-5 text-stone-500">{status === "test" ? "Простір збережено; за потреби його можна повернути в роботу." : "Для старих даних доступ збережеться."}</p>
                  </div>
                ) : null}
                <div className="mt-5 border-t border-stone-100 pt-4">
                  <p className="text-sm font-semibold text-stone-800">Учасники</p>
                  <ul className="mt-2 space-y-2">
                    {members.filter((member) => member.workspaceId === workspace.id).map((member) => (
                      <li className="flex items-center justify-between gap-3 text-sm" key={member.workspaceId + member.id}>
                        <span className="min-w-0 truncate text-stone-700">{member.name}{member.id === currentUserId ? " (ви)" : ""}</span>
                        {workspace.role === "owner" && member.role !== "owner" ? (
                          <select className="min-h-9 rounded-xl border border-stone-300 bg-white px-2 text-xs font-semibold text-stone-700 disabled:cursor-wait disabled:opacity-60" disabled={changingRoleFor === member.workspaceId + member.id} onChange={(event) => void changeRole(member, event.target.value as TaskWorkspaceRole)} value={member.role}>
                            <option value="worker">Працівник</option>
                            <option value="manager">Менеджер</option>
                          </select>
                        ) : <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">{roleLabel(member.role)}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:p-7">
        <h2 className="text-xl font-semibold tracking-tight text-stone-950">Новий робочий простір</h2>
        <p className="mt-2 text-sm leading-6 text-stone-700">Створіть окремий простір для компанії, бригади або проєкту.</p>
        <form className="mt-5 space-y-4" noValidate onSubmit={createWorkspace}>
          <div>
            <label className="block text-sm font-semibold text-stone-900" htmlFor="workspace-name">Назва</label>
            <input className="mt-2 min-h-11 w-full rounded-2xl border border-amber-200 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100" id="workspace-name" onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Наприклад, Майстерня" value={workspaceName} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-stone-900" htmlFor="workspace-member-name">Ваше ім’я для працівників</label>
            <input className="mt-2 min-h-11 w-full rounded-2xl border border-amber-200 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100" id="workspace-member-name" onChange={(event) => setMemberName(event.target.value)} placeholder="Наприклад, Сергій" value={memberName} />
          </div>
          {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">{error}</p> : null}
          <button className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-amber-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-900 disabled:cursor-wait disabled:opacity-60" disabled={isCreating} type="submit">{isCreating ? "Створюємо…" : "Створити простір"}</button>
        </form>
      </section>
    </div>
  );
}
