"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { navigationItems } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/client";

type AppShellProps = Readonly<{
  children: React.ReactNode;
  memberName: string;
}>;

export function AppShell({ children, memberName }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  async function handleSignOut() {
    setIsSigningOut(true);
    setSignOutError("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setSignOutError("Не вдалося вийти. Спробуйте ще раз.");
      setIsSigningOut(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between border-b border-stone-200 py-4 sm:py-5">
        <Link className="text-sm font-semibold tracking-tight text-stone-950 sm:text-base" href="/">
          Лист <span className="hidden sm:inline">сімейних побажань</span>
          <span className="sm:hidden">бажань</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <nav aria-label="Основна навігація" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {navigationItems.map((item) => {
                const isCurrent = pathname === item.href;

                return (
                  <li key={item.href}>
                    <Link
                      aria-current={isCurrent ? "page" : undefined}
                      className={`rounded-full px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none ${
                        isCurrent
                          ? "bg-amber-100 text-amber-950"
                          : "text-stone-600 hover:bg-stone-100 hover:text-stone-950"
                      }`}
                      href={item.href}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="flex items-center gap-2 rounded-full bg-stone-100 px-2 py-1.5 sm:px-3">
            <span className="max-w-24 truncate text-xs font-semibold text-stone-700 sm:max-w-36 sm:text-sm">
              <span className="sr-only">Ви увійшли як </span>
              {memberName}
            </span>
            <button
              className="min-h-9 rounded-full px-2 text-xs font-semibold text-stone-600 transition-colors hover:bg-white hover:text-stone-950 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
              disabled={isSigningOut}
              onClick={handleSignOut}
              type="button"
            >
              {isSigningOut ? "Вихід…" : "Вийти"}
            </button>
          </div>
        </div>
      </header>
      {signOutError ? (
        <p aria-live="polite" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {signOutError}
        </p>
      ) : null}
      <main className="flex flex-1">{children}</main>
      <footer className="border-t border-stone-200 py-5 pb-24 text-sm text-stone-500 md:pb-5">
        Створено для сімейних планів.
      </footer>

      <nav
        aria-label="Навігація на телефоні"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white/95 px-2 pt-2 shadow-[0_-8px_24px_rgba(28,25,23,0.08)] backdrop-blur md:hidden"
      >
        <ul className="mx-auto grid max-w-7xl grid-cols-5">
          {navigationItems.map((item) => {
            const isCurrent = pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  aria-current={isCurrent ? "page" : undefined}
                  aria-label={item.label}
                  className={`flex min-h-14 flex-col items-center justify-center rounded-xl px-1 text-center text-[10px] leading-tight font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none ${
                    isCurrent ? "bg-amber-100 text-amber-950" : "text-stone-600 hover:bg-stone-100"
                  }`}
                  href={item.href}
                >
                  <span aria-hidden="true" className="mb-0.5 text-base leading-none">
                    {item.href === "/"
                      ? "⌂"
                      : item.href === "/purchases"
                        ? "≡"
                        : item.href === "/add"
                          ? "+"
                          : item.href === "/shopping"
                            ? "◌"
                            : "✓"}
                  </span>
                  <span>{item.mobileLabel}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
