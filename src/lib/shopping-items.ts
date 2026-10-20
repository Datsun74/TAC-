import "server-only";

import { requireFamilyMember } from "@/lib/family-access";
import { type ShoppingCategory } from "@/lib/shopping-categories";
import { createClient } from "@/lib/supabase/server";

export type ShoppingItem = Readonly<{
  id: string;
  title: string;
  category: ShoppingCategory;
  storeSection: string;
  quantity: string;
  features: string | null;
  requestedBy: string;
  createdAt: string;
}>;

type ShoppingItemsResult =
  | Readonly<{ items: ShoppingItem[]; error: null }>
  | Readonly<{ items: []; error: string }>;

export async function getActiveShoppingItems(): Promise<ShoppingItemsResult> {
  await requireFamilyMember();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shopping_items")
    .select("id, title, category, store_section, quantity, features, requested_by, created_at")
    .eq("status", "active")
    .order("category")
    .order("store_section")
    .order("created_at", { ascending: false });

  if (error) {
    return { items: [], error: "Не вдалося завантажити список. Спробуйте оновити сторінку." };
  }

  return {
    error: null,
    items: (data ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category as ShoppingCategory,
      storeSection: item.store_section,
      quantity: item.quantity,
      features: item.features,
      requestedBy: item.requested_by,
      createdAt: item.created_at,
    })),
  };
}
