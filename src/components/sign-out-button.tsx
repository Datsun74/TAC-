"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSignOut() {
    setIsSigningOut(true);
    setErrorMessage("");

    try {
      const { error } = await createClient().auth.signOut();

      if (error) {
        throw error;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setErrorMessage("Не вдалося вийти. Спробуйте ще раз.");
      setIsSigningOut(false);
    }
  }

  return (
    <div className="mt-6">
      <button
        className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
        disabled={isSigningOut}
        onClick={handleSignOut}
        type="button"
      >
        {isSigningOut ? "Вихід…" : "Вийти з іншого email"}
      </button>
      {errorMessage ? (
        <p aria-live="polite" className="mt-3 text-sm text-red-800">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
