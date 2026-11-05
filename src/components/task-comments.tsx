"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import type { TaskComment } from "@/types/task";

type TaskCommentsProps = Readonly<{
  currentUserName: string;
  initialComments: readonly TaskComment[];
  setupError: string | null;
  taskId: string;
}>;

function formatCommentTime(value: string) {
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Kyiv" }).format(new Date(value));
}

function mapComment(comment: { id: string; author_name: string; body: string; created_at: string }): TaskComment {
  return { id: comment.id, authorName: comment.author_name, body: comment.body, createdAt: comment.created_at };
}

export function TaskComments({ currentUserName, initialComments, setupError, taskId }: TaskCommentsProps) {
  const router = useRouter();
  const [comments, setComments] = useState<readonly TaskComment[]>(initialComments);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const featureAvailable = setupError === null;

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedBody = body.trim();

    if (normalizedBody.length === 0) {
      setError("Напишіть коментар перед надсиланням.");
      return;
    }
    if (normalizedBody.length > 2000) {
      setError("Коментар може містити до 2 000 символів.");
      return;
    }

    setError("");
    setIsSending(true);
    const { data, error: insertError } = await createClient()
      .from("task_comments")
      .insert({ task_id: taskId, author_name: currentUserName, body: normalizedBody })
      .select("id, author_name, body, created_at")
      .single();

    if (insertError || !data) {
      setError("Не вдалося додати коментар. Спробуйте ще раз.");
      setIsSending(false);
      return;
    }

    setComments((current) => [...current, mapComment(data)]);
    setBody("");
    setIsSending(false);
    router.refresh();
  }

  return (
    <section className="mt-8 max-w-3xl rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8" aria-labelledby="task-comments-heading">
      <p className="text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">Спільна робота</p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-950" id="task-comments-heading">Коментарі</h2>
      <p className="mt-1 text-sm leading-6 text-stone-600">Залишайте тут короткі уточнення, результати дзвінків або домовленості по задачі.</p>

      {setupError ? <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900" role="status">{setupError}</p> : null}
      {error ? <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-800" role="alert">{error}</p> : null}

      {comments.length > 0 ? (
        <ol className="mt-5 divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200">
          {comments.map((comment) => <li className="px-4 py-3" key={comment.id}><div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><p className="text-sm font-semibold text-stone-900">{comment.authorName}</p><time className="text-xs text-stone-500" dateTime={comment.createdAt}>{formatCommentTime(comment.createdAt)}</time></div><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-700">{comment.body}</p></li>)}
        </ol>
      ) : <p className="mt-5 rounded-2xl bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">Коментарів поки немає.</p>}

      <form className="mt-5" onSubmit={addComment}>
        <label className="sr-only" htmlFor="task-comment-body">Новий коментар</label>
        <textarea className="min-h-24 w-full resize-y rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm leading-6 text-stone-950 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-stone-100" disabled={!featureAvailable || isSending} id="task-comment-body" maxLength={2000} onChange={(event) => { setBody(event.target.value); setError(""); }} placeholder="Наприклад: домовились отримати кошторис до п’ятниці." rows={3} value={body} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-stone-500">{body.length} / 2000</p><button className="min-h-10 rounded-full bg-amber-800 px-5 text-sm font-semibold text-white transition-colors hover:bg-amber-900 disabled:cursor-not-allowed disabled:opacity-60" disabled={!featureAvailable || isSending} type="submit">{isSending ? "Надсилаємо…" : "Додати коментар"}</button></div>
      </form>
    </section>
  );
}
