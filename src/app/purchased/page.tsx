import { FamilyAppShell } from "@/components/family-app-shell";
import { PageIntro } from "@/components/page-intro";
import { PurchasedHistory } from "@/components/purchased-history";
import { requireFamilyMember } from "@/lib/family-access";
import { getPurchasedShoppingItems } from "@/lib/shopping-items";
import { isLocalTestMode } from "@/lib/test-mode";

export default async function PurchasedPage() {
  const member = await requireFamilyMember();
  const testMode = isLocalTestMode();
  const result = testMode ? null : await getPurchasedShoppingItems();

  return (
    <FamilyAppShell>
      <section className="w-full py-10 sm:py-14 lg:py-16">
        <PageIntro
          description="Тут зберігається історія придбаних товарів: хто їх купив і коли."
          eyebrow="Історія"
          title="Куплено"
        />
        {result?.error ? (
          <section className="mt-8 rounded-3xl border border-red-200 bg-red-50 px-6 py-8 text-center"><h2 className="text-lg font-semibold text-red-950">Історія поки недоступна</h2><p className="mt-2 text-sm text-red-800">{result.error}</p></section>
        ) : (
          <PurchasedHistory familyId={member.familyId} initialItems={result?.items ?? []} testMode={testMode} />
        )}
      </section>
    </FamilyAppShell>
  );
}
