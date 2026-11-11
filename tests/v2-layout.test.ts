import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("redesigned sidebar width takes priority over the original responsive utility", async () => {
  const css = await read("../src/app/globals.css");
  assert.match(css, /aside\.creavy-v2-sidebar\s*\{[^}]*width:\s*264px/);
  assert.match(css, /@media\s*\(max-width:\s*767px\)\s*\{[^}]*aside\.creavy-v2-sidebar\s*\{[^}]*width:\s*64px/);
});

test("the home keeps its page heading accessible while reducing duplicate visible introduction", async () => {
  const studio = await read("../src/components/ai/IdeaStudio.tsx");
  const css = await read("../src/components/ai/V2Home.css");
  assert.match(studio, /v2-studio-header/);
  assert.match(css, /\.v2-studio-header\s*>\s*div:first-child\s*\{[^}]*clip-path:\s*inset\(50%\)/);
  assert.doesNotMatch(css, /\.v2-studio-header:has\(nav:empty\)\s*\{[^}]*display:\s*none/);
});

test("mobile keeps the editable memo and both conversation modes compact and readable", async () => {
  const css = await read("../src/components/ai/V2Home.css");
  assert.match(css, /\.v2-composer\s*>\s*textarea\s*\{[^}]*field-sizing:\s*content/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.v2-home-intro\s*\{[^}]*padding:\s*12px 0/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.v2-home-wordmark\s*\{[^}]*margin-bottom:\s*10px/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.v2-composer\s*>\s*textarea\s*\{[^}]*min-height:\s*112px/);
});
