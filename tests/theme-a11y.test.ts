import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("shared dialog receives its surface, foreground and accessible name", async () => {
  const source = await read("../src/components/ai/ShareIdea.tsx");
  const tag = source.match(/<dialog\b[\s\S]*?>/)?.[0] ?? "";
  assert.match(tag, /\bbg-panel\b/);
  assert.match(tag, /\btext-foreground\b/);
  assert.match(tag, /aria-labelledby=/);
});

test("dark-theme feedback uses readable semantic text colors", async () => {
  const css = await read("../src/app/globals.css");
  assert.match(css, /--error-text-rgb:/);
  assert.match(css, /--success-text-rgb:/);
  for (const file of ["../src/components/ai/ShareIdea.tsx", "../src/app/(app)/admin/ai/session-editor.tsx", "../src/app/(app)/feed/feed-client.tsx"]) {
    const source = await read(file);
    assert.doesNotMatch(source, /role="alert"[^>]*text-red-700/);
  }
});

test("reduced motion freezes rather than accelerating looping spinners", async () => {
  const css = await read("../src/app/globals.css");
  assert.match(css, /\.animate-spin\s*\{[^}]*animation:\s*none\s*!important/);
});

test("card and image removal controls work on touch and keyboard", async () => {
  for (const file of ["../src/app/(app)/ideas/ideas-client.tsx", "../src/app/(app)/dashboard/dashboard-client.tsx", "../src/components/ImageUploadBox.tsx"]) {
    const source = await read(file);
    assert.match(source, /focus-visible:opacity-100/);
    assert.match(source, /reveal-on-hover/);
  }
  const css = await read("../src/app/globals.css");
  assert.match(css, /@media\s*\(any-hover:\s*none\)/);
});

test("keyboard focus remains visible and sidebar stays navigable on short screens", async () => {
  const css = await read("../src/app/globals.css");
  const sidebar = await read("../src/components/Sidebar.tsx");
  assert.match(css, /:focus-visible[^}]+outline:[^;]+!important/);
  assert.match(sidebar, /<nav className="[^"]*min-h-0[^"]*overflow-y-auto/);
});
