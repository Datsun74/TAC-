import { EmptyState } from "@/components/empty-state";
import { PageIntro } from "@/components/page-intro";

export default function ShoppingPage() {
  return (
    <section className="w-full py-10 sm:py-14 lg:py-16">
      <PageIntro
        description="Тут з’являтиметься короткий список речей для поточного походу в магазин."
        eyebrow="Режим походу"
        title="Я йду в магазин"
      />
      <div className="mt-8 max-w-2xl">
        <EmptyState
          actionHref="/purchases"
          actionLabel="Переглянути покупки"
          description="Поки що тут немає записів. Режим походу в магазин з’явиться після підключення справжнього списку."
          icon="◌"
          title="Список для магазину буде тут"
        />
      </div>
    </section>
  );
}
