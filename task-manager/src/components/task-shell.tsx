"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "../../../src/lib/supabase/client";

type TaskShellProps = Readonly<{
  children: React.ReactNode;
  displayName: string;
  spaceName: string;
  testMode: boolean;
}>;

const navigation = [
  { href: "/tasks", label: "Сьогодні", mobileLabel: "Сьогодні", symbol: "⌂" },
  { href: "/tasks/list", label: "Усі задачі", mobileLabel: "Усі", symbol: "≡" },
  { href: "/tasks/add", label: "Нова задача", mobileLabel: "Додати", symbol: "+" },
  { href: "/tasks/history", label: "Історія", mobileLabel: "Історія", symbol: "✓" },
  { href: "/tasks/workspaces", label: "Простори", mobileLabel: "Простори", symbol: "◌" },
] as const;

export function TaskShell({ children, displayName, spaceName, testMode }: TaskShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  async function signOut() {
    setIsSigningOut(true);
    setSignOutError("");

    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      router.replace("/login");
      router.refresh();
    } catch {
      setSignOutError("Не вдалося вийти. Спробуйте ще раз.");
      setIsSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link className="shrink-0 text-xl font-bold tracking-tight text-stone-950" href="/tasks">Задачник</Link>
          <nav aria-label="Основна навігація" className="hidden items-center gap-1 lg:flex">
            {navigation.map((item) => {
              const isCurrent = pathname === item.href;
              return (
                <Link
                  aria-current={isCurrent ? "page" : undefined}
                  className={`rounded-full px-3 py-2 text-sm font-semibold transition ${isCurrent ? "bg-amber-100 text-amber-950" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950"}`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link className="hidden max-w-36 truncate rounded-full bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-200 sm:block" href="/tasks/workspaces">
              {spaceName}
            </Link>
            <span className="hidden max-w-28 truncate text-sm font-semibold text-stone-700 sm:block">{displayName}</span>
            {testMode ? <span className="rounded-full bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900">Тест</span> : (
              <button className="rounded-full border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-100 disabled:cursor-wait disabled:opacity-60" disabled={isSigningOut} onClick={() => void signOut()} type="button">
                {isSigningOut ? "Вихід…" : "Вийти"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto min-h-[calc(100vh-148px)] max-w-6xl px-4 py-8 pb-28 sm:px-6 lg:pb-8">{children}</main>

      {signOutError ? <p aria-live="assertive" className="fixed right-4 bottom-24 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800 shadow-lg lg:bottom-4">{signOutError}</p> : null}
      <nav aria-label="Навігація на телефоні" className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 px-1 py-2 shadow-[0_-8px_24px_rgba(28,25,23,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {navigation.map((item) => {
            const isCurrent = pathname === item.href;
            return (
              <Link aria-current={isCurrent ? "page" : undefined} className={`flex min-h-12 flex-col items-center justify-center rounded-xl px-1 text-center text-[10px] font-bold leading-tight ${isCurrent ? "bg-amber-100 text-amber-950" : "text-stone-600"}`} href={item.href} key={item.href}>
                <span aria-hidden="true" className="text-base leading-none">{item.symbol}</span>
                <span className="mt-1">{item.mobileLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
