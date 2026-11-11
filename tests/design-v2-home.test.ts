import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");
test("core studio request handlers remain wired to their original API actions", async () => {
  const source = await read("../src/components/ai/IdeaStudio.tsx");
  for (const action of ["start", "begin_memo", "answer", "resume", "back", "confirm", "research", "refine", "fork_focus"]) {
    assert.ok(source.includes(`action:"${action}"`), `${action} should remain wired`);
  }
  assert.ok(source.includes('fetch("/api/ai"'));
  assert.ok(source.includes('fetch("/api/ai/memo"'));
});

test("original composer, recent links and submission controls remain interactive", async () => {
  const source = await read("../src/components/ai/IdeaStudio.tsx");
  const file = ts.createSourceFile("IdeaStudio.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const attributes: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(file) !== "className") {
      const element = node.parent.parent as ts.JsxOpeningLikeElement;
      attributes.push(`${element.tagName.getText(file)}:${node.getText(file)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  for (const attribute of [
    'textarea:id="idea-seed"', 'textarea:value={seed}',
    'button:onClick={()=>void storeMemo()}', 'Link:href={`/ai?session=${item.id}`}',
  ]) assert.ok(attributes.includes(attribute), `${attribute} should remain wired`);
  const seedChange = attributes.find(attribute => attribute.startsWith("textarea:onChange="));
  assert.ok(seedChange?.includes("setSeed(e.target.value)"), "the memo textarea should remain editable");
});

test("memo composer and existing recent sessions use the centered design", async () => {
  const source = await read("../src/components/ai/IdeaStudio.tsx");
  assert.match(source, /import "\.\/V2Home\.css"/);
  for (const name of ["v2-home-grid", "v2-home-intro", "v2-composer", "v2-recent"]) {
    assert.ok(source.includes(name), `${name} should be attached to the existing screen`);
  }
  const css = await read("../src/components/ai/V2Home.css");
  assert.match(css, /\.v2-home-grid\s*\{/);
  assert.match(css, /\.v2-composer\s*\{/);
  assert.match(css, /\.v2-recent\s*\{/);
  assert.match(css, /var\(--(?:panel|surface|foreground|border|mark)\)/);
  assert.match(css, /@media\s*\(max-width:/);
});
