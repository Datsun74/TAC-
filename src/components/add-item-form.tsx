"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import {
  getStoreSections,
  isShoppingCategory,
  shoppingCategoryOptions,
  type ShoppingCategory,
} from "@/lib/shopping-categories";
import { readLocalTestShoppingItems, writeLocalTestShoppingItems } from "@/lib/local-test-shopping-items";
import type { ShoppingItem } from "@/lib/shopping-item-types";
import { createClient } from "@/lib/supabase/client";

type FormValues = {
  title: string;
  category: "" | ShoppingCategory;
  storeSection: string;
  customStoreSection: string;
  quantity: string;
  features: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

type SubmissionState = "idle" | "saving" | "success" | "error";

const initialValues: FormValues = {
  title: "",
  category: "",
  storeSection: "",
  customStoreSection: "",
  quantity: "",
  features: "",
};

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (values.title.trim().length < 2) {
    errors.title = "Вкажіть назву щонайменше з двох символів.";
  }

  if (!isShoppingCategory(values.category)) {
    errors.category = "Оберіть основну категорію.";
  }

  if (!values.storeSection) {
    errors.storeSection = "Оберіть відділ магазину.";
  }

  if (values.storeSection === "custom" && values.customStoreSection.trim().length < 2) {
    errors.customStoreSection = "Вкажіть назву відділу щонайменше з двох символів.";
  }

  if (!values.quantity.trim()) {
    errors.quantity = "Вкажіть кількість.";
  }

  return errors;
}

type AddItemFormProps = Readonly<{
  requestedBy: string;
  familyId: string;
  testMode: boolean;
}>;

