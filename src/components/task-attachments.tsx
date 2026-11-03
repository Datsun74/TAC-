"use client";

import { useRef, useState, type ChangeEvent } from "react";

import { createClient } from "@/lib/supabase/client";
import type { TaskAttachment, TaskMember } from "@/types/task";

type TaskAttachmentsProps = Readonly<{
  attachments: readonly TaskAttachment[];
  familyId: string;
  taskId: string;
  currentMember: TaskMember;
  testMode: boolean;
}>;

const maximumFileBytes = 6 * 1024 * 1024;
const allowedMediaTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function fileSizeLabel(byteSize: number) {
  if (byteSize < 1024 * 1024) {
    return Math.max(1, Math.round(byteSize / 1024)) + " КБ";
  }

  return (byteSize / (1024 * 1024)).toFixed(1).replace(".", ",") + " МБ";
}

function attachmentFromRow(row: {
  id: string;
  original_name: string;
  media_type: string;
  byte_size: number;
  storage_path: string;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
}): TaskAttachment {
  return {
    id: row.id,
    originalName: row.original_name,
    mediaType: row.media_type,
    byteSize: row.byte_size,
    storagePath: row.storage_path,
    uploadedById: row.uploaded_by,
    uploadedByName: row.uploaded_by_name,
    createdAt: row.created_at,
  };
}

export function TaskAttachments({ attachments, familyId, taskId, currentMember, testMode }: TaskAttachmentsProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<readonly TaskAttachment[]>(attachments);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingDownload, setPendingDownload] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function uploadFile(file: File) {
    if (!allowedMediaTypes.has(file.type)) {
      throw new Error("Дозволені лише фото JPG/PNG/WebP/HEIC, PDF, TXT, Word або Excel.");
    }

    if (file.size === 0 || file.size > maximumFileBytes) {
      throw new Error("Один файл має бути від 1 байта до 6 МБ.");
    }

    const id = window.crypto.randomUUID();
    const storagePath = familyId + "/" + taskId + "/" + id;
    const supabase = createClient();
    const { error: storageError } = await supabase.storage.from("task-files").upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

    if (storageError) {
      throw new Error("Не вдалося завантажити файл.");
    }

    const { data, error: recordError } = await supabase
      .from("task_attachments")
      .insert({
        id,
        task_id: taskId,
        family_id: familyId,
        storage_path: storagePath,
        original_name: file.name,
        media_type: file.type,
        byte_size: file.size,
        uploaded_by: currentMember.id,
        uploaded_by_name: currentMember.name,
      })
      .select("id, original_name, media_type, byte_size, storage_path, uploaded_by, uploaded_by_name, created_at")
      .single();

    if (recordError || !data) {
      await supabase.storage.from("task-files").remove([storagePath]);
      throw new Error("Не вдалося пов’язати файл із задачею. Файл не збережено.");
    }

    setItems((current) => [attachmentFromRow(data), ...current]);
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    setError("");
    setMessage("");

    if (files.length === 0) {
      return;
    }

    if (testMode) {
      setError("У тестовому режимі файли не завантажуються. Увімкніть реальне підключення Supabase.");
      return;
    }

    setIsUploading(true);

    try {
      for (const file of files) {
        await uploadFile(file);
      }
      setMessage(files.length === 1 ? "Файл додано до задачі." : "Файли додано до задачі.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Не вдалося завантажити файл.");
    } finally {
      setIsUploading(false);
    }
  }

  async function downloadAttachment(attachment: TaskAttachment) {
    setPendingDownload(attachment.id);
    setError("");
    const { data, error: downloadError } = await createClient().storage.from("task-files").download(attachment.storagePath);

    if (downloadError || !data) {
      setError("Не вдалося завантажити файл. Перевірте доступ до задачі.");
      setPendingDownload(null);
      return;
    }

    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = attachment.originalName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setPendingDownload(null);
  }

  async function deleteAttachment(attachment: TaskAttachment) {
    setPendingDownload(attachment.id);
    setError("");
    setMessage("");
    const supabase = createClient();
    const { error: storageError } = await supabase.storage.from("task-files").remove([attachment.storagePath]);

    if (storageError) {
      setError("Не вдалося видалити файл.");
      setPendingDownload(null);
      return;
    }

    const { error: recordError } = await supabase.from("task_attachments").delete().eq("id", attachment.id);
    if (recordError) {
      setError("Файл видалено, але запис про нього поки лишився. Спробуйте видалити його ще раз.");
      setPendingDownload(null);
      return;
    }

    setItems((current) => current.filter((item) => item.id !== attachment.id));
    setMessage("Вкладення видалено.");
    setPendingDownload(null);
  }

  return (
    <section className="mt-8 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="attachments-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-stone-950" id="attachments-title">Документи й фото</h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">Фото, PDF, Word або Excel до 6 МБ. Вкладення доступні лише учасникам цієї задачі.</p>
        </div>
        <input
          accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,text/plain,application/msword,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          multiple
          onChange={handleFiles}
          ref={fileInput}
          type="file"
        />
        <button className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-amber-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-900 disabled:cursor-wait disabled:opacity-60" disabled={isUploading} onClick={() => fileInput.current?.click()} type="button">
          {isUploading ? "Завантажуємо…" : "Додати файл"}
        </button>
      </div>

      {message ? <p className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">{message}</p> : null}
      {error ? <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p> : null}

      {items.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-stone-100 px-4 py-4 text-sm leading-6 text-stone-600">До задачі ще не додано вкладень.</p>
      ) : (
        <ul className="mt-6 divide-y divide-stone-100 border-y border-stone-100">
          {items.map((attachment) => (
            <li className="flex items-center justify-between gap-4 py-4" key={attachment.id}>
              <div className="min-w-0">
                <p className="truncate font-semibold text-stone-900">{attachment.originalName}</p>
                <p className="mt-1 text-sm text-stone-500">{fileSizeLabel(attachment.byteSize)} · додав(ла) {attachment.uploadedByName}</p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <button className="min-h-10 rounded-full border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-wait disabled:opacity-60" disabled={pendingDownload === attachment.id} onClick={() => void downloadAttachment(attachment)} type="button">
                  {pendingDownload === attachment.id ? "Готуємо…" : "Завантажити"}
                </button>
                {attachment.uploadedById === currentMember.id ? <button className="min-h-10 rounded-full px-3 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-wait disabled:opacity-60" disabled={pendingDownload === attachment.id} onClick={() => void deleteAttachment(attachment)} type="button">Видалити</button> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
