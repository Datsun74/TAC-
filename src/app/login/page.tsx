import Link from "next/link";

import { MagicLinkForm } from "@/components/magic-link-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10 sm:px-6">
      <section className="w-full rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-9">
        <p className="text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">Спільний простір</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">Вхід до сімейного списку</h1>
        <p className="mt-4 leading-7 text-stone-600">
          Пароль не потрібен. Ми надішлемо одноразове посилання на ваш email. У списку буде видно лише ваше ім&apos;я, а не email.
        </p>
        <MagicLinkForm />
        <p className="mt-6 text-sm leading-6 text-stone-500">
          Перший вхід нового члена сім&apos;ї потребує підтвердження доступу.
        </p>
        <Link className="mt-5 inline-flex text-sm font-semibold text-amber-800 underline-offset-4 hover:underline" href="/">
          Повернутися на головну
        </Link>
      </section>
    </main>
  );
}
