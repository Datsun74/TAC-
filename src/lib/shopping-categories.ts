export const shoppingCategoryValues = ["groceries", "cosmetics", "building", "other"] as const;

export type ShoppingCategory = (typeof shoppingCategoryValues)[number];

export const shoppingCategoryOptions: ReadonlyArray<{
  value: ShoppingCategory;
  label: string;
  sections: readonly string[];
}> = [
  {
    value: "groceries",
    label: "Продукти",
    sections: ["Молочні вироби", "Овочі та фрукти", "Бакалія", "Напої", "Алкоголь", "ЗОЖ-товари"],
  },
  {
    value: "cosmetics",
    label: "Косметика",
    sections: ["Догляд за волоссям", "Догляд за обличчям", "Догляд за тілом", "Побутова хімія", "Декоративна косметика"],
  },
  {
    value: "building",
    label: "Будівництво",
    sections: ["Фарби та оздоблення", "Інструменти", "Електрика", "Сантехніка", "Кріплення"],
  },
  {
    value: "other",
    label: "Інше",
    sections: ["Дім", "Одяг", "Тварини", "Аптека", "Інше"],
  },
];

export const shoppingCategoryLabels: Record<ShoppingCategory, string> = {
  groceries: "Продукти",
  cosmetics: "Косметика",
  building: "Будівництво",
  other: "Інше",
};

export function isShoppingCategory(value: string): value is ShoppingCategory {
  return shoppingCategoryValues.includes(value as ShoppingCategory);
}

export function getStoreSections(category: ShoppingCategory | "") {
  return shoppingCategoryOptions.find((option) => option.value === category)?.sections ?? [];
}
