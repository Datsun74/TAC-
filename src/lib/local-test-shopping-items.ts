"use client";

import { isShoppingCategory } from "@/lib/shopping-categories";
import type { ShoppingItem, ShoppingItemStatus } from "@/lib/shopping-item-types";
import { localTestItemsStorageKey } from "@/lib/test-mode";

function getStatus(value: unknown): ShoppingItemStatus {
  return value === "purchased" ? "purchased" : "active";
}

function toShoppingItem(value: unknown): ShoppingItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;

  if (
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    typeof item.category !== "string" ||
    !isShoppingCategory(item.category) ||
    typeof item.storeSection !== "string" ||
    typeof item.quantity !== "string" ||
    (typeof item.features !== "string" && item.features !== null) ||
    typeof item.requestedBy !== "string" ||
    typeof item.createdAt !== "string"
  ) {
    return null;
  }

  const status = getStatus(item.status);
  const purchasedBy = status === "purchased" && typeof item.purchasedBy === "string" ? item.purchasedBy : null;
  const purchasedAt = status === "purchased" && typeof item.purchasedAt === "string" ? item.purchasedAt : null;

  return {
    id: item.id,
    title: item.title,
    category: item.category,
    storeSection: item.storeSection,
    quantity: item.quantity,
    features: item.features,
    requestedBy: item.requestedBy,
    createdAt: item.createdAt,
    status: purchasedBy && purchasedAt ? "purchased" : "active",
    purchasedBy,
    purchasedAt,
  };
}

export function readLocalTestShoppingItems() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(localTestItemsStorageKey) ?? "[]") as unknown;

    return Array.isArray(parsed)
      ? parsed.map(toShoppingItem).filter((item): item is ShoppingItem => item !== null)
      : [];
  } catch {
    return [];
  }
}

export function writeLocalTestShoppingItems(items: ShoppingItem[]) {
  window.localStorage.setItem(localTestItemsStorageKey, JSON.stringify(items));
}
