import Link from "next/link";
import { redirect } from "next/navigation";

import { MagicLinkForm } from "@/components/magic-link-form";
import { isLocalTestMode } from "@/lib/test-mode";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>;
}) {
  if (isLocalTestMode()) {
    redirect("/");
  }

  const { auth } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10 sm:px-6">
      <section className="w-full rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-9">
        <p className="text-sm font-semibold tracking-[0.16em] text-amber-800 uppercase">Задачник</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">Вхід до Задачника</h1>
        <p className="mt-4 leading-7 text-stone-600">
          Пароль не потрібен. Ми надішлемо одноразовий код на ваш email. Інші учасники бачитимуть лише ваше ім&apos;я, а не email.
        </p>
        {auth === "failed" ? (
          <p aria-live="assertive" className="mt-5 rounded-2xl bg-red-50 p-4 text-sm leading-6 text-red-800">
            Вхід не підтвердився. Введіть код із найновішого листа або надішліть новий код після завершення відліку.
          </p>
        ) : null}
        <MagicLinkForm />
        <p className="mt-6 text-sm leading-6 text-stone-500">
          Перший вхід нового учасника потребує підтвердження доступу.
        </p>
        <Link className="mt-5 inline-flex text-sm font-semibold text-amber-800 underline-offset-4 hover:underline" href="/">
          Повернутися на головну
        </Link>
      </section>
    </main>
  );
}
