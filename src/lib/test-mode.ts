export const localTestItemsStorageKey = "family-wishes-local-test-items";

export function isLocalTestMode() {
  return process.env.NODE_ENV === "development";
}
