import { redirect } from "next/navigation";

import { JoinTaskWorkspaceForm } from "@/components/join-task-workspace-form";
import { getAuthenticatedUserId } from "@/lib/family-access";
import { isLocalTestMode } from "@/lib/test-mode";

export default async function JoinWorkspacePage({ searchParams }: PageProps<"/join-workspace">) {
  if (isLocalTestMode()) {
    redirect("/tasks/workspaces");
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    redirect("/login");
  }

  const params = await searchParams;
  const initialCode = typeof params.code === "string" ? params.code : "";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10 sm:px-6">
      <section className="w-full rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-9">
        <p className="text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">Запрошення</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">Приєднатися до робочого простору</h1>
        <p className="mt-4 leading-7 text-stone-700">Попросіть власника або менеджера створити код запрошення.</p>
        <JoinTaskWorkspaceForm initialCode={initialCode} />
      </section>
    </main>
  );
}
