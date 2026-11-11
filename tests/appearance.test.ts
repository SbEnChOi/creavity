import test from "node:test";
import assert from "node:assert/strict";
import { preferenceFor, resolveAppearance, readAppearance, saveAppearance, APPEARANCE_KEY } from "../src/lib/appearance";

test("appearance uses the light default and honors only valid explicit choices", () => {
  assert.equal(resolveAppearance(null), "light");
  assert.equal(resolveAppearance("dark"), "dark");
  assert.equal(resolveAppearance("light"), "light");
  assert.equal(resolveAppearance("unexpected"), "light");
  assert.equal(preferenceFor("light"), "dark");
  assert.equal(preferenceFor("dark"), "light");
});

test("appearance persists safely when browser storage is unavailable", () => {
  const values = new Map<string, string>();
  const store = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  assert.equal(saveAppearance(store, "dark"), true);
  assert.equal(values.get(APPEARANCE_KEY), "dark");
  assert.equal(readAppearance(store), "dark");
  assert.equal(readAppearance({ getItem: () => { throw new Error("blocked"); } }), "light");
  assert.equal(saveAppearance({ setItem: () => { throw new Error("blocked"); } }, "dark"), false);
});
