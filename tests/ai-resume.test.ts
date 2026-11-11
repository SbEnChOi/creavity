import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";
import { composerKey, readComposer, saveComposer, type Composer } from "../src/lib/ai/persistence";
import type { Session } from "../src/lib/ai/schema";

const require = createRequire(import.meta.url);
const question = { topic: "goal" as const, prompt: "이전 질문", reason: "", multiple: true, options: [{ id: "option1", label: "선택", detail: "" }] };
const latest: Session = {
  id: "10000000-0000-4000-8000-000000000001", revision: 2, updated_at: "2026-01-01T00:00:00Z",
  state: { seed: "기존 대화", mode: "explore", format: "basic", useResearch: true, phase: "questions", answers: [], question, clarification: "", research: null, draft: null, confirmed: false },
};
const cached: Composer = { seed: "이전 대화 메모", mode: "focus", format: "extended", useResearch: false, sessionId: latest.id, revision: latest.revision, choices: ["other"], custom: "미제출 답변", feedback: "다듬기 요청", focusDirection: "관심 방향" };

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, values };
}

type FetchReply = { ok: boolean; json: () => Promise<unknown> };
type MountOptions = { props?: Record<string, unknown>; search?: string; fetchImpl?: (url: string) => Promise<FetchReply>; strict?: boolean };

