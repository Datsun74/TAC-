import { AddItemForm } from "@/components/add-item-form";
import { FamilyAppShell } from "@/components/family-app-shell";
import { PageIntro } from "@/components/page-intro";
import { requireFamilyMember } from "@/lib/family-access";
import { isLocalTestMode } from "@/lib/test-mode";

export default async function AddPage() {
  const member = await requireFamilyMember();

  return (
    <FamilyAppShell>
      <section className="w-full py-10 sm:py-14 lg:py-16">
        <PageIntro
          description="Заповніть коротку форму. Запис одразу збережеться у спільному сімейному списку."
          eyebrow="Новий запис"
          title="Додати до списку"
        />
        <div className="mt-8 max-w-2xl">
          <AddItemForm familyId={member.familyId} requestedBy={member.displayName} testMode={isLocalTestMode()} />
        </div>
      </section>
    </FamilyAppShell>
  );
}
