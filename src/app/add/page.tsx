import { AddItemForm } from "@/components/add-item-form";
import { PageIntro } from "@/components/page-intro";

export default function AddPage() {
  return (
    <section className="w-full py-10 sm:py-14 lg:py-16">
      <PageIntro
        description="Заповніть коротку форму. На цьому етапі вона перевіряє дані у браузері, але нічого не записує."
        eyebrow="Новий запис"
        title="Додати до списку"
      />
      <div className="mt-8 max-w-2xl">
        <AddItemForm />
      </div>
    </section>
  );
}
