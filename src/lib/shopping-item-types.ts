import type { ShoppingCategory } from "@/lib/shopping-categories";

export type ShoppingItemStatus = "active" | "purchased";

export type ShoppingItem = Readonly<{
  id: string;
  title: string;
  category: ShoppingCategory;
  storeSection: string;
  quantity: string;
  features: string | null;
  requestedBy: string;
  createdAt: string;
  status: ShoppingItemStatus;
  purchasedBy: string | null;
  purchasedAt: string | null;
}>;

export type ShoppingItemsResult =
  | Readonly<{ items: ShoppingItem[]; error: null }>
  | Readonly<{ items: []; error: string }>;
