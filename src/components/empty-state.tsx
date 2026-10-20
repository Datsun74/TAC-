import Link from "next/link";

type EmptyStateProps = Readonly<{
  icon: string;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}>;

export function EmptyState({ icon, title, description, actionHref, actionLabel }: EmptyStateProps) {
  return (
    <section className="rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-12 text-center shadow-sm sm:px-12">
      <span aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-2xl text-amber-900">
        {icon}
      </span>
      <h2 className="mt-5 text-xl font-semibold text-stone-950">{title}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stone-600">{description}</p>
      <Link
        className="mt-7 inline-flex min-h-11 items-center justify-center rounded-full bg-amber-800 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-900 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none"
        href={actionHref}
      >
        {actionLabel}
      </Link>
    </section>
  );
}
