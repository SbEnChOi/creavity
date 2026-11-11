import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { readFile } from "node:fs/promises";
import { appearanceBootstrapScript, isRedesignedRoute, readAppearance, resolveAppearance } from "../src/lib/appearance";

test("only the redesigned screens default to dark without a saved choice", () => {
  for (const path of ["/ai", "/ai/archive", "/ideas", "/about", "/settings", "/ai-preview", "/login", "/ai-share/abc"]) {
    assert.equal(resolveAppearance(null, path), "dark", path);
  }
  for (const path of ["/dashboard", "/new", "/reports/abc", "/feed", "/profile/abc", "/admin/ai", "/other", "/ai-other"]) {
    assert.equal(resolveAppearance(null, path), "light", path);
  }
});

test("initial paint and route reads use the same stored choice and fallback", () => {
  const paths = ["/ai", "/ai/archive", "/login", "/ai-share/abc", "/dashboard", "/reports/abc", "/ai-other"];
  for (const pathname of paths) {
    for (const saved of [null, "light", "dark", "invalid"]) {
      const dataset: { theme?: string } = {};
      const localStorage = { getItem: () => saved };
      runInNewContext(appearanceBootstrapScript, { document: { documentElement: { dataset } }, window: { location: { pathname } }, localStorage });
      assert.equal(dataset.theme, resolveAppearance(saved, pathname), `${pathname}: ${saved}`);
      assert.equal(readAppearance(localStorage, pathname), dataset.theme);
    }
    const dataset: { theme?: string } = {};
    const blocked = { getItem: () => { throw new Error("blocked"); } };
    runInNewContext(appearanceBootstrapScript, { document: { documentElement: { dataset } }, window: { location: { pathname } }, localStorage: blocked });
    assert.equal(dataset.theme, resolveAppearance(null, pathname), `${pathname}: blocked storage`);
    assert.equal(readAppearance(blocked, pathname), dataset.theme);
  }
});

test("the mobile sidebar account button keeps its touch target inside the tooltip wrapper", async () => {
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const tooltip = await readFile(new URL("../src/components/Tooltip.css", import.meta.url), "utf8");
  assert.match(tooltip, /\.creavy-tooltip-trigger\s*\{\s*display:\s*contents;\s*\}/);
  assert.match(css, /\.creavy-v2-sidebar > div:last-child > button,\s*\.creavy-v2-sidebar > div:last-child > \.creavy-tooltip-trigger > button\s*\{\s*min-height:\s*44px;\s*justify-content:\s*center;\s*\}/);
});

test("the existing sidebar opts into redesigned chrome only on app routes", async () => {
  const source = await readFile(new URL("../src/components/Sidebar.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.equal(isRedesignedRoute("/ai"), true);
  assert.equal(isRedesignedRoute("/reports/abc"), false);
  assert.match(source, /isRedesignedRoute\(pathname\)/);
  assert.match(source, /creavy-v2-sidebar/);
  assert.match(css, /aside\.creavy-v2-sidebar\s*\{[^}]*width:\s*264px/);
  assert.match(css, /\.creavy-v2-sidebar[^}]*\[aria-current[\s\S]*?\]/);
});
