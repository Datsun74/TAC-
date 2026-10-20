"use client";

import { useState, type FormEvent } from "react";

type FormValues = {
  title: string;
  type: string;
  details: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const initialValues: FormValues = {
  title: "",
  type: "",
  details: "",
};

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  if (values.title.trim().length < 2) {
    errors.title = "Вкажіть назву щонайменше з двох символів.";
  }

  if (values.type !== "Покупка" && values.type !== "Побажання") {
    errors.type = "Оберіть тип запису.";
  }

  if (!values.details.trim()) {
    errors.details = "Вкажіть кількість або додайте коротку примітку.";
  }

  return errors;
}

export function AddItemForm() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  function updateValue(field: keyof FormValues, value: string) {
    setValues((currentValues) => ({ ...currentValues, [field]: value }));
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined }));
    setIsSubmitted(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validate(values);
    setErrors(nextErrors);
    setIsSubmitted(Object.keys(nextErrors).length === 0);
  }

  return (
    <form className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8" noValidate onSubmit={handleSubmit}>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-stone-900" htmlFor="title">
            Назва
          </label>
          <p className="mt-1 text-sm text-stone-500" id="title-hint">
            Наприклад, «Кава» або «Книга про космос».
          </p>
          <input
            aria-describedby="title-hint title-error"
            aria-invalid={Boolean(errors.title)}
            autoComplete="off"
            className="mt-3 min-h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
            id="title"
            name="title"
            onChange={(event) => updateValue("title", event.target.value)}
            placeholder="Що хочете додати?"
            type="text"
            value={values.title}
          />
          {errors.title ? (
            <p className="mt-2 text-sm font-medium text-red-700" id="title-error" role="alert">
              {errors.title}
            </p>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-900" htmlFor="type">
            Тип
          </label>
          <select
            aria-describedby="type-error"
            aria-invalid={Boolean(errors.type)}
            className="mt-3 min-h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-950 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
            id="type"
            name="type"
            onChange={(event) => updateValue("type", event.target.value)}
            value={values.type}
          >
            <option disabled value="">
              Оберіть тип
            </option>
            <option value="Покупка">Покупка</option>
            <option value="Побажання">Побажання</option>
          </select>
          {errors.type ? (
            <p className="mt-2 text-sm font-medium text-red-700" id="type-error" role="alert">
              {errors.type}
            </p>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-900" htmlFor="details">
            Кількість або примітка
          </label>
          <p className="mt-1 text-sm text-stone-500" id="details-hint">
            Наприклад, «2 упаковки» або «На подарунок бабусі».
          </p>
          <textarea
            aria-describedby="details-hint details-error"
            aria-invalid={Boolean(errors.details)}
            className="mt-3 w-full resize-y rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-950 outline-none transition focus:border-amber-700 focus:ring-2 focus:ring-amber-100"
            id="details"
            name="details"
            onChange={(event) => updateValue("details", event.target.value)}
            placeholder="Додайте деталі"
            rows={3}
            value={values.details}
          />
          {errors.details ? (
            <p className="mt-2 text-sm font-medium text-red-700" id="details-error" role="alert">
              {errors.details}
            </p>
          ) : null}
        </div>
      </div>

      {isSubmitted ? (
        <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950" role="status">
          Дякуємо! Запис ще не збережено: підключення бази даних буде реалізовано пізніше.
        </p>
      ) : null}

      <button
        className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-amber-800 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-amber-900 focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto"
        type="submit"
      >
        Надіслати для майбутнього збереження
      </button>
    </form>
  );
}
