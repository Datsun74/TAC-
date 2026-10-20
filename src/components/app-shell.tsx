"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navigationItems } from "@/lib/navigation";

type AppShellProps = Readonly<{
  children: React.ReactNode;
}>;

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between border-b border-stone-200 py-4 sm:py-5">
        <Link className="text-sm font-semibold tracking-tight text-stone-950 sm:text-base" href="/">
          Лист <span className="hidden sm:inline">сімейних побажань</span>
          <span className="sm:hidden">бажань</span>
        </Link>
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
      </header>
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
