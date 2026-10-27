export const localTestItemsStorageKey = "family-wishes-local-test-items";

export function isLocalTestMode() {
  return process.env.NEXT_PUBLIC_TEST_MODE === "true";
}
