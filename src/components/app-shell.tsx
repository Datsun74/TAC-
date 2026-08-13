import Link from "next/link";

import { navigationItems } from "@/lib/navigation";

type AppShellProps = Readonly<{
  children: React.ReactNode;
}>;

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between border-b border-stone-200 py-5">
        <Link className="text-sm font-semibold tracking-tight text-stone-950 sm:text-base" href="/">
          Лист сімейних побажань
        </Link>
        <nav aria-label="Майбутня навігація" className="hidden items-center gap-5 md:flex">
          {navigationItems.map((item) => (
            <span className="text-sm text-stone-500" key={item.label}>
              {item.label}
            </span>
          ))}
        </nav>
      </header>
      <main className="flex flex-1">{children}</main>
      <footer className="border-t border-stone-200 py-5 text-sm text-stone-500">
        Створено для сімейних планів.
      </footer>
    </div>
  );
}
