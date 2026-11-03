"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/client";

export function MagicLinkForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCooldownSeconds((currentSeconds) => Math.max(0, currentSeconds - 1));
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  async function sendCode(normalizedEmail: string) {
    setIsSubmitting(true);
    setErrorMessage("");
    setMessage("");

    try {
      const { error } = await createClient().auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) {
        throw error;
      }

      setVerificationEmail(normalizedEmail);
      setVerificationCode("");
      setMessage("Код надіслано. Відкрийте найновіший лист і введіть код нижче. Якщо листа немає — перевірте «Спам» і «Усі листи»; для Gmail доставка іноді займає кілька хвилин.");
      setCooldownSeconds(60);
    } catch (error) {
      const technicalMessage = error instanceof Error ? error.message : "";
      const isRateLimited = /rate limit|too many|over_email_send_rate_limit/i.test(technicalMessage);

      setErrorMessage(
        isRateLimited
          ? "Надсилання кодів тимчасово обмежено. Зачекайте хвилину та спробуйте ще раз."
          : "Не вдалося надіслати код. Перевірте email або спробуйте через хвилину.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
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

    await sendCode(normalizedEmail);
  }

  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = verificationCode.replace(/\s/g, "");

    if (!/^\d{6,8}$/.test(token)) {
      setErrorMessage("Введіть код із листа повністю.");
      setMessage("");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setMessage("");

    try {
      const response = await fetch("/auth/verify", {
        body: JSON.stringify({ email: verificationEmail, token }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const result: { ok?: boolean; error?: string } | null = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        setErrorMessage(
          result?.error === "otp_expired"
            ? "Код уже використано або строк його дії минув. Надішліть новий код."
            : "Код не підійшов. Перевірте найновіший лист або надішліть код повторно.",
        );
        return;
      }

      router.replace("/");
    } catch {
      setErrorMessage("Не вдалося підтвердити код. Перевірте інтернет-з’єднання й спробуйте ще раз.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {verificationEmail ? (
        <form className="mt-8 space-y-5" noValidate onSubmit={handleCodeSubmit}>
          <div>
            <p className="text-sm leading-6 text-stone-600">
              Код надіслано на <span className="font-semibold text-stone-900">{verificationEmail}</span>.
            </p>
            <label className="mt-4 block text-sm font-semibold text-stone-800" htmlFor="verification-code">
              Код із листа
            </label>
            <input
              autoComplete="one-time-code"
              className="mt-2 min-h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-center text-xl font-semibold tracking-[0.35em] text-stone-950 shadow-sm outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-200"
              id="verification-code"
              inputMode="numeric"
              maxLength={8}
              onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ""))}
              placeholder="12345678"
              required
              value={verificationCode}
            />
          </div>
          <button
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-amber-800 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-amber-900 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Перевіряємо…" : "Підтвердити код і увійти"}
          </button>
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold">
            <button
              className="text-amber-800 underline-offset-4 hover:underline disabled:cursor-wait disabled:opacity-60"
              disabled={isSubmitting || cooldownSeconds > 0}
              onClick={() => void sendCode(verificationEmail)}
              type="button"
            >
              {cooldownSeconds > 0 ? `Повторно через ${cooldownSeconds} с` : "Надіслати код повторно"}
            </button>
            <button
              className="text-stone-600 underline-offset-4 hover:underline"
              onClick={() => {
                setVerificationEmail("");
                setVerificationCode("");
                setMessage("");
                setErrorMessage("");
              }}
              type="button"
            >
              Змінити email
            </button>
          </div>
        </form>
      ) : (
        <form className="mt-8 space-y-5" noValidate onSubmit={handleEmailSubmit}>
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
            disabled={isSubmitting || cooldownSeconds > 0}
            type="submit"
          >
            {isSubmitting ? "Надсилаємо…" : cooldownSeconds > 0 ? `Повторно через ${cooldownSeconds} с` : "Надіслати код для входу"}
          </button>
        </form>
      )}
      {message ? (
        <p aria-live="polite" className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
          {message}
        </p>
      ) : null}
      {errorMessage ? (
        <p aria-live="assertive" className="mt-5 rounded-2xl bg-red-50 p-4 text-sm leading-6 text-red-800">
          {errorMessage}
        </p>
      ) : null}
    </>
  );
}
