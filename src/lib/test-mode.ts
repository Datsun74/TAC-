export const localTestItemsStorageKey = "family-wishes-local-test-items";
export const localTestTasksStorageKey = "family-wishes-local-test-tasks";

export function isLocalTestMode() {
  return process.env.NEXT_PUBLIC_TEST_MODE === "true";
}
