import "server-only";

import { requireFamilyMember } from "@/lib/family-access";
import type { ShoppingCategory } from "@/lib/shopping-categories";
import type { ShoppingItemsResult, ShoppingItemStatus } from "@/lib/shopping-item-types";
import { createClient } from "@/lib/supabase/server";

async function getShoppingItems(status: ShoppingItemStatus): Promise<ShoppingItemsResult> {
  await requireFamilyMember();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shopping_items")
    .select("id, title, category, store_section, quantity, features, requested_by, created_at, status, purchased_by, purchased_at")
    .eq("status", status)
    .order("category")
    .order("store_section")
    .order(status === "purchased" ? "purchased_at" : "created_at", { ascending: false });

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
      status: item.status as ShoppingItemStatus,
      purchasedBy: item.purchased_by,
      purchasedAt: item.purchased_at,
    })),
  };
}

export function getActiveShoppingItems() {
  return getShoppingItems("active");
}

export function getPurchasedShoppingItems() {
  return getShoppingItems("purchased");
}
