"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { navigationItems } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/client";
import type { NavigationItem } from "@/types/navigation";

type AppShellProps = Readonly<{
  children: React.ReactNode;
  memberName: string;
  familyName: string;
  testMode?: boolean;
  navigation?: readonly NavigationItem[];
  productName?: string;
  footerText?: string;
  spaceHref?: string;
  spaceAriaLabel?: string;
}>;

function mobileIcon(href: string) {
  if (href === "/") return "⌂";
  if (href === "/purchases") return "≡";
  if (href === "/add") return "+";
  if (href === "/shopping") return "◌";
  if (href === "/purchased") return "✓";
  if (href === "/tasks") return "⌂";
  if (href === "/tasks/mine") return "●";
  if (href === "/tasks/list") return "≡";
  if (href === "/tasks/board") return "▦";
  if (href === "/tasks/add") return "+";
  if (href === "/tasks/history") return "✓";
  if (href === "/tasks/projects") return "▣";
  return "×";
}

export function AppShell({
  children,
  memberName,
  familyName,
  testMode = false,
  navigation = navigationItems,
  productName = "Сімейні покупки",
  footerText = "Створено для сімейних планів.",
  spaceHref = "/family",
  spaceAriaLabel = "Керувати сімейним простором",
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const mobileGridClassName = navigation.length === 4 ? "grid-cols-4" : navigation.length === 5 ? "grid-cols-5" : navigation.length === 7 ? "grid-cols-7" : "grid-cols-6";

  async function handleSignOut() {
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
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between border-b border-stone-200 py-4 sm:py-5">
        <Link className="text-sm font-semibold tracking-tight text-stone-950 sm:text-base" href="/">{productName}</Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <nav aria-label="Основна навігація" className="hidden lg:block"><ul className="flex items-center gap-1">{navigation.map((item) => { const isCurrent = pathname === item.href; return <li key={item.href}><Link aria-current={isCurrent ? "page" : undefined} className={`rounded-full px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none ${isCurrent ? "bg-amber-100 text-amber-950" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950"}`} href={item.href}>{item.label}</Link></li>; })}</ul></nav>
          <div className="flex items-center gap-2 rounded-full bg-stone-100 px-2 py-1.5 sm:px-3">
            <Link aria-label={spaceAriaLabel} className="max-w-20 truncate text-xs font-semibold text-stone-700 underline-offset-2 hover:underline sm:max-w-32 sm:text-sm" href={spaceHref}>{familyName}</Link>
            <span className="hidden h-4 border-l border-stone-300 sm:block" />
            <span className="max-w-20 truncate text-xs font-semibold text-stone-700 sm:max-w-28 sm:text-sm"><span className="sr-only">Ви увійшли як </span>{memberName}</span>
            {testMode ? <span className="px-1 text-xs font-semibold text-amber-800">Тест</span> : <button className="min-h-9 rounded-full px-2 text-xs font-semibold text-stone-600 transition-colors hover:bg-white hover:text-stone-950 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60" disabled={isSigningOut} onClick={handleSignOut} type="button">{isSigningOut ? "Вихід…" : "Вийти"}</button>}
          </div>
        </div>
      </header>
      {testMode ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950">Тестовий режим: вхід вимкнено лише на цьому комп’ютері. Нові заявки зберігаються у цьому браузері, а не в Supabase.</p> : null}
      {signOutError ? <p aria-live="polite" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{signOutError}</p> : null}
      <main className="flex flex-1">{children}</main>
      <footer className="border-t border-stone-200 py-5 pb-24 text-sm text-stone-500 lg:pb-5">{footerText}</footer>
      <nav aria-label="Навігація на телефоні" className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white/95 px-1 pt-2 shadow-[0_-8px_24px_rgba(28,25,23,0.08)] backdrop-blur lg:hidden"><ul className={`mx-auto grid max-w-7xl ${mobileGridClassName}`}>{navigation.map((item) => { const isCurrent = pathname === item.href; return <li key={item.href}><Link aria-current={isCurrent ? "page" : undefined} aria-label={item.label} className={`flex min-h-14 flex-col items-center justify-center rounded-xl px-0.5 text-center text-[9px] leading-tight font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none ${isCurrent ? "bg-amber-100 text-amber-950" : "text-stone-600 hover:bg-stone-100"}`} href={item.href}><span aria-hidden="true" className="mb-0.5 text-base leading-none">{mobileIcon(item.href)}</span><span>{item.mobileLabel}</span></Link></li>; })}</ul></nav>
    </div>
  );
}
