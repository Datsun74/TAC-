"use client";

import { type FormEvent, useState } from "react";

import { isSupabaseConfigured } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/client";

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setErrorMessage("Введіть коректну email-адресу.");
      setMessage("");
      return;
    }

    if (!isSupabaseConfigured) {
      setErrorMessage("Вхід ще не налаштовано. Перевірте змінні Supabase у проєкті.");
      setMessage("");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setMessage("");

    try {
      const { error } = await createClient().auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          shouldCreateUser: true,
        },
      });

      if (error) {
        throw error;
      }

      setMessage("Посилання надіслано. Відкрийте лист у цьому браузері протягом години.");
    } catch (error) {
      const technicalMessage = error instanceof Error ? error.message : "";
      const isRateLimited = /rate limit|too many|over_email_send_rate_limit/i.test(technicalMessage);

      setErrorMessage(
        isRateLimited
          ? "Supabase тимчасово обмежив надсилання листів. Зачекайте приблизно годину та надішліть лише одне нове посилання."
          : "Не вдалося надіслати посилання. Перевірте email або спробуйте через хвилину.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit}>
      <div>
        <label className="block text-sm font-semibold text-stone-800" htmlFor="email">
          Ваш email
        </label>
        <input
          autoComplete="email"
          className="mt-2 min-h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-950 shadow-sm outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-200"
          id="email"
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
          required
          type="email"
          value={email}
        />
      </div>
      <button
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-amber-800 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-amber-900 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Надсилаємо…" : "Надіслати посилання для входу"}
      </button>
      {message ? (
        <p aria-live="polite" className="rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
          {message}
        </p>
      ) : null}
      {errorMessage ? (
        <p aria-live="assertive" className="rounded-2xl bg-red-50 p-4 text-sm leading-6 text-red-800">
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
