import { FamilyAppShell } from "@/components/family-app-shell";
import { PageIntro } from "@/components/page-intro";
import { ShoppingTrip } from "@/components/shopping-trip";
import { requireFamilyMember } from "@/lib/family-access";
import { getActiveShoppingItems } from "@/lib/shopping-items";
import { isLocalTestMode } from "@/lib/test-mode";

export default async function ShoppingPage() {
  const member = await requireFamilyMember();
  const testMode = isLocalTestMode();
  const result = testMode ? null : await getActiveShoppingItems();

  return (
    <FamilyAppShell>
      <section className="w-full py-10 sm:py-14 lg:py-16">
        <PageIntro
          description="Оберіть категорію, пройдіться відділами магазину та позначайте товари купленими."
          eyebrow="Режим походу"
          title="Я йду в магазин"
        />
        {result?.error ? (
          <section className="mt-8 rounded-3xl border border-red-200 bg-red-50 px-6 py-8 text-center"><h2 className="text-lg font-semibold text-red-950">Список поки недоступний</h2><p className="mt-2 text-sm text-red-800">{result.error}</p></section>
        ) : (
          <ShoppingTrip initialItems={result?.items ?? []} memberName={member.displayName} testMode={testMode} />
        )}
      </section>
    </FamilyAppShell>
  );
}