// Render the actual component with deterministic hook scheduling and local fixtures only.
function mountStudio(storage: ReturnType<typeof memoryStorage>, options: MountOptions = {}) {
  let slots: unknown[] = [];
  let index = 0;
  let effects: Array<() => void | (() => void)> = [];
  const cleanups = new Map<number, () => void>();
  let dirty = false;
  let props: Record<string, unknown> = options.props ?? {};
  const react = {
    useState(initial: unknown) {
      const i = index++;
      if (!(i in slots)) slots[i] = typeof initial === "function" ? (initial as () => unknown)() : initial;
      return [slots[i], (value: unknown) => { const next = typeof value === "function" ? (value as (previous: unknown) => unknown)(slots[i]) : value; if (!Object.is(slots[i], next)) { slots[i] = next; dirty = true; } }];
    },
    useRef(initial: unknown) { const i = index++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useEffect(effect: () => void, deps: unknown[]) {
      const i = index++; const previous = slots[i] as unknown[] | undefined;
      if (!previous || deps.some((value, n) => !Object.is(value, previous[n]))) { slots[i] = deps; effects.push(() => { cleanups.get(i)?.(); const cleanup = effect(); if (typeof cleanup === "function") cleanups.set(i, cleanup); else cleanups.delete(i); return cleanup; }); }
    },
  };
  const jsx = (type: unknown, properties: Record<string, unknown> | null) => ({ type, props: properties ?? {} });
  const messages: string[] = [];
  const calls: string[] = [];
  const browser = { localStorage: storage, location: { search: options.search ?? "" }, history: { replaceState: (_state: unknown, _title: string, url: string) => { messages.push(url); } }, addEventListener() {}, removeEventListener() {}, setInterval, clearInterval };
  const source = readFileSync(new URL("../src/components/ai/IdeaStudio.tsx", import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const exports: Record<string, unknown> = {};
  const sandbox = {
    exports, window: browser, navigator: { onLine: true }, URLSearchParams, crypto: { randomUUID: () => "40000000-0000-4000-8000-000000000001" },
    fetch: async (url: string) => { calls.push(url); if (options.fetchImpl) return options.fetchImpl(url); return { ok: true, json: async () => ({ session: latest }) }; },
    require(id: string) {
      if (id === "react") return react;
      if (id === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: Symbol.for("react.fragment") };
      if (id === "next/link" || id === "@/components/Wordmark" || id.startsWith("./")) return { __esModule: true, default: () => null };
      if (id.startsWith("@/")) return require(fileURLToPath(new URL(`../src/${id.slice(2)}.ts`, import.meta.url)));
      return require(id);
    },
  };
  vm.runInNewContext(output, sandbox);
  const Studio = exports.default as (props: Record<string, unknown>) => Node;
  let tree: Node;
  function render(nextProps?: Record<string, unknown>) {
    if (nextProps) props = nextProps;
    let count = 0;
    do {
      if (++count > 25) throw new Error("component did not settle");
      dirty = false; index = 0; effects = []; tree = Studio({ storageScope: "user", ...props });
      for (const effect of effects) {
        const cleanup = effect();
        if (options.strict && count === 1) { cleanup?.(); effect(); }
      }
    } while (dirty);
    return tree;
  }
  render();
  return { render, unmount() { for (const cleanup of cleanups.values()) cleanup(); cleanups.clear(); }, get tree() { return tree; }, messages, calls };
}
type Node = { type: unknown; props: Record<string, unknown> };
function allNodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(allNodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...allNodes(node.props.children)];
}
function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join("");
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object" && "props" in value) return text((value as Node).props.children);
  return "";
}
const buttons = (tree: Node, label: string) => allNodes(tree).filter(node => node.type === "button" && text(node).includes(label));
const seedInput = (tree: Node) => allNodes(tree).find(node => node.type === "textarea" && node.props.id === "idea-seed");
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test("mounting never applies or overwrites a cached unfinished draft", () => {
  const storage = memoryStorage(); const key = composerKey("user");
  saveComposer(storage, key, cached);
  const original = storage.getItem(key);
  const studio = mountStudio(storage);
  const input = seedInput(studio.tree);
  assert.ok(input, "a blank new composer should be displayed");
  assert.equal(input.props.value, "", "the cached memo must not be applied automatically");
  assert.equal(buttons(studio.tree, "이어서 작성하기").length, 1, "an explicit resume control should be offered");
  assert.equal(buttons(studio.tree, "새로 시작").length, 1);
  assert.equal(storage.getItem(key), original, "mount must not overwrite the cached draft");
  assert.deepEqual([...storage.values.keys()], [key], "no recovery archive should be created");
});

test("a deep link also waits for explicit consent before applying cached answers", () => {
  const storage = memoryStorage(); const key = composerKey("user");
  saveComposer(storage, key, cached);
  const original = storage.getItem(key);
  const studio = mountStudio(storage, { props: { initialSession: latest }, search: `?session=${latest.id}` });
  assert.ok(text(studio.tree).includes("이전 질문"));
  assert.equal(allNodes(studio.tree).find(node => node.type === "textarea" && node.props["aria-label"] === "기타 답변"), undefined);
  assert.equal(storage.getItem(key), original, "a deep link must not rewrite the cached draft");
});

test("explicit resume refills the saved conversation and its unsent answer", async () => {
  const storage = memoryStorage(); const key = composerKey("user");
  saveComposer(storage, key, cached);
  const studio = mountStudio(storage);
  (buttons(studio.tree, "이어서 작성하기")[0].props.onClick as () => void)();
  await tick(); studio.render();
  assert.deepEqual(studio.calls, [`/api/ai?id=${latest.id}`]);
  assert.ok(text(studio.tree).includes("이전 질문"));
  const answer = allNodes(studio.tree).find(node => node.type === "textarea" && node.props["aria-label"] === "기타 답변");
  assert.equal(answer?.props.value, "미제출 답변");
  const saved = readComposer(storage, key)!;
  assert.equal(saved.seed, cached.seed);
  assert.deepEqual(saved.choices, cached.choices);
  assert.equal(studio.messages.at(-1), `/ai?session=${latest.id}`);
});

test("resume from a memo-only draft fills the composer without a network call", async () => {
  const storage = memoryStorage(); const key = composerKey("user");
  const draft = { ...cached, sessionId: null, revision: null };
  saveComposer(storage, key, draft);
  const studio = mountStudio(storage);
  (buttons(studio.tree, "이어서 작성하기")[0].props.onClick as () => void)();
  await tick(); studio.render();
  assert.deepEqual(studio.calls, []);
  assert.equal(seedInput(studio.tree)?.props.value, draft.seed);
  const focus = buttons(studio.tree, "실제로 써보고 싶어요")[0];
  assert.equal(focus.props["aria-pressed"], true);
  const checkbox = allNodes(studio.tree).find(node => node.type === "input" && node.props.type === "checkbox");
  assert.equal(checkbox?.props.checked, false);
  assert.equal(studio.messages.at(-1), "/ai?new=1");
});

test("a failed resume fills only the memo and keeps the cached draft", async () => {
  const storage = memoryStorage(); const key = composerKey("user");
  saveComposer(storage, key, cached);
  const original = storage.getItem(key);
  const studio = mountStudio(storage, { fetchImpl: async () => { throw new Error("offline fixture"); } });
  (buttons(studio.tree, "이어서 작성하기")[0].props.onClick as () => void)();
  await tick(); studio.render();
  assert.equal(seedInput(studio.tree)?.props.value, cached.seed);
  assert.equal(buttons(studio.tree, "가능성을 넓혀볼래요")[0].props["aria-pressed"], true, "failed resume must not apply stored settings");
  assert.ok(text(studio.tree).includes("불러오지 못했어요"));
  assert.equal(storage.getItem(key), original, "a failed resume must not overwrite the cached draft");
});

test("starting fresh hides the notice without deleting the cached draft", () => {
  const storage = memoryStorage(); const key = composerKey("user");
  saveComposer(storage, key, cached);
  const original = storage.getItem(key);
  const studio = mountStudio(storage);
  (buttons(studio.tree, "새로 시작")[0].props.onClick as () => void)();
  studio.render();
  assert.equal(buttons(studio.tree, "이어서 작성하기").length, 0);
  assert.equal(seedInput(studio.tree)?.props.value, "");
  assert.equal(storage.getItem(key), original);
  const reloaded = mountStudio(storage);
  assert.equal(buttons(reloaded.tree, "이어서 작성하기").length, 1, "the untouched draft must remain offered after a reload");
});

test("no storage write happens before the first edit and typing then persists normally", () => {
  const storage = memoryStorage(); const key = composerKey("user");
  saveComposer(storage, key, cached);
  const original = storage.getItem(key);
  const studio = mountStudio(storage);
  studio.render();
  assert.equal(storage.getItem(key), original);
  (seedInput(studio.tree)!.props.onChange as (event: unknown) => void)({ target: { value: "새로 쓰는 메모" } });
  studio.render();
  const saved = readComposer(storage, key)!;
  assert.equal(saved.seed, "새로 쓰는 메모");
  assert.equal(saved.sessionId, null);
});

test("mode selection counts as an intentional edit and persists", () => {
  const storage = memoryStorage(); const key = composerKey("user");
  saveComposer(storage, key, cached);
  const studio = mountStudio(storage);
  (buttons(studio.tree, "실제로 써보고 싶어요")[0].props.onClick as () => void)();
  studio.render();
  assert.equal(readComposer(storage, key)!.mode, "focus");
});

test("a pending resume locks the composer and shows progress", async () => {
  const storage = memoryStorage();
  saveComposer(storage, composerKey("user"), cached);
  let release!: (value: FetchReply) => void;
  const pending = new Promise<FetchReply>(resolve => { release = resolve; });
  const studio = mountStudio(storage, { fetchImpl: () => pending });
  (buttons(studio.tree, "이어서 작성하기")[0].props.onClick as () => void)();
  studio.render();
  assert.equal(seedInput(studio.tree)?.props.disabled, true);
  const resume = buttons(studio.tree, "이어서 작성하기")[0];
  assert.equal(resume.props.disabled, true);
  assert.ok(text(studio.tree).includes("불러오는 중"));
  release({ ok: true, json: async () => ({ session: latest }) });
  await tick(); studio.render();
});

test("the resume control stays disabled while a conversation is still processing", () => {
  const storage = memoryStorage();
  saveComposer(storage, composerKey("user"), cached);
  const processing = { ...latest, processing_until: new Date(Date.now() + 60_000).toISOString() };
  const studio = mountStudio(storage, { props: { initialSession: processing }, search: `?session=${latest.id}` });
  const resume = buttons(studio.tree, "이어서 작성하기")[0];
  assert.ok(resume, "the cached draft should still be offered");
  assert.equal(resume.props.disabled, true);
  assert.equal(buttons(studio.tree, "새로 시작")[0].props.disabled, true);
  studio.unmount();
});

test("a resume response after unmount cannot change storage or history", async () => {
  const storage = memoryStorage(); const key = composerKey("user");
  saveComposer(storage, key, cached);
  let release!: (value: FetchReply) => void;
  const pending = new Promise<FetchReply>(resolve => { release = resolve; });
  const studio = mountStudio(storage, { fetchImpl: () => pending });
  (buttons(studio.tree, "이어서 작성하기")[0].props.onClick as () => void)();
  studio.render(); studio.unmount();
  const before = JSON.stringify([...storage.values]);
  release({ ok: true, json: async () => ({ session: latest }) });
  await tick();
  assert.equal(JSON.stringify([...storage.values]), before);
  assert.deepEqual(studio.messages, [], "unmounted resume must not change the address");
});

test("demo preview keeps restoring its local memo on mount", () => {
  const storage = memoryStorage(); const key = composerKey("user");
  const draft = { ...cached, sessionId: null, revision: null };
  saveComposer(storage, key, draft);
  const studio = mountStudio(storage, { props: { demo: true, initialSeed: "예시 메모" }, search: "" });
  assert.equal(seedInput(studio.tree)?.props.value, draft.seed);
  assert.equal(storage.getItem(`${key}:recovery.v1`), null);
});

test("the retired recovery archive is gone from the studio", () => {
  const source = readFileSync(new URL("../src/components/ai/IdeaStudio.tsx", import.meta.url), "utf8");
  for (const removed of ["archiveComposer", "recovery.v1", "작성 내용 복구", "메모만 복구", "recoveries"] as const) {
    assert.ok(!source.includes(removed), `${removed} must be removed`);
  }
});

async function renderPage(params: { session?: string; idea?: string } = {}) {
  const calls: { table: string; filters: [string, string][] }[] = [];
  const user = { id: "20000000-0000-4000-8000-000000000001", is_anonymous: false };
  const client = {
    auth: { getUser: async () => ({ data: { user } }) },
    from(table: string) {
      const filters: [string, string][] = [];
      calls.push({ table, filters });
      const query = {
        select() { return query; },
        eq(field: string, value: string) { filters.push([field, value]); return query; },
        order() { return query; },
        async limit() { return { data: [latest], error: null }; },
        async maybeSingle() {
          if (table === "ideas") return { data: { title: "가져온 제목", body: "가져온 내용" } };
          return { data: filters.some(([field, value]) => field === "id" && value === latest.id) ? latest : null };
        },
      };
      return query;
    },
  };
  const source = readFileSync(new URL("../src/app/(app)/ai/page.tsx", import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: Record<string, unknown> = {};
  const Studio = () => null;
  const sandbox = {
    exports, process: { env: { OPENAI_API_KEY: "placeholder" } },
    require(id: string) {
      if (id === "@/lib/supabase/server") return { createSupabaseServerClient: async () => client };
      if (id === "@/components/ai/IdeaStudio") return { __esModule: true, default: Studio };
      return require(id);
    },
  };
  vm.runInNewContext(output, sandbox);
  const page = exports.default as (p: { searchParams: Promise<typeof params> }) => Promise<{ type: unknown; props: Record<string, unknown> }>;
  return { element: await page({ searchParams: Promise.resolve(params) }), calls, Studio, user };
}

test("a normal visit opens a new composer while retaining recent conversations", async () => {
  const { element, Studio } = await renderPage();
  assert.equal(element.type, Studio);
  assert.equal(element.props.initialSession, null);
  assert.deepEqual(element.props.sessions, [latest]);
});

test("session and idea deep links still select only the requested owned source", async () => {
  const session = await renderPage({ session: latest.id });
  assert.equal(session.element.props.initialSession, latest);
  assert.ok(session.calls.some(call => call.table === "ai_sessions" && call.filters.some(([field, value]) => field === "id" && value === latest.id) && call.filters.some(([field, value]) => field === "user_id" && value === session.user.id)));
  const ideaId = "30000000-0000-4000-8000-000000000001";
  const idea = await renderPage({ idea: ideaId });
  assert.equal(idea.element.props.initialSession, null);
  assert.equal(idea.element.props.initialSeed, "가져온 제목\n\n가져온 내용");
  assert.ok(idea.calls.some(call => call.table === "ideas" && call.filters.some(([field, value]) => field === "author_id" && value === idea.user.id)));
  const invalid = await renderPage({ session: "not-a-uuid" });
  assert.equal(invalid.element.props.initialSession, null);
  assert.ok(String(invalid.element.props.setupError).includes("요청한 대화를 찾을 수 없습니다"));
});
