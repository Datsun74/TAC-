import { EmptyState } from "@/components/empty-state";
import { PageIntro } from "@/components/page-intro";

export default function PurchasedPage() {
  return (
    <section className="w-full py-10 sm:py-14 lg:py-16">
      <PageIntro
        description="У цьому розділі згодом можна буде переглянути те, що вже придбано."
        eyebrow="Історія"
        title="Куплено"
      />
      <div className="mt-8 max-w-2xl">
        <EmptyState
          actionHref="/purchases"
          actionLabel="Повернутися до покупок"
          description="Поки що тут порожньо. Історію куплених позицій буде додано в одному з наступних етапів."
          icon="✓"
          title="Ще немає куплених позицій"
        />
      </div>
    </section>
  );
}
