import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

test("the existing studio state, hooks and request handlers are unchanged", async () => {
  const source = await read("../src/components/ai/IdeaStudio.tsx");
  const start = source.indexOf("type Props =");
  const end = source.indexOf("  return <div className=");
  assert.ok(start >= 0 && end > start);
  assert.equal(digest(source.slice(start, end).replace(/\r\n/g, "\n")), "389898a98d8319a239b186e6e3e585a8f280376b243d5f6928a25e3eaf09687b");
});

test("the original interactive elements retain their attributes and event handlers", async () => {
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
  assert.equal(attributes.length, 158);
  assert.equal(digest(attributes.sort().join("\n")), "c81321ebb5d3312e1e881a1df495834ae71a9aaee7d6628f637ffecb7e04dc92");
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
