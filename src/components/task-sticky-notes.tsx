"use client";

import { useEffect, useState } from "react";

type StickyNote = Readonly<{
  id: string;
  title: string;
  body: string;
  colorIndex: number;
}>;

const storageKey = "zadachnyk.daily-sticky-notes.v1";
const maxNotes = 10;
const colors = [
  "border-amber-200 bg-amber-100/80",
  "border-sky-200 bg-sky-100/80",
  "border-emerald-200 bg-emerald-100/80",
  "border-rose-200 bg-rose-100/80",
  "border-violet-200 bg-violet-100/80",
  "border-orange-200 bg-orange-100/80",
  "border-cyan-200 bg-cyan-100/80",
  "border-lime-200 bg-lime-100/80",
  "border-fuchsia-200 bg-fuchsia-100/80",
  "border-teal-200 bg-teal-100/80",
];

function readNotes(): StickyNote[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.flatMap((note, index): StickyNote[] => {
      if (!note || typeof note !== "object") return [];
      const candidate = note as Record<string, unknown>;
      if (typeof candidate.id !== "string" || typeof candidate.title !== "string" || typeof candidate.body !== "string") return [];
      return [{ id: candidate.id, title: candidate.title.slice(0, 100), body: candidate.body.slice(0, 3000), colorIndex: typeof candidate.colorIndex === "number" ? candidate.colorIndex % colors.length : index % colors.length }];
    }).slice(0, maxNotes);
  } catch {
    return [];
  }
}

function createNote(colorIndex: number): StickyNote {
  return {
    id: window.crypto.randomUUID(),
    title: "",
    body: "",
    colorIndex,
  };
}

export function TaskStickyNotes() {
  const [notes, setNotes] = useState<readonly StickyNote[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setNotes(readNotes());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) window.localStorage.setItem(storageKey, JSON.stringify(notes));
  }, [isLoaded, notes]);

  function updateNote(id: string, field: "title" | "body", value: string) {
    const limit = field === "title" ? 100 : 3000;
    setNotes((current) => current.map((note) => note.id === id ? { ...note, [field]: value.slice(0, limit) } : note));
  }

  function addNote() {
    setNotes((current) => current.length >= maxNotes ? current : [...current, createNote(current.length)]);
  }

  function removeNote(id: string) {
    setNotes((current) => current.filter((note) => note.id !== id));
  }

  return (
    <aside className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto" aria-label="Особисті нотатки">
      <div className="flex items-center justify-between gap-2">
        <div><h2 className="text-sm font-bold text-stone-950">Нотатки</h2><p className="mt-0.5 text-[11px] leading-4 text-stone-500">Лише у цьому браузері · {notes.length}/{maxNotes}</p></div>
        <button className="min-h-8 rounded-lg bg-amber-800 px-2.5 text-xs font-semibold text-white hover:bg-amber-900 disabled:cursor-not-allowed disabled:bg-stone-300" disabled={!isLoaded || notes.length >= maxNotes} onClick={addNote} type="button">+ Нотатка</button>
      </div>
      <p className="mt-3 rounded-xl bg-stone-50 px-3 py-2 text-xs leading-5 text-stone-600">Наприклад: «Віза» — фото, запис, паспорт, страховка. Назву й текст збережемо автоматично.</p>
      <div className="mt-3 space-y-3">
        {notes.map((note, index) => <section className={`rounded-xl border p-3 shadow-sm ${colors[note.colorIndex]}`} key={note.id}>
          <div className="flex items-start gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Назва нотатки {index + 1}</span><input className="w-full border-0 bg-transparent p-0 text-sm font-bold text-stone-950 outline-none placeholder:text-stone-500" onChange={(event) => updateNote(note.id, "title", event.target.value)} placeholder={`Нотатка ${index + 1}`} value={note.title} /></label><button aria-label={`Видалити нотатку ${note.title || index + 1}`} className="-mt-1 shrink-0 rounded-md px-1.5 py-1 text-xs font-bold text-stone-600 hover:bg-white/60 hover:text-red-700" onClick={() => removeNote(note.id)} type="button">×</button></div>
          <label className="mt-2 block"><span className="sr-only">Текст нотатки {note.title || index + 1}</span><textarea className="min-h-20 w-full resize-y border-0 bg-transparent p-0 text-xs leading-5 text-stone-800 outline-none placeholder:text-stone-500" onChange={(event) => updateNote(note.id, "body", event.target.value)} placeholder="Запишіть питання, підзадачі або думки…" value={note.body} /></label>
        </section>)}
        {isLoaded && notes.length === 0 ? <p className="rounded-xl border border-dashed border-stone-300 px-3 py-5 text-center text-xs leading-5 text-stone-500">Праворуч буде до 10 кольорових нотаток.</p> : null}
      </div>
    </aside>
  );
}
