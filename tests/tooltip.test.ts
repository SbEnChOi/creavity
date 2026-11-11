import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const positionModule = new URL("../src/components/tooltipPosition.ts", import.meta.url);

test("a sidebar tooltip is positioned to the right of its trigger", async () => {
  assert.ok(existsSync(positionModule), "tooltip positioning must be implemented");
  const { tooltipPosition } = await import("../src/components/tooltipPosition");
  assert.deepEqual(
    tooltipPosition({ left: 8, top: 100, right: 48, bottom: 140 }, { width: 100, height: 32 }, { width: 320, height: 600 }, "right"),
    { left: 56, top: 104 },
  );
});

test("tooltip content is available to keyboard and mouse without replacing its accessible name", async () => {
  const component = new URL("../src/components/Tooltip.tsx", import.meta.url);
  assert.ok(existsSync(component), "shared tooltip component must be implemented");
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: Tooltip } = await import("../src/components/Tooltip");
  const html = renderToStaticMarkup(React.createElement(Tooltip, { label: "닫기", children: React.createElement("button", { "aria-label": "닫기" }, "×") }));
  assert.match(html, /aria-label="닫기"/);
  assert.match(html, /role="tooltip"/);
  assert.doesNotMatch(html, /aria-describedby/, "an identical tooltip must not repeat the accessible name as a description");
  assert.match(html, /hidden/);
});

test("a tooltip only describes a trigger when its text adds to the accessible name", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: Tooltip } = await import("../src/components/Tooltip");
  const html = renderToStaticMarkup(React.createElement(Tooltip, { label: "지금 바로 닫습니다", children: React.createElement("button", { "aria-label": "닫기" }, "×") }));
  const describedBy = html.match(/aria-describedby="([^"]+)"/)?.[1];
  const tooltipId = html.match(/id="([^"]+)"[^>]*role="tooltip"/)?.[1];
  assert.ok(describedBy, "a tooltip with extra text must describe its trigger");
  assert.ok(tooltipId);
  assert.equal(describedBy, tooltipId);
});

test("one Escape closes the tooltip without swallowing the dialog's cancel", async () => {
  const source = await readFile(new URL("../src/components/Tooltip.tsx", import.meta.url), "utf8");
  const tree = ts.createSourceFile("Tooltip.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let body = "";
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.getText(tree) === "onKey") body = node.body?.getText(tree) ?? "";
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.match(source, /document\.addEventListener\("keydown", onKey, true\)/);
  assert.match(body, /event\.key === "Escape"/);
  assert.match(body, /setOpen\(false\)/);
  assert.doesNotMatch(body, /preventDefault|stopPropagation/, "Escape must keep travelling to the surrounding dialog");
});

test("touch users can reveal a tooltip with a long press while taps still follow links", async () => {
  const source = await readFile(new URL("../src/components/Tooltip.tsx", import.meta.url), "utf8");
  const tree = ts.createSourceFile("Tooltip.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const handlers: Record<string, string> = {};
  function visit(node: ts.Node) {
    if (ts.isJsxAttribute(node) && node.name.getText(tree).startsWith("onPointer") && node.initializer) {
      handlers[node.name.getText(tree)] = node.initializer.getText(tree);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.match(handlers.onPointerDown ?? "", /pointerType === "touch"/);
  assert.match(handlers.onPointerDown ?? "", /setTimeout/);
  assert.match(handlers.onPointerDown ?? "", /show\(\)/);
  assert.doesNotMatch(handlers.onPointerDown ?? "", /preventDefault|stopPropagation/, "a tap must still navigate links");
  assert.match(handlers.onPointerUp ?? "", /clearPress/, "releasing must cancel the pending long press");
  assert.match(handlers.onPointerCancel ?? "", /clearPress/, "a cancelled touch must cancel the pending long press");
  assert.match(handlers.onPointerMove ?? "", /clearPress\(\)/, "moving a finger must cancel the long press");
  assert.match(handlers.onPointerLeave ?? "", /pointerType !== "touch"/, "releasing a long press must not hide its tooltip");
  assert.match(source, /tooltipPosition\(rect, tip, \{ width: window\.innerWidth, height: window\.innerHeight \}, side\)/);
});

test("shared chrome uses tooltip labels without duplicating desktop navigation labels", async () => {
  const sidebar = await readFile(new URL("../src/components/Sidebar.tsx", import.meta.url), "utf8");
  const theme = await readFile(new URL("../src/components/ThemeToggle.tsx", import.meta.url), "utf8");
  assert.match(sidebar, /<Tooltip label="Creavy 홈"[^>]*mobileOnly/);
  assert.match(sidebar, /<Tooltip label=\{label\}[^>]*mobileOnly/);
  assert.match(sidebar, /<Tooltip label=\{`\$\{name\} 계정 메뉴`\}[^>]*mobileOnly/);
  assert.match(theme, /<Tooltip label=\{label\}/);
  assert.doesNotMatch(theme, /title=\{label\}/);
});

test("pointer users can reach a tooltip without its trigger immediately closing", async () => {
  const css = await readFile(new URL("../src/components/Tooltip.css", import.meta.url), "utf8");
  assert.match(css, /\.creavy-tooltip::before\s*\{[^}]*inset:\s*-8px/);
  const source = await readFile(new URL("../src/components/Tooltip.tsx", import.meta.url), "utf8");
  assert.match(source, /trigger\.current\?\.matches\(":hover"\)/);
});

test("touch focus does not leave a floating tooltip covering the screen", async () => {
  const source = await readFile(new URL("../src/components/Tooltip.tsx", import.meta.url), "utf8");
  assert.match(source, /onPointerDown=/);
  assert.match(source, /pointerType\s*===\s*"touch"/);
  assert.match(source, /touchFocus\.current/);
  assert.match(source, /onKeyDownCapture=/);
});

test("placement flips or clamps at viewport edges", async () => {
  const { tooltipPosition } = await import("../src/components/tooltipPosition");
  assert.deepEqual(tooltipPosition({ left: 270, right: 310, top: 100, bottom: 140 }, { width: 100, height: 32 }, { width: 320, height: 600 }, "right"), { left: 162, top: 104 });
  assert.deepEqual(tooltipPosition({ left: 280, right: 310, top: 3, bottom: 35 }, { width: 100, height: 32 }, { width: 320, height: 600 }, "top"), { left: 212, top: 43 });
});

test("an open tooltip does not persist when its trigger scrolls out of view", async () => {
  const source = await readFile(new URL("../src/components/Tooltip.tsx", import.meta.url), "utf8");
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /!entry\.isIntersecting/);
});
