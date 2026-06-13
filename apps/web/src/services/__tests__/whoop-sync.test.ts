/**
 * Unit tests for the Whoop sync insight flag.
 *
 * The flag lets the insights page auto-run a single analysis after a sync,
 * exactly once per sync, so we verify the consume-and-clear semantics.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { consumeWhoopSyncInsight } from "@/services/whoop-sync";

const SK_SYNC_PENDING_INSIGHT = "whoop_sync_pending_insight";

// Minimal localStorage stub so the test is independent of the DOM environment.
function installLocalStorage(): void {
  const store = new Map<string, string>();
  (globalThis as { localStorage: Storage }).localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe("consumeWhoopSyncInsight", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("returns false when no sync is pending", () => {
    expect(consumeWhoopSyncInsight()).toBe(false);
  });

  it("returns true once after a sync, then clears the flag", () => {
    localStorage.setItem(SK_SYNC_PENDING_INSIGHT, String(Date.now()));

    expect(consumeWhoopSyncInsight()).toBe(true);
    // Second read must not re-fire — the flag is consumed.
    expect(consumeWhoopSyncInsight()).toBe(false);
    expect(localStorage.getItem(SK_SYNC_PENDING_INSIGHT)).toBeNull();
  });
});
