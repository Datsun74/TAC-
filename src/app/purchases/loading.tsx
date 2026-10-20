export default function PurchasesLoading() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16" aria-label="Завантаження покупок">
      <div className="h-4 w-32 animate-pulse rounded bg-amber-100" />
      <div className="mt-4 h-10 w-56 animate-pulse rounded-xl bg-stone-200" />
      <div className="mt-4 h-6 max-w-xl animate-pulse rounded bg-stone-100" />
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="h-56 animate-pulse rounded-3xl bg-white shadow-sm" />
        <div className="h-56 animate-pulse rounded-3xl bg-white shadow-sm" />
      </div>
    </section>
  );
}
