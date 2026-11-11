import test from "node:test";
import assert from "node:assert/strict";
import { CARD_COLORS, cardColor, cardAppearance } from "../src/lib/card-colors";

test("user-selected card colors keep the saved value and adapt to appearance", () => {
  assert.equal(cardColor("blue"), "blue");
  assert.equal(cardColor("unknown"), "neutral");
  assert.deepEqual(cardAppearance("blue", "light"), CARD_COLORS.blue);
  assert.equal(cardAppearance("blue", "dark").label, CARD_COLORS.blue.label);
  assert.notEqual(cardAppearance("blue", "dark").background, CARD_COLORS.blue.background);
  assert.notEqual(cardAppearance("neutral", "dark").background, CARD_COLORS.neutral.background);
});

test("all card backgrounds retain readable foreground contrast in both appearances", () => {
  function luminance(hex: string) {
    const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  for (const color of Object.keys(CARD_COLORS) as (keyof typeof CARD_COLORS)[]) {
    for (const mode of ["light", "dark"] as const) {
      const bg = luminance(cardAppearance(color, mode).background);
      const fg = mode === "light" ? 0 : 1;
      const ratio = (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05);
      assert.ok(ratio >= 4.5, `${mode} ${color}: ${ratio.toFixed(2)}:1`);
    }
  }
});
