import { EmptyState } from "@/components/empty-state";
import { FamilyAppShell } from "@/components/family-app-shell";
import { PageIntro } from "@/components/page-intro";

export default async function ShoppingPage() {
  return (
    <FamilyAppShell>
      <section className="w-full py-10 sm:py-14 lg:py-16">
      <PageIntro
        description="Тут з’явиться короткий список активних покупок для поточного походу в магазин."
        eyebrow="Режим походу"
        title="Я йду в магазин"
      />
      <div className="mt-8 max-w-2xl">
        <EmptyState
          actionHref="/purchases"
          actionLabel="Переглянути покупки"
          description="Режим походу в магазин з позначками «Куплено» буде додано на наступному етапі."
          icon="◌"
          title="Список для магазину буде тут"
        />
      </div>
      </section>
    </FamilyAppShell>
  );
}