export function AddItemForm({ requestedBy, familyId, testMode }: AddItemFormProps) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");

  const storeSections = getStoreSections(values.category);

  function updateValue(field: keyof FormValues, value: string) {
    setValues((currentValues) => {
      if (field === "category") {
        return { ...currentValues, category: value as FormValues["category"], storeSection: "", customStoreSection: "" };
      }

      return { ...currentValues, [field]: value };
    });
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
    setSubmissionState("idle");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validate(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || !isShoppingCategory(values.category)) {
      return;
    }

    setSubmissionState("saving");
    const storeSection = values.storeSection === "custom" ? values.customStoreSection.trim() : values.storeSection;

    if (testMode) {
      const item: ShoppingItem = {
        id: window.crypto.randomUUID(),
        title: values.title.trim(),
        category: values.category,
        storeSection,
        quantity: values.quantity.trim(),
        features: values.features.trim() || null,
        requestedBy,
        createdAt: new Date().toISOString(),
        status: "active",
        purchasedBy: null,
        purchasedAt: null,
        rejectedBy: null,
        rejectedAt: null,
      };

      writeLocalTestShoppingItems([...readLocalTestShoppingItems(), item]);

      setValues(initialValues);
      setSubmissionState("success");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from("shopping_items").insert({
      title: values.title.trim(),
      item_type: "purchase",
      category: values.category,
      store_section: storeSection,
      quantity: values.quantity.trim(),
      features: values.features.trim() || null,
      requested_by: requestedBy,
      family_id: familyId,
    });

    if (error) {
      setSubmissionState("error");
      return;
    }

    setValues(initialValues);
    setSubmissionState("success");
  }

  return (
    <form className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8" noValidate onSubmit={handleSubmit}>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-stone-900" htmlFor="title">
            Назва
          </label>
          <p className="mt-1 text-sm text-stone-500" id="title-hint">
            Наприклад, «Шампунь» або «Фарба для стін».
          </p>
          <input
            aria-describedby="title-hint title-error"
            aria-invalid={Boolean(errors.title)}
            autoComplete="off"
            className="mt-3 min-h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
            id="title"
            name="title"
            onChange={(event) => updateValue("title", event.target.value)}
            placeholder="Що потрібно додати?"
            type="text"
            value={values.title}
          />
          {errors.title ? <p className="mt-2 text-sm font-medium text-red-700" id="title-error" role="alert">{errors.title}</p> : null}
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-900" htmlFor="category">
            Категорія
          </label>
          <select
            aria-describedby="category-error"
            aria-invalid={Boolean(errors.category)}
            className="mt-3 min-h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
            id="category"
            name="category"
            onChange={(event) => updateValue("category", event.target.value)}
            value={values.category}
          >
            <option disabled value="">Оберіть категорію</option>
            {shoppingCategoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {errors.category ? <p className="mt-2 text-sm font-medium text-red-700" id="category-error" role="alert">{errors.category}</p> : null}
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-900" htmlFor="storeSection">
            Відділ магазину
          </label>
          <select
            aria-describedby="store-section-error"
            aria-invalid={Boolean(errors.storeSection)}
            className="mt-3 min-h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-stone-100"
            disabled={!values.category}
            id="storeSection"
            name="storeSection"
            onChange={(event) => updateValue("storeSection", event.target.value)}
            value={values.storeSection}
          >
            <option disabled value="">{values.category ? "Оберіть відділ" : "Спершу оберіть категорію"}</option>
            {storeSections.map((section) => <option key={section} value={section}>{section}</option>)}
            <option value="custom">Інший відділ — ввести назву</option>
          </select>
          {errors.storeSection ? <p className="mt-2 text-sm font-medium text-red-700" id="store-section-error" role="alert">{errors.storeSection}</p> : null}
          {values.storeSection === "custom" ? (
            <div className="mt-4">
              <label className="block text-sm font-semibold text-stone-900" htmlFor="customStoreSection">
                Назва іншого відділу
              </label>
              <input
                aria-describedby="custom-store-section-error"
                aria-invalid={Boolean(errors.customStoreSection)}
                autoComplete="off"
                className="mt-2 min-h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
                id="customStoreSection"
                name="customStoreSection"
                onChange={(event) => updateValue("customStoreSection", event.target.value)}
                placeholder="Наприклад, Цегла"
                type="text"
                value={values.customStoreSection}
              />
              {errors.customStoreSection ? <p className="mt-2 text-sm font-medium text-red-700" id="custom-store-section-error" role="alert">{errors.customStoreSection}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-stone-900" htmlFor="quantity">
              Кількість
            </label>
            <input
              aria-describedby="quantity-hint quantity-error"
              aria-invalid={Boolean(errors.quantity)}
              autoComplete="off"
              className="mt-3 min-h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
              id="quantity"
              name="quantity"
              onChange={(event) => updateValue("quantity", event.target.value)}
              placeholder="Наприклад, 2 шт. або 1 л"
              type="text"
              value={values.quantity}
            />
            <p className="mt-1 text-sm text-stone-500" id="quantity-hint">Скільки потрібно купити.</p>
            {errors.quantity ? <p className="mt-2 text-sm font-medium text-red-700" id="quantity-error" role="alert">{errors.quantity}</p> : null}
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-900" htmlFor="requestedBy">
              Хто замовив
            </label>
            <p className="mt-3 flex min-h-12 items-center rounded-2xl bg-stone-100 px-4 text-base font-medium text-stone-800" id="requestedBy">
              {requestedBy}
            </p>
            <p className="mt-1 text-sm text-stone-500">Ім’я додається автоматично з вашого профілю.</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-900" htmlFor="features">
            Особливості <span className="font-normal text-stone-500">(необов’язково)</span>
          </label>
          <textarea
            className="mt-3 w-full resize-y rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-950 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
            id="features"
            name="features"
            onChange={(event) => updateValue("features", event.target.value)}
            placeholder="Бренд, колір, розмір або інша важлива деталь"
            rows={3}
            value={values.features}
          />
        </div>
      </div>

      {submissionState === "success" ? (
        <p className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950" role="status">
          {testMode ? "Тестовий запис збережено у цьому браузері." : "Запис збережено у спільному списку."} <Link className="font-semibold underline" href="/purchases">Переглянути покупки</Link>
        </p>
      ) : null}
      {submissionState === "error" ? (
        <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900" role="alert">
          Не вдалося зберегти запис. Перевірте інтернет-з’єднання та спробуйте ще раз.
        </p>
      ) : null}

      <button
        className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-amber-800 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-amber-900 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        disabled={submissionState === "saving"}
        type="submit"
      >
        {submissionState === "saving" ? "Зберігаємо…" : "Додати до спільного списку"}
      </button>
    </form>
  );
}
