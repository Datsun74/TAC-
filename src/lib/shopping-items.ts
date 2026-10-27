import "server-only";

import { requireFamilyMember } from "@/lib/family-access";
import type { ShoppingCategory } from "@/lib/shopping-categories";
import type { ShoppingItemsResult, ShoppingItemStatus } from "@/lib/shopping-item-types";
import { createClient } from "@/lib/supabase/server";

async function getShoppingItems(status: ShoppingItemStatus): Promise<ShoppingItemsResult> {
  const member = await requireFamilyMember();
  const supabase = await createClient();
  const dateColumn = status === "purchased" ? "purchased_at" : status === "rejected" ? "rejected_at" : "created_at";
  const { data, error } = await supabase
    .from("shopping_items")
    .select("id, title, category, store_section, quantity, features, requested_by, created_at, status, purchased_by, purchased_at, rejected_by, rejected_at")
    .eq("family_id", member.familyId)
    .eq("status", status)
    .order("category")
    .order("store_section")
    .order(dateColumn, { ascending: false });

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
      rejectedBy: item.rejected_by,
      rejectedAt: item.rejected_at,
    })),
  };
}

export function getActiveShoppingItems() {
  return getShoppingItems("active");
}

export function getPurchasedShoppingItems() {
  return getShoppingItems("purchased");
}

export function getRejectedShoppingItems() {
  return getShoppingItems("rejected");
}
