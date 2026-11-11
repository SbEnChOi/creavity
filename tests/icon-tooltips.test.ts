import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReportCardColor from "../src/components/ReportCardColor";
import { CARD_COLORS } from "../src/lib/card-colors";
import ImageUploadBox from "../src/components/ImageUploadBox";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// tsx uses the classic JSX runtime when executing these Next.js components.
Object.assign(globalThis, { React });

test("card color buttons expose matching tooltip text once", () => {
  const html = renderToStaticMarkup(React.createElement(ReportCardColor, {
    color: "blue", busy: false, title: "예시", onChange() {},
  }));
  for (const { label } of Object.values(CARD_COLORS)) {
    assert.match(html, new RegExp(`<button[^>]*aria-label="${label} 선택"[^>]*>`));
    assert.match(html, new RegExp(`<span[^>]*role="tooltip"[^>]*>${label} 선택</span>`));
  }
  assert.doesNotMatch(html, /aria-describedby/, "a tooltip identical to the name must not describe it again");
  assert.match(html, /aria-pressed="true"/);
  assert.doesNotMatch(html, /<button[^>]*\stitle=/);
});

test("image removal has an accessible tooltip without a native title", () => {
  const html = renderToStaticMarkup(React.createElement(ImageUploadBox, {
    images: ["data:image/png;base64,AA=="], userId: "placeholder", onChange() {},
  }));
  assert.match(html, /<button[^>]*aria-label="사진 삭제"/);
  assert.match(html, /role="tooltip"[^>]*>사진 삭제<\/span>/);
  assert.doesNotMatch(html, /aria-describedby/);
  assert.doesNotMatch(html, /<button[^>]*\stitle=/);
});

test("share dialog close button is wrapped inside the dialog", async () => {
  const source = await readFile(new URL("../src/components/ai/ShareIdea.tsx", import.meta.url), "utf8");
  assert.match(source, /<dialog\b[\s\S]*?<Tooltip label="공유 설정 닫기"><button[^>]*aria-label="공유 설정 닫기"[^>]*>[\s\S]*?<\/button><\/Tooltip>[\s\S]*?<\/dialog>/);
});

test("remaining delete controls have named tooltip wrappers and retain their disabled conditions", async () => {
  const cases = [
    ["../src/app/(app)/dashboard/dashboard-client.tsx", "보고서 삭제", "deleting"],
    ["../src/app/(app)/ideas/ideas-client.tsx", "아이디어 삭제", "pendingId === idea.id"],
    ["../src/app/(app)/admin/admin-client.tsx", "보고서 삭제", "pendingId === r.id"],
    ["../src/app/(app)/admin/admin-client.tsx", "멤버 삭제", "pendingId === m.id || isMe"],
  ] as const;
  for (const [path, label, disabled] of cases) {
    const text = await readFile(new URL(path, import.meta.url), "utf8");
    const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let button: ts.JsxOpeningElement | undefined;
    function visit(node: ts.Node) {
      if (ts.isJsxOpeningElement(node) && node.tagName.getText(tree) === "button") {
        if (node.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.getText(tree) === "aria-label" && p.initializer?.getText(tree) === JSON.stringify(label))) button = node;
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
    assert.ok(button, `${path}: missing named ${label} button`);
    const element = button.parent;
    assert.ok(ts.isJsxElement(element) && ts.isVariableDeclaration(element.parent));
    assert.equal(element.parent.name.getText(tree), "deleteButton");
    let guarded = false;
    function findGuard(node: ts.Node) {
      if (ts.isConditionalExpression(node) && node.condition.getText(tree) === disabled && node.whenTrue.getText(tree) === "deleteButton" && ts.isJsxElement(node.whenFalse)) {
        const tooltip = node.whenFalse;
        guarded = tooltip.openingElement.tagName.getText(tree) === "Tooltip" &&
          tooltip.openingElement.attributes.properties.some(p => ts.isJsxAttribute(p) && p.getText(tree) === `label=${JSON.stringify(label)}`) &&
          tooltip.children.some(child => ts.isJsxExpression(child) && child.expression?.getText(tree) === "deleteButton");
      }
      ts.forEachChild(node, findGuard);
    }
    findGuard(tree);
    assert.ok(guarded, `${label}: do not wrap disabled controls`);
    assert.equal(button.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(tree) === "disabled")?.getText(tree), `disabled={${disabled}}`);
    assert.ok(!button.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.getText(tree) === "title"), label);
  }
});

test("the disabled self-delete control still explains why it cannot be used", async () => {
  const path = "../src/app/(app)/admin/admin-client.tsx";
  const text = await readFile(new URL(path, import.meta.url), "utf8");
  const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let button: ts.JsxOpeningElement | undefined;
  let hint: ts.JsxElement | undefined;
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(tree) === "button" &&
      node.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.getText(tree) === "aria-label" && p.initializer?.getText(tree) === '"멤버 삭제"')) button = node;
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === "span" &&
      node.openingElement.attributes.properties.some(p => ts.isJsxAttribute(p) && p.getText(tree) === "id={`member-delete-self-${m.id}`}")) hint = node;
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(button, "missing member delete button");
  assert.equal(button.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(tree) === "aria-describedby")?.getText(tree),
    "aria-describedby={isMe ? `member-delete-self-${m.id}` : undefined}");
  assert.equal(button.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(tree) === "disabled")?.getText(tree), "disabled={pendingId === m.id || isMe}");
  assert.ok(hint, "the reason must be rendered as adjacent text");
  assert.match(hint.getText(tree), />본인은 삭제 불가</);
  assert.ok(ts.isBinaryExpression(hint.parent) && hint.parent.getText(tree).startsWith("isMe && <span"));
  assert.ok(ts.isJsxExpression(hint.parent.parent) && ts.isJsxElement(hint.parent.parent.parent) && hint.parent.parent.parent.openingElement.tagName.getText(tree) === "div", "the reason must sit next to, not inside, the disabled button");
});

test("profile avatar swatches have descriptive tooltip labels and expose selection", async () => {
  const source = await readFile(new URL("../src/app/(app)/settings/settings-client.tsx", import.meta.url), "utf8");
  for (const label of ["회색", "파랑", "초록", "노랑", "빨강", "보라"]) assert.ok(source.includes(`"${label}"`));
  assert.match(source, /<Tooltip\s+key=\{c\}\s+label=\{`\$\{AVATAR_COLOR_LABELS\[c\]\} 아바타 색상 선택`\}>\s*<button/);
  assert.match(source, /aria-label=\{`\$\{AVATAR_COLOR_LABELS\[c\]\} 아바타 색상 선택`\}/);
  assert.match(source, /aria-pressed=\{avatarColor\s*===\s*c\}/);
});

test("temporarily disabled card colors are not presented as tooltip triggers", () => {
  const html = renderToStaticMarkup(React.createElement(ReportCardColor, {
    color: "blue", busy: true, title: "예시", onChange() {},
  }));
  assert.equal((html.match(/<button[^>]*disabled/g) ?? []).length, Object.keys(CARD_COLORS).length);
  assert.doesNotMatch(html, /role="tooltip"/);
});
